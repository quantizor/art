/**
 * Camera Controller
 *
 * Manages camera positioning for different view modes.
 * Handles smooth interpolation between positions.
 */

import * as THREE from 'three'
import { CAMERA_CONFIG, DIRECTION_TO_ANGLE } from '../constants'
import type { CameraMode, GridDirection } from '../types'

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private targetPosition: THREE.Vector3
  private targetLookAt: THREE.Vector3
  private currentLookAt: THREE.Vector3

  /** Smoothing factor for camera movement (0-1, lower = smoother) */
  private smoothing = 0.1

  /** Mouse look offset (yaw, pitch) in radians */
  private mouseLookOffset = { yaw: 0, pitch: 0 }
  /** Maximum mouse look angle */
  private maxMouseLook = { yaw: Math.PI * 0.4, pitch: Math.PI * 0.15 }
  /** Whether mouse look is active */
  private mouseLookActive = false
  /** Canvas element for mouse events */
  private canvas: HTMLCanvasElement | null = null

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.targetPosition = new THREE.Vector3()
    this.targetLookAt = new THREE.Vector3()
    this.currentLookAt = new THREE.Vector3()
  }

  /**
   * Initialize mouse look controls
   */
  initMouseLook(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    canvas.addEventListener('mousedown', this.handleMouseDown)
    canvas.addEventListener('mouseup', this.handleMouseUp)
    canvas.addEventListener('mouseleave', this.handleMouseUp)
    canvas.addEventListener('mousemove', this.handleMouseMove)
  }

  private handleMouseDown = (e: MouseEvent): void => {
    // Right mouse button or middle button for look
    if (e.button === 2 || e.button === 1) {
      e.preventDefault()
      this.mouseLookActive = true
    }
  }

  private handleMouseUp = (): void => {
    this.mouseLookActive = false
    // Smoothly reset look offset
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.mouseLookActive || !this.canvas) return

    // Calculate relative movement from center
    const rect = this.canvas.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const relX = (e.clientX - rect.left - centerX) / centerX
    const relY = (e.clientY - rect.top - centerY) / centerY

    // Apply to offset with limits
    this.mouseLookOffset.yaw = relX * this.maxMouseLook.yaw
    this.mouseLookOffset.pitch = -relY * this.maxMouseLook.pitch
  }

  /**
   * Reset mouse look offset gradually
   */
  private decayMouseLook(deltaTime: number): void {
    if (this.mouseLookActive) return

    const decay = 0.1 * deltaTime * 60
    this.mouseLookOffset.yaw *= 1 - decay
    this.mouseLookOffset.pitch *= 1 - decay

    // Snap to zero when very small
    if (Math.abs(this.mouseLookOffset.yaw) < 0.001) this.mouseLookOffset.yaw = 0
    if (Math.abs(this.mouseLookOffset.pitch) < 0.001) this.mouseLookOffset.pitch = 0
  }

  /**
   * Calculate target camera position/rotation for given mode (using angle)
   */
  update(
    mode: CameraMode,
    cyclePosition: { x: number; z: number },
    angle: number,
    deltaTime: number
  ): void {
    switch (mode) {
      case 'firstPerson':
        this.updateFirstPerson(cyclePosition, angle)
        break
      case 'thirdPerson':
        this.updateThirdPerson(cyclePosition, angle)
        break
      case 'topDown':
        this.updateTopDown(cyclePosition, angle)
        break
    }

    // Decay mouse look when not active
    this.decayMouseLook(deltaTime)

    // Apply mouse look offset to target look position (not in top-down)
    if (mode !== 'topDown' && (this.mouseLookOffset.yaw !== 0 || this.mouseLookOffset.pitch !== 0)) {
      const lookDir = this.targetLookAt.clone().sub(this.targetPosition).normalize()
      const yaw = this.mouseLookOffset.yaw
      const pitch = this.mouseLookOffset.pitch

      // Rotate around Y axis (yaw)
      const cosYaw = Math.cos(yaw)
      const sinYaw = Math.sin(yaw)
      const rotatedX = lookDir.x * cosYaw - lookDir.z * sinYaw
      const rotatedZ = lookDir.x * sinYaw + lookDir.z * cosYaw

      // Apply pitch (tilt up/down)
      const newY = lookDir.y + pitch * 10

      lookDir.set(rotatedX, newY, rotatedZ).normalize()

      // Update target look position
      const lookDistance = this.targetLookAt.distanceTo(this.targetPosition)
      this.targetLookAt.copy(this.targetPosition).add(lookDir.multiplyScalar(lookDistance))
    }

    // Smooth interpolation
    const lerpFactor = Math.min(1, this.smoothing * deltaTime * 60)
    this.camera.position.lerp(this.targetPosition, lerpFactor)
    this.currentLookAt.lerp(this.targetLookAt, lerpFactor)
    this.camera.lookAt(this.currentLookAt)
  }

  private updateFirstPerson(
    position: { x: number; z: number },
    rotation: number
  ): void {
    const config = CAMERA_CONFIG.firstPerson

    // Camera sits at cycle position, slightly elevated
    this.targetPosition.set(
      position.x,
      config.offsetY,
      position.z
    )

    // Look forward in direction of travel
    const lookDistance = 20
    this.targetLookAt.set(
      position.x + Math.sin(rotation) * lookDistance,
      1,
      position.z - Math.cos(rotation) * lookDistance
    )

    this.camera.fov = config.fov
    this.camera.updateProjectionMatrix()
  }

  private updateThirdPerson(
    position: { x: number; z: number },
    rotation: number
  ): void {
    const config = CAMERA_CONFIG.thirdPerson

    // Camera behind and above the cycle
    this.targetPosition.set(
      position.x - Math.sin(rotation) * Math.abs(config.offsetZ),
      config.offsetY,
      position.z + Math.cos(rotation) * Math.abs(config.offsetZ)
    )

    // Look at cycle position
    this.targetLookAt.set(position.x, 1, position.z)

    this.camera.fov = config.fov
    this.camera.updateProjectionMatrix()
  }

  private updateTopDown(
    position: { x: number; z: number },
    rotation: number
  ): void {
    const config = CAMERA_CONFIG.topDown

    // Camera directly above, oriented with cycle direction
    this.targetPosition.set(
      position.x,
      config.height,
      position.z
    )

    // Look straight down
    this.targetLookAt.set(position.x, 0, position.z)

    this.camera.fov = config.fov
    this.camera.updateProjectionMatrix()

    // Rotate camera to match cycle orientation
    this.camera.up.set(
      Math.sin(rotation),
      0,
      -Math.cos(rotation)
    )
  }

  /**
   * Snap camera to position immediately (no interpolation)
   */
  snapTo(
    mode: CameraMode,
    cyclePosition: { x: number; z: number },
    directionOrAngle: GridDirection | number
  ): void {
    const angle =
      typeof directionOrAngle === 'number'
        ? directionOrAngle
        : DIRECTION_TO_ANGLE[directionOrAngle]

    switch (mode) {
      case 'firstPerson':
        this.updateFirstPerson(cyclePosition, angle)
        break
      case 'thirdPerson':
        this.updateThirdPerson(cyclePosition, angle)
        break
      case 'topDown':
        this.updateTopDown(cyclePosition, angle)
        break
    }

    this.camera.position.copy(this.targetPosition)
    this.currentLookAt.copy(this.targetLookAt)
    this.camera.lookAt(this.currentLookAt)
  }

  /**
   * Set smoothing factor
   */
  setSmoothing(value: number): void {
    this.smoothing = Math.max(0.01, Math.min(1, value))
  }

  /**
   * Cleanup mouse event listeners
   */
  dispose(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown)
      this.canvas.removeEventListener('mouseup', this.handleMouseUp)
      this.canvas.removeEventListener('mouseleave', this.handleMouseUp)
      this.canvas.removeEventListener('mousemove', this.handleMouseMove)
      this.canvas = null
    }
  }
}
