/**
 * Trail Renderer
 *
 * Renders the light wall trails left behind by cycles using a ribbon geometry
 * approach. Each trail point has a timestamp, enabling time-based fading and
 * expiry. The trail follows the racer in 3D, including during jumps.
 *
 * The mesh is allocated once at `MAX_TRAIL_POINTS` capacity and reused for
 * the racer's lifetime: `rebuildMesh` overwrites the position/alpha
 * attributes in place and narrows `setDrawRange` to the active point count,
 * rather than disposing and recreating a `BufferGeometry` every frame.
 */

import * as THREE from 'three/webgpu'
import { attribute, uniform } from 'three/tsl'
import { MAX_TRAIL_POINTS, TRAIL_HEIGHT, TRAIL_WIDTH, TRAIL_LIFETIME, TRAIL_FADE_DURATION } from '../constants'
import {
  INDICES_PER_SEGMENT,
  VERTICES_PER_POINT,
  accumulateTravel,
  buildTrailIndices,
  shouldAddControlPoint,
} from './trailPointLogic'

/** Minimum distance between control points to avoid degenerate geometry */
const MIN_POINT_DISTANCE = 0.5

interface TrailPoint {
  position: THREE.Vector3
  timestamp: number
}

export class TrailRenderer {
  group: THREE.Group
  private color: number
  private material: THREE.MeshBasicNodeMaterial
  private colorUniform
  private baseOpacityUniform

  /** Timestamped control points for the trail */
  private trailPoints: TrailPoint[] = []

  /** Fixed-capacity ribbon mesh, allocated once and updated in place */
  private geometry: THREE.BufferGeometry
  private mesh: THREE.Mesh
  private positions: Float32Array
  private alphas: Float32Array
  private positionAttribute: THREE.BufferAttribute
  private alphaAttribute: THREE.BufferAttribute
  private renderPoints: TrailPoint[] = []
  private livePoint: TrailPoint = {
    position: new THREE.Vector3(),
    timestamp: 0,
  }

  /** Track distance since last point for spacing */
  private distanceSinceLastPoint = 0
  private lastPosition: { x: number; y: number; z: number } | null = null

  /** Whether a global fade-out is active (death effect) */
  private isFadingOut = false
  private fadeStartTime = 0
  private fadeDuration = 0

  constructor(color: number) {
    this.color = color
    this.group = new THREE.Group()

    this.colorUniform = uniform(new THREE.Color(color))
    this.baseOpacityUniform = uniform(0.35)
    const emissiveBoostUniform = uniform(1.8)
    const vAlpha = attribute<'float'>('alpha', 'float')

    this.material = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.material.colorNode = this.colorUniform.mul(emissiveBoostUniform)
    this.material.opacityNode = this.baseOpacityUniform.mul(vAlpha)

    this.positions = new Float32Array(MAX_TRAIL_POINTS * VERTICES_PER_POINT * 3)
    this.alphas = new Float32Array(MAX_TRAIL_POINTS * VERTICES_PER_POINT)

    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3)
      .setUsage(THREE.DynamicDrawUsage)
    this.alphaAttribute = new THREE.BufferAttribute(this.alphas, 1)
      .setUsage(THREE.DynamicDrawUsage)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', this.positionAttribute)
    this.geometry.setAttribute('alpha', this.alphaAttribute)
    this.geometry.setIndex(buildTrailIndices(MAX_TRAIL_POINTS))
    this.geometry.setDrawRange(0, 0)

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    // Bounds vary every frame and the ribbon is always near the racer, so
    // frustum culling adds recompute cost without a visible payoff.
    this.mesh.frustumCulled = false
    this.group.add(this.mesh)
  }

  /**
   * Start the trail at a 3D position
   */
  startNewSegment(position: { x: number; y: number; z: number }): void {
    this.trailPoints.push({
      position: new THREE.Vector3(position.x, position.y, position.z),
      timestamp: performance.now(),
    })
    this.lastPosition = { x: position.x, y: position.y, z: position.z }
    this.distanceSinceLastPoint = 0
  }

  /**
   * Extend the trail to a new 3D position
   */
  extendLastSegment(newEnd: { x: number; y: number; z: number }): void {
    if (this.trailPoints.length === 0) {
      this.startNewSegment(newEnd)
      return
    }

    this.distanceSinceLastPoint = accumulateTravel(
      this.lastPosition,
      newEnd,
      this.distanceSinceLastPoint,
    )

    if (shouldAddControlPoint(this.distanceSinceLastPoint)) {
      this.trailPoints.push({
        position: new THREE.Vector3(newEnd.x, newEnd.y, newEnd.z),
        timestamp: performance.now(),
      })
      this.distanceSinceLastPoint = 0
    }

    const lastPosition = this.lastPosition
    if (lastPosition) {
      lastPosition.x = newEnd.x
      lastPosition.y = newEnd.y
      lastPosition.z = newEnd.z
    } else {
      this.lastPosition = { x: newEnd.x, y: newEnd.y, z: newEnd.z }
    }

    // Rebuild the trail mesh
    this.rebuildMesh(newEnd)
  }

  /**
   * Get the end position of the trail
   */
  getLastSegmentEnd(): { x: number; y: number; z: number } | null {
    return this.lastPosition ? { ...this.lastPosition } : null
  }

  /**
   * Get active trail points, pruning expired ones from the front and
   * capping the total at `MAX_TRAIL_POINTS` so the fixed-capacity buffers
   * never overflow.
   */
  private getActivePoints(currentEnd: { x: number; y: number; z: number }): TrailPoint[] {
    const now = performance.now()
    const maxAge = TRAIL_LIFETIME + TRAIL_FADE_DURATION

    // Filter out fully expired points (but keep at least the most recent one)
    const firstActiveIndex = this.trailPoints.findIndex(
      (p) => (now - p.timestamp) < maxAge
    )

    if (firstActiveIndex > 0) {
      this.trailPoints.copyWithin(0, firstActiveIndex)
      this.trailPoints.length -= firstActiveIndex
    } else if (firstActiveIndex === -1 && this.trailPoints.length > 0) {
      // All points expired -- keep just the last one as an anchor
      this.trailPoints[0] = this.trailPoints[this.trailPoints.length - 1]
      this.trailPoints.length = 1
    }

    // Defensive cap: guards the fixed-capacity buffers even if travel speed
    // or spacing changes push the natural point count past MAX_TRAIL_POINTS.
    const capacityForLivePoint = MAX_TRAIL_POINTS - 1
    if (this.trailPoints.length > capacityForLivePoint) {
      const firstKept = this.trailPoints.length - capacityForLivePoint
      this.trailPoints.copyWithin(0, firstKept)
      this.trailPoints.length = capacityForLivePoint
    }

    // Reuse the render list and live tip so a physics tick does not allocate.
    const allPoints = this.renderPoints
    allPoints.length = this.trailPoints.length
    for (let i = 0; i < this.trailPoints.length; i++) {
      allPoints[i] = this.trailPoints[i]
    }
    const endPoint = this.livePoint
    endPoint.position.set(currentEnd.x, currentEnd.y, currentEnd.z)
    endPoint.timestamp = now

    // Always append the current end position so the ribbon smoothly
    // extends to the racer. If it's very close to the last control point,
    // replace that point instead to avoid degenerate geometry.
    const lastControlPoint = allPoints[allPoints.length - 1]
    if (lastControlPoint && lastControlPoint.position.distanceTo(endPoint.position) < MIN_POINT_DISTANCE) {
      // Replace the last stored point with the current end to avoid
      // near-zero-length segments that cause visual jitter
      allPoints[allPoints.length - 1] = endPoint
    } else {
      allPoints.push(endPoint)
    }

    return allPoints
  }

  /**
   * Rebuild the trail mesh from current points as a ribbon geometry.
   * Writes into the preallocated position/alpha buffers in place and
   * narrows the draw range, never allocating a new geometry or mesh.
   */
  private rebuildMesh(currentEnd: { x: number; y: number; z: number }): void {
    const allPoints = this.getActivePoints(currentEnd)
    if (allPoints.length < 2) {
      this.geometry.setDrawRange(0, 0)
      return
    }

    const now = performance.now()
    const { positions, alphas } = this

    for (let i = 0; i < allPoints.length; i++) {
      const pt = allPoints[i]
      const age = now - pt.timestamp

      // Calculate opacity based on age with smooth ease-out curve
      let alpha = 1.0
      if (age > TRAIL_LIFETIME) {
        const fadeProgress = Math.min(1, (age - TRAIL_LIFETIME) / TRAIL_FADE_DURATION)
        // Smooth ease-out: starts fading slowly, accelerates at the end
        alpha = 1.0 - fadeProgress * fadeProgress
      }

      // Apply global fade-out if active (death effect)
      if (this.isFadingOut) {
        const fadeElapsed = now - this.fadeStartTime
        const fadeProgress = Math.min(1, fadeElapsed / this.fadeDuration)
        alpha *= (1 - fadeProgress)
      }

      // Calculate perpendicular direction for wall width in XZ plane
      const next = allPoints[Math.min(i + 1, allPoints.length - 1)]
      const prev = allPoints[Math.max(i - 1, 0)]
      const dx = next.position.x - prev.position.x
      const dz = next.position.z - prev.position.z
      const len = Math.sqrt(dx * dx + dz * dz) || 1
      const perpX = (-dz / len) * (TRAIL_WIDTH / 2)
      const perpZ = (dx / len) * (TRAIL_WIDTH / 2)

      const baseIdx = i * VERTICES_PER_POINT

      // Left-bottom vertex
      positions[(baseIdx + 0) * 3 + 0] = pt.position.x - perpX
      positions[(baseIdx + 0) * 3 + 1] = pt.position.y
      positions[(baseIdx + 0) * 3 + 2] = pt.position.z - perpZ

      // Left-top vertex
      positions[(baseIdx + 1) * 3 + 0] = pt.position.x - perpX
      positions[(baseIdx + 1) * 3 + 1] = pt.position.y + TRAIL_HEIGHT
      positions[(baseIdx + 1) * 3 + 2] = pt.position.z - perpZ

      // Right-bottom vertex
      positions[(baseIdx + 2) * 3 + 0] = pt.position.x + perpX
      positions[(baseIdx + 2) * 3 + 1] = pt.position.y
      positions[(baseIdx + 2) * 3 + 2] = pt.position.z + perpZ

      // Right-top vertex
      positions[(baseIdx + 3) * 3 + 0] = pt.position.x + perpX
      positions[(baseIdx + 3) * 3 + 1] = pt.position.y + TRAIL_HEIGHT
      positions[(baseIdx + 3) * 3 + 2] = pt.position.z + perpZ

      alphas[baseIdx + 0] = alpha
      alphas[baseIdx + 1] = alpha
      alphas[baseIdx + 2] = alpha
      alphas[baseIdx + 3] = alpha
    }

    this.positionAttribute.needsUpdate = true
    this.alphaAttribute.needsUpdate = true

    this.geometry.setDrawRange(0, (allPoints.length - 1) * INDICES_PER_SEGMENT)
  }

  /**
   * Check if a point collides with the trail
   * Uses AABB check per segment with Y-overlap detection
   */
  checkCollision(
    point: { x: number; z: number },
    margin: number = 0.3,
    racerY: number = 0
  ): boolean {
    const halfWidth = TRAIL_WIDTH / 2 + margin
    const now = performance.now()
    const maxAge = TRAIL_LIFETIME + TRAIL_FADE_DURATION

    // Check collision against each segment between control points
    for (let i = 0; i < this.trailPoints.length - 1; i++) {
      const start = this.trailPoints[i]
      const end = this.trailPoints[i + 1]

      // Skip expired segments
      if ((now - start.timestamp) > maxAge && (now - end.timestamp) > maxAge) continue

      // XZ AABB check
      const minX = Math.min(start.position.x, end.position.x) - halfWidth
      const maxX = Math.max(start.position.x, end.position.x) + halfWidth
      const minZ = Math.min(start.position.z, end.position.z) - halfWidth
      const maxZ = Math.max(start.position.z, end.position.z) + halfWidth

      if (point.x < minX || point.x > maxX || point.z < minZ || point.z > maxZ) continue

      // Y overlap check
      const segMinY = Math.min(start.position.y, end.position.y)
      const segMaxY = Math.max(start.position.y, end.position.y) + TRAIL_HEIGHT
      const racerMinY = racerY
      const racerMaxY = racerY + TRAIL_HEIGHT

      if (racerMinY > segMaxY || racerMaxY < segMinY) continue

      return true
    }

    // Also check from last control point to current end
    if (this.lastPosition && this.trailPoints.length > 0) {
      const start = this.trailPoints[this.trailPoints.length - 1]
      const end = this.lastPosition

      // Skip if expired
      if ((now - start.timestamp) <= maxAge) {
        const minX = Math.min(start.position.x, end.x) - halfWidth
        const maxX = Math.max(start.position.x, end.x) + halfWidth
        const minZ = Math.min(start.position.z, end.z) - halfWidth
        const maxZ = Math.max(start.position.z, end.z) + halfWidth

        if (point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ) {
          // Y overlap check
          const segMinY = Math.min(start.position.y, end.y)
          const segMaxY = Math.max(start.position.y, end.y) + TRAIL_HEIGHT
          const racerMinY = racerY
          const racerMaxY = racerY + TRAIL_HEIGHT

          if (racerMaxY >= segMinY && racerMinY <= segMaxY) {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Update color
   */
  setColor(color: number): void {
    this.color = color
    this.colorUniform.value = new THREE.Color(color)
  }

  /**
   * Fade out effect (for death)
   */
  fadeOut(duration: number = 1000): Promise<void> {
    return new Promise((resolve) => {
      this.isFadingOut = true
      this.fadeStartTime = performance.now()
      this.fadeDuration = duration

      const checkComplete = () => {
        const elapsed = performance.now() - this.fadeStartTime
        if (elapsed >= duration) {
          resolve()
        } else {
          requestAnimationFrame(checkComplete)
        }
      }

      requestAnimationFrame(checkComplete)
    })
  }

  /**
   * Clear all trail data
   */
  clear(): void {
    this.geometry.setDrawRange(0, 0)
    this.trailPoints = []
    this.lastPosition = null
    this.distanceSinceLastPoint = 0
    this.isFadingOut = false

    // Reset material uniform
    this.baseOpacityUniform.value = 0.35
  }

  dispose(): void {
    this.clear()
    this.geometry.dispose()
    this.material.dispose()
  }
}
