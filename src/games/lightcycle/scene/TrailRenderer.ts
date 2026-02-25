/**
 * Trail Renderer
 *
 * Renders the light wall trails left behind by cycles using a ribbon geometry
 * approach. Each trail point has a timestamp, enabling time-based fading and
 * expiry. The trail follows the racer in 3D, including during jumps.
 *
 * Uses a ShaderMaterial with per-vertex alpha for smooth fade-out of older
 * trail sections, and a BufferGeometry ribbon (quad-strip) for performance.
 */

import * as THREE from 'three'
import { TRAIL_HEIGHT, TRAIL_WIDTH, TRAIL_LIFETIME, TRAIL_FADE_DURATION } from '../constants'

/** Minimum distance between control points to avoid degenerate geometry */
const MIN_POINT_DISTANCE = 0.5

/** How often to add new control points (in world units of travel) */
const POINT_SPACING = 2.0

interface TrailPoint {
  position: THREE.Vector3
  timestamp: number
}

export class TrailRenderer {
  group: THREE.Group
  private color: number
  private material: THREE.ShaderMaterial

  /** Timestamped control points for the trail */
  private trailPoints: TrailPoint[] = []

  /** The current trail mesh */
  private mesh: THREE.Mesh | null = null

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

    const threeColor = new THREE.Color(color)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: threeColor },
        baseOpacity: { value: 0.35 },
        emissiveBoost: { value: 1.8 },
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float baseOpacity;
        uniform float emissiveBoost;
        varying float vAlpha;
        void main() {
          float finalAlpha = baseOpacity * vAlpha;
          vec3 finalColor = color * emissiveBoost;
          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }

  /**
   * Start the trail at a 3D position
   */
  startNewSegment(position: { x: number; y: number; z: number }): void {
    this.trailPoints.push({
      position: new THREE.Vector3(position.x, position.y, position.z),
      timestamp: performance.now(),
    })
    this.lastPosition = { ...position }
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

    // Calculate distance from last position
    if (this.lastPosition) {
      const dx = newEnd.x - this.lastPosition.x
      const dy = newEnd.y - this.lastPosition.y
      const dz = newEnd.z - this.lastPosition.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      this.distanceSinceLastPoint += distance
    }

    // Add a new control point if we've traveled far enough
    if (this.distanceSinceLastPoint >= POINT_SPACING) {
      this.trailPoints.push({
        position: new THREE.Vector3(newEnd.x, newEnd.y, newEnd.z),
        timestamp: performance.now(),
      })
      this.distanceSinceLastPoint = 0
    }

    this.lastPosition = { ...newEnd }

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
   * Get active trail points, pruning expired ones from the front
   */
  private getActivePoints(currentEnd: { x: number; y: number; z: number }): TrailPoint[] {
    const now = performance.now()
    const maxAge = TRAIL_LIFETIME + TRAIL_FADE_DURATION

    // Filter out fully expired points (but keep at least the most recent one)
    const firstActiveIndex = this.trailPoints.findIndex(
      (p) => (now - p.timestamp) < maxAge
    )

    if (firstActiveIndex > 0) {
      this.trailPoints = this.trailPoints.slice(firstActiveIndex)
    } else if (firstActiveIndex === -1 && this.trailPoints.length > 0) {
      // All points expired -- keep just the last one as an anchor
      this.trailPoints = [this.trailPoints[this.trailPoints.length - 1]]
    }

    // Build the full point list, always including the current end position
    // to prevent the ribbon from stuttering/snapping near the racer
    const allPoints = [...this.trailPoints]

    const endPoint: TrailPoint = {
      position: new THREE.Vector3(currentEnd.x, currentEnd.y, currentEnd.z),
      timestamp: now,
    }

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
   * Rebuild the trail mesh from current points as a ribbon geometry
   */
  private rebuildMesh(currentEnd: { x: number; y: number; z: number }): void {
    // Dispose old mesh geometry
    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.group.remove(this.mesh)
      this.mesh = null
    }

    const allPoints = this.getActivePoints(currentEnd)
    if (allPoints.length < 2) return

    const now = performance.now()
    // 4 vertices per point: left-bottom, left-top, right-bottom, right-top
    // This creates a wall with actual width, visible from all angles
    const vertexCount = allPoints.length * 4
    const positions = new Float32Array(vertexCount * 3)
    const alphas = new Float32Array(vertexCount)

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

      const baseIdx = i * 4

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

    // Build index buffer: for each pair of adjacent points, create
    // 3 quad faces: left wall, right wall, and top cap
    const indices: number[] = []
    for (let i = 0; i < allPoints.length - 1; i++) {
      const a = i * 4       // current point base
      const b = (i + 1) * 4 // next point base
      // Vertex layout per point: 0=LB, 1=LT, 2=RB, 3=RT

      // Left face (facing outward-left)
      indices.push(a + 0, b + 0, a + 1)
      indices.push(a + 1, b + 0, b + 1)

      // Right face (facing outward-right)
      indices.push(a + 2, a + 3, b + 2)
      indices.push(a + 3, b + 3, b + 2)

      // Top cap (facing up)
      indices.push(a + 1, b + 1, a + 3)
      indices.push(a + 3, b + 1, b + 3)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.group.add(this.mesh)
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
    this.material.uniforms.color.value = new THREE.Color(color)
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
    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.group.remove(this.mesh)
      this.mesh = null
    }
    this.trailPoints = []
    this.lastPosition = null
    this.distanceSinceLastPoint = 0
    this.isFadingOut = false

    // Reset material uniforms
    this.material.uniforms.baseOpacity.value = 0.35
  }

  dispose(): void {
    this.clear()
    this.material.dispose()
  }
}
