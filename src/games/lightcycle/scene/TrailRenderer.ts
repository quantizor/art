/**
 * Trail Renderer
 *
 * Renders the light wall trails left behind by cycles using a continuous
 * spline-based approach. This eliminates segment joining issues by treating
 * the entire trail as one continuous tube through space.
 */

import * as THREE from 'three'
import { TRAIL_HEIGHT, TRAIL_WIDTH } from '../constants'

/** Minimum distance between control points to avoid degenerate geometry */
const MIN_POINT_DISTANCE = 0.5

/** How often to add new control points (in world units of travel) */
const POINT_SPACING = 2.0

export class TrailRenderer {
  group: THREE.Group
  private color: number
  private material: THREE.MeshStandardMaterial

  /** Control points for the spline */
  private points: THREE.Vector3[] = []

  /** The current trail mesh */
  private mesh: THREE.Mesh | null = null

  /** Track distance since last point for spacing */
  private distanceSinceLastPoint = 0
  private lastPosition: { x: number; z: number } | null = null

  constructor(color: number) {
    this.color = color
    this.group = new THREE.Group()

    // Create ghostly translucent material
    this.material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false, // Helps with transparency sorting
      blending: THREE.AdditiveBlending, // Ghostly glow effect
    })
  }

  /**
   * Start the trail at a position
   */
  startNewSegment(position: { x: number; z: number }): void {
    // Add initial point at ground level
    this.points.push(new THREE.Vector3(position.x, 0, position.z))
    this.lastPosition = { ...position }
    this.distanceSinceLastPoint = 0
  }

  /**
   * Extend the trail to a new position
   */
  extendLastSegment(newEnd: { x: number; z: number }): void {
    if (this.points.length === 0) {
      this.startNewSegment(newEnd)
      return
    }

    // Calculate distance from last position
    if (this.lastPosition) {
      const dx = newEnd.x - this.lastPosition.x
      const dz = newEnd.z - this.lastPosition.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      this.distanceSinceLastPoint += distance
    }

    // Add a new control point if we've traveled far enough
    if (this.distanceSinceLastPoint >= POINT_SPACING) {
      this.points.push(new THREE.Vector3(newEnd.x, 0, newEnd.z))
      this.distanceSinceLastPoint = 0
    }

    this.lastPosition = { ...newEnd }

    // Rebuild the trail mesh
    this.rebuildMesh(newEnd)
  }

  /**
   * Get the end position of the trail
   */
  getLastSegmentEnd(): { x: number; z: number } | null {
    return this.lastPosition ? { ...this.lastPosition } : null
  }

  /**
   * Rebuild the trail mesh from current points
   */
  private rebuildMesh(currentEnd: { x: number; z: number }): void {
    // Dispose old mesh
    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.group.remove(this.mesh)
    }

    // Need at least 2 points for a trail
    const allPoints = [...this.points]

    // Add current position as final point (may not be a control point yet)
    const endPoint = new THREE.Vector3(currentEnd.x, 0, currentEnd.z)
    const lastControlPoint = allPoints[allPoints.length - 1]

    if (lastControlPoint && lastControlPoint.distanceTo(endPoint) > MIN_POINT_DISTANCE) {
      allPoints.push(endPoint)
    }

    if (allPoints.length < 2) return

    // Create the trail geometry using extrusion along the path
    // We use a simple rectangular cross-section
    const path = this.createLinearPath(allPoints)

    // Create cross-section shape (tall thin rectangle)
    const shape = new THREE.Shape()
    const halfWidth = TRAIL_WIDTH / 2
    shape.moveTo(-halfWidth, 0)
    shape.lineTo(halfWidth, 0)
    shape.lineTo(halfWidth, TRAIL_HEIGHT)
    shape.lineTo(-halfWidth, TRAIL_HEIGHT)
    shape.lineTo(-halfWidth, 0)

    // Extrude settings - we'll use frames to orient the cross-section
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: Math.max(2, allPoints.length * 4),
      bevelEnabled: false,
      extrudePath: path,
    }

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.group.add(this.mesh)
  }

  /**
   * Create a path that follows straight lines between points with sharp corners
   * This gives the TRON-style right-angle turns
   */
  private createLinearPath(points: THREE.Vector3[]): THREE.CurvePath<THREE.Vector3> {
    const path = new THREE.CurvePath<THREE.Vector3>()

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]
      const end = points[i + 1]
      path.add(new THREE.LineCurve3(start, end))
    }

    return path
  }

  /**
   * Get all segment bounding boxes for collision detection
   */
  getCollisionBoxes(): THREE.Box3[] {
    if (!this.mesh) return []
    return [new THREE.Box3().setFromObject(this.mesh)]
  }

  /**
   * Check if a point collides with the trail
   * Uses a simplified line segment approach for performance
   */
  checkCollision(point: { x: number; z: number }, margin: number = 0.3): boolean {
    const halfWidth = TRAIL_WIDTH / 2 + margin

    // Check collision against each segment between control points
    for (let i = 0; i < this.points.length - 1; i++) {
      const start = this.points[i]
      const end = this.points[i + 1]

      // Simple AABB check for the segment
      const minX = Math.min(start.x, end.x) - halfWidth
      const maxX = Math.max(start.x, end.x) + halfWidth
      const minZ = Math.min(start.z, end.z) - halfWidth
      const maxZ = Math.max(start.z, end.z) + halfWidth

      if (point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ) {
        return true
      }
    }

    // Also check from last control point to current end
    if (this.lastPosition && this.points.length > 0) {
      const start = this.points[this.points.length - 1]
      const end = this.lastPosition

      const minX = Math.min(start.x, end.x) - halfWidth
      const maxX = Math.max(start.x, end.x) + halfWidth
      const minZ = Math.min(start.z, end.z) - halfWidth
      const maxZ = Math.max(start.z, end.z) + halfWidth

      if (point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ) {
        return true
      }
    }

    return false
  }

  /**
   * Update color
   */
  setColor(color: number): void {
    this.color = color
    const threeColor = new THREE.Color(color)
    this.material.color = threeColor
    this.material.emissive = threeColor
  }

  /**
   * Fade out effect
   */
  fadeOut(duration: number = 1000): Promise<void> {
    return new Promise((resolve) => {
      const startOpacity = this.material.opacity
      const startTime = performance.now()

      const animate = () => {
        const elapsed = performance.now() - startTime
        const progress = Math.min(1, elapsed / duration)

        this.material.opacity = startOpacity * (1 - progress)
        this.material.emissiveIntensity = 0.8 * (1 - progress)

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }

      animate()
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
    this.points = []
    this.lastPosition = null
    this.distanceSinceLastPoint = 0

    // Reset material to ghostly defaults
    this.material.opacity = 0.35
    this.material.emissiveIntensity = 0.8
  }

  dispose(): void {
    this.clear()
    this.material.dispose()
  }
}
