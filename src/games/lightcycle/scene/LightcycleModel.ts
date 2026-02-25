/**
 * Lightcycle Model
 *
 * Loads and manages the GLB lightcycle model.
 * Creates fallback geometry if model fails to load.
 * Applies team color to accent materials.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  JUMP_HEIGHT,
  JUMP_DURATION,
  EXPLOSION_PARTICLE_COUNT,
  EXPLOSION_PARTICLE_SIZE,
  EXPLOSION_DURATION,
  EXPLOSION_VELOCITY,
  EXPLOSION_GRAVITY,
} from '../constants'

interface ExplosionParticle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  rotationSpeed: THREE.Vector3
}

export class LightcycleModel {
  group: THREE.Group
  private fallbackGroup: THREE.Group
  private glbGroup: THREE.Group | null = null
  private fallbackAccentMaterials: THREE.MeshStandardMaterial[] = []
  private glbAccentMaterials: THREE.MeshStandardMaterial[] = []
  private accentMaterials: THREE.MeshStandardMaterial[] = []
  private color: number
  private modelLoaded = false
  private _useFallback = true
  private baseY = 0
  private explosionParticles: ExplosionParticle[] = []
  private explosionGroup: THREE.Group | null = null
  private isExploding = false

  constructor(color: number) {
    this.color = color
    this.group = new THREE.Group()
    this.fallbackGroup = new THREE.Group()
    this.group.add(this.fallbackGroup)

    // Create fallback geometry immediately
    this.createFallbackModel()
  }

  /**
   * Attempt to load GLB model, keep fallback if it fails
   */
  async loadModel(url: string): Promise<void> {
    const loader = new GLTFLoader()

    try {
      console.log('[LightcycleModel] Loading GLB from:', url)
      const gltf = await loader.loadAsync(url)
      console.log('[LightcycleModel] GLB loaded successfully')

      // Store GLB in its own group (keep fallback for toggling)
      this.glbGroup = new THREE.Group()
      const model = gltf.scene

      // Log model structure for debugging
      console.log('[LightcycleModel] Model children:', model.children.length)
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          console.log('[LightcycleModel] Found mesh:', child.name)
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material]

          for (const mat of materials) {
            console.log('[LightcycleModel] Material:', mat.name, mat.type)
            if (mat instanceof THREE.MeshStandardMaterial) {
              // Apply accent color to materials with emissive names
              const name = (mat.name || '').toLowerCase()
              const meshName = (child.name || '').toLowerCase()
              const isAccent = ['accent', 'glow', 'emissive', 'light', 'neon', 'trim', 'stripe'].some(
                (n) => name.includes(n) || meshName.includes(n)
              )

              if (isAccent) {
                console.log('[LightcycleModel] Applying accent to:', mat.name || child.name)
                mat.emissive = new THREE.Color(this.color)
                mat.emissiveIntensity = 1.5
                this.glbAccentMaterials.push(mat)
              } else {
                // Piano black for body
                mat.color = new THREE.Color(0x1a1a1a)
                mat.roughness = 0.2
                mat.metalness = 0.9
              }
            }
          }
        }
      })

      // Scale model up (user said 3x too small)
      model.scale.set(3, 3, 3)

      // Rotate 90 degrees to fix orientation
      model.rotation.y = Math.PI / 2

      // Center the model
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.x = -center.x
      model.position.z = -center.z
      model.position.y = 0

      this.glbGroup.add(model)
      this.group.add(this.glbGroup)
      this.modelLoaded = true

      // Switch to GLB by default when loaded, unless fallback is forced
      if (!this._useFallback) {
        this.fallbackGroup.visible = false
        this.glbGroup.visible = true
        this.accentMaterials = this.glbAccentMaterials
      } else {
        this.glbGroup.visible = false
      }

      console.log('[LightcycleModel] Model setup complete')
    } catch (error) {
      console.warn('[LightcycleModel] Failed to load GLB:', error)
      // Keep fallback geometry
    }
  }

  /**
   * Create detailed sci-fi motorcycle fallback model
   */
  private createFallbackModel(): void {
    // --- Material palette ---
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.2,
      metalness: 0.9,
    })
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.4,
      metalness: 0.7,
    })
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.15,
      metalness: 0.95,
    })
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.3,
      metalness: 0.85,
    })
    const seatMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.6,
      metalness: 0.3,
    })

    const makeAccent = (): THREE.MeshStandardMaterial => {
      const mat = new THREE.MeshStandardMaterial({
        color: this.color,
        emissive: this.color,
        emissiveIntensity: 1.5,
        roughness: 0.2,
        metalness: 0.5,
      })
      this.fallbackAccentMaterials.push(mat)
      return mat
    }

    // --- Wheels (front & rear) ---
    const tireGeo = new THREE.TorusGeometry(0.3, 0.08, 12, 24)
    const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 8)
    const rimGeo = new THREE.TorusGeometry(0.22, 0.015, 8, 24)

    const createWheel = (z: number): THREE.Group => {
      const wheelGroup = new THREE.Group()

      const tire = new THREE.Mesh(tireGeo, tireMat)
      tire.rotation.x = Math.PI / 2
      wheelGroup.add(tire)

      const hub = new THREE.Mesh(hubGeo, hubMat)
      // Hub cylinder axis along Y by default, rotate so it faces sideways
      hub.rotation.x = Math.PI / 2
      wheelGroup.add(hub)

      const rim = new THREE.Mesh(rimGeo, makeAccent())
      rim.rotation.x = Math.PI / 2
      wheelGroup.add(rim)

      wheelGroup.position.set(0, 0.3, z)
      return wheelGroup
    }

    const frontWheel = createWheel(-0.75)
    const rearWheel = createWheel(0.75)

    // --- Frame / Chassis ---
    const hullGeo = new THREE.BoxGeometry(0.5, 0.25, 1.4)
    const hull = new THREE.Mesh(hullGeo, bodyMat)
    hull.position.set(0, 0.55, 0)

    const frontCowlGeo = new THREE.BoxGeometry(0.35, 0.2, 0.4)
    const frontCowl = new THREE.Mesh(frontCowlGeo, bodyMat)
    frontCowl.position.set(0, 0.55, -0.85)
    frontCowl.rotation.x = -0.12 // Slight forward tilt

    const rearCowlGeo = new THREE.BoxGeometry(0.45, 0.2, 0.3)
    const rearCowl = new THREE.Mesh(rearCowlGeo, bodyMat)
    rearCowl.position.set(0, 0.52, 0.7)
    rearCowl.rotation.x = 0.15 // Slope down toward rear

    // --- Front Fork Assembly ---
    const forkGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6)
    const forkAngle = 0.26 // ~15 degrees forward lean

    const forkLeft = new THREE.Mesh(forkGeo, frameMat)
    forkLeft.position.set(-0.08, 0.42, -0.62)
    forkLeft.rotation.x = forkAngle

    const forkRight = new THREE.Mesh(forkGeo, frameMat)
    forkRight.position.set(0.08, 0.42, -0.62)
    forkRight.rotation.x = forkAngle

    // --- Engine Block (sides) ---
    const engineGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8)
    const engineGlowGeo = new THREE.TorusGeometry(0.08, 0.012, 8, 16)

    const engineLeft = new THREE.Mesh(engineGeo, frameMat)
    engineLeft.rotation.z = Math.PI / 2
    engineLeft.position.set(-0.3, 0.4, 0.2)

    const engineRight = new THREE.Mesh(engineGeo, frameMat)
    engineRight.rotation.z = Math.PI / 2
    engineRight.position.set(0.3, 0.4, 0.2)

    // Engine glow rings
    const engineGlowLeft = new THREE.Mesh(engineGlowGeo, makeAccent())
    engineGlowLeft.rotation.y = Math.PI / 2
    engineGlowLeft.position.set(-0.3, 0.4, 0.2)

    const engineGlowRight = new THREE.Mesh(engineGlowGeo, makeAccent())
    engineGlowRight.rotation.y = Math.PI / 2
    engineGlowRight.position.set(0.3, 0.4, 0.2)

    // --- Exhaust Pipes ---
    const exhaustGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6)
    const exhaustTipGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.06, 6)

    const exhaustLeft = new THREE.Mesh(exhaustGeo, frameMat)
    exhaustLeft.rotation.x = Math.PI / 2
    exhaustLeft.position.set(-0.28, 0.35, 0.6)

    const exhaustRight = new THREE.Mesh(exhaustGeo, frameMat)
    exhaustRight.rotation.x = Math.PI / 2
    exhaustRight.position.set(0.28, 0.35, 0.6)

    // Glowing exhaust tips
    const exhaustTipLeft = new THREE.Mesh(exhaustTipGeo, makeAccent())
    exhaustTipLeft.rotation.x = Math.PI / 2
    exhaustTipLeft.position.set(-0.28, 0.35, 0.9)

    const exhaustTipRight = new THREE.Mesh(exhaustTipGeo, makeAccent())
    exhaustTipRight.rotation.x = Math.PI / 2
    exhaustTipRight.position.set(0.28, 0.35, 0.9)

    // --- Windshield ---
    const windshieldGeo = new THREE.PlaneGeometry(0.3, 0.25)
    const windshieldMat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.3,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    })
    this.fallbackAccentMaterials.push(windshieldMat)
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat)
    windshield.position.set(0, 0.72, -0.6)
    windshield.rotation.x = -0.52 // ~30 degrees backward tilt

    // --- Seat ---
    const seatGeo = new THREE.BoxGeometry(0.3, 0.06, 0.5)
    const seat = new THREE.Mesh(seatGeo, seatMat)
    seat.position.set(0, 0.72, 0.1)

    // --- Handlebar ---
    const handlebarGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6)
    const handlebar = new THREE.Mesh(handlebarGeo, frameMat)
    handlebar.rotation.z = Math.PI / 2
    handlebar.position.set(0, 0.7, -0.55)

    // Grips
    const gripGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 6)
    const gripLeft = new THREE.Mesh(gripGeo, seatMat)
    gripLeft.rotation.z = Math.PI / 2
    gripLeft.position.set(-0.19, 0.7, -0.55)

    const gripRight = new THREE.Mesh(gripGeo, seatMat)
    gripRight.rotation.z = Math.PI / 2
    gripRight.position.set(0.19, 0.7, -0.55)

    // --- Accent Lighting ---
    // Headlight
    const headlightGeo = new THREE.BoxGeometry(0.25, 0.06, 0.02)
    const headlight = new THREE.Mesh(headlightGeo, makeAccent())
    headlight.position.set(0, 0.55, -1.0)

    // Tail light
    const taillightGeo = new THREE.BoxGeometry(0.3, 0.04, 0.02)
    const taillight = new THREE.Mesh(taillightGeo, makeAccent())
    taillight.position.set(0, 0.52, 0.95)

    // Top spine
    const spineGeo = new THREE.BoxGeometry(0.06, 0.08, 1.2)
    const spine = new THREE.Mesh(spineGeo, makeAccent())
    spine.position.set(0, 0.72, 0)

    // Side runners
    const sideRunnerGeo = new THREE.BoxGeometry(0.02, 0.06, 1.0)
    const sideRunnerLeft = new THREE.Mesh(sideRunnerGeo, makeAccent())
    sideRunnerLeft.position.set(-0.26, 0.5, 0)

    const sideRunnerRight = new THREE.Mesh(sideRunnerGeo, makeAccent())
    sideRunnerRight.position.set(0.26, 0.5, 0)

    // --- Add all parts to fallback group ---
    this.fallbackGroup.add(
      // Wheels
      frontWheel,
      rearWheel,
      // Chassis
      hull,
      frontCowl,
      rearCowl,
      // Fork
      forkLeft,
      forkRight,
      // Engine
      engineLeft,
      engineRight,
      engineGlowLeft,
      engineGlowRight,
      // Exhaust
      exhaustLeft,
      exhaustRight,
      exhaustTipLeft,
      exhaustTipRight,
      // Windshield
      windshield,
      // Seat
      seat,
      // Handlebar
      handlebar,
      gripLeft,
      gripRight,
      // Accent lighting
      headlight,
      taillight,
      spine,
      sideRunnerLeft,
      sideRunnerRight,
    )

    // Fallback is the active model initially
    this.accentMaterials = this.fallbackAccentMaterials
  }

  /**
   * Toggle between fallback geometry and GLB model
   */
  setFallbackMode(useFallback: boolean): void {
    this._useFallback = useFallback

    if (useFallback) {
      this.fallbackGroup.visible = true
      if (this.glbGroup) this.glbGroup.visible = false
      this.accentMaterials = this.fallbackAccentMaterials
    } else if (this.glbGroup) {
      this.fallbackGroup.visible = false
      this.glbGroup.visible = true
      this.accentMaterials = this.glbAccentMaterials
    }
    // If no GLB loaded, keep fallback visible regardless

    // Re-apply current color to new active materials
    this.setColor(this.color)
  }

  /**
   * Update position and rotation (uses continuous angle)
   */
  setTransform(position: { x: number; z: number }, angle: number, yOffset: number = 0): void {
    this.group.position.set(position.x, this.baseY + yOffset, position.z)
    // Negate angle: movement uses clockwise-from-above convention (sin(θ), -cos(θ))
    // but Three.js rotation.y is counterclockwise (right-hand rule), so we invert
    this.group.rotation.y = -angle
  }

  /**
   * Calculate jump Y offset based on time
   */
  static calculateJumpY(jumpStartTime: number, currentTime: number): number {
    const elapsed = currentTime - jumpStartTime
    if (elapsed >= JUMP_DURATION) return 0

    // Parabolic arc
    const t = elapsed / JUMP_DURATION
    const arc = 4 * t * (1 - t) // Peaks at t=0.5
    return arc * JUMP_HEIGHT
  }

  /**
   * Update accent color (for team changes)
   */
  setColor(color: number): void {
    this.color = color
    const threeColor = new THREE.Color(color)

    for (const mat of this.accentMaterials) {
      mat.color = threeColor
      mat.emissive = threeColor
    }
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  /**
   * 3D pixel explosion effect when derezzed
   */
  explode(scene: THREE.Scene, onComplete: () => void): void {
    if (this.isExploding) return
    this.isExploding = true

    // Hide the cycle model
    this.group.visible = false

    // Create explosion group at cycle position
    this.explosionGroup = new THREE.Group()
    this.explosionGroup.position.copy(this.group.position)
    scene.add(this.explosionGroup)

    // Create particles
    const particleGeometry = new THREE.BoxGeometry(
      EXPLOSION_PARTICLE_SIZE,
      EXPLOSION_PARTICLE_SIZE,
      EXPLOSION_PARTICLE_SIZE
    )

    const particleMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.7,
    })

    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      const mesh = new THREE.Mesh(particleGeometry, particleMaterial.clone())

      // Random position within the cycle bounding box
      mesh.position.set(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 1.0 + 0.2,
        (Math.random() - 0.5) * 2.5
      )

      // Random velocity outward
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * EXPLOSION_VELOCITY,
        Math.random() * EXPLOSION_VELOCITY * 0.8 + EXPLOSION_VELOCITY * 0.5,
        (Math.random() - 0.5) * EXPLOSION_VELOCITY
      )

      // Random rotation speed
      const rotationSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      )

      this.explosionGroup.add(mesh)
      this.explosionParticles.push({ mesh, velocity, rotationSpeed })
    }

    // Animate explosion
    const startTime = performance.now()

    const animateExplosion = () => {
      const elapsed = performance.now() - startTime
      const progress = elapsed / EXPLOSION_DURATION

      if (progress >= 1) {
        // Cleanup explosion
        this.cleanupExplosion(scene)
        onComplete()
        return
      }

      const dt = 1 / 60 // Approximate frame time

      for (const particle of this.explosionParticles) {
        // Apply gravity
        particle.velocity.y -= EXPLOSION_GRAVITY * dt

        // Update position
        particle.mesh.position.add(particle.velocity.clone().multiplyScalar(dt))

        // Update rotation
        particle.mesh.rotation.x += particle.rotationSpeed.x * dt
        particle.mesh.rotation.y += particle.rotationSpeed.y * dt
        particle.mesh.rotation.z += particle.rotationSpeed.z * dt

        // Fade out
        const material = particle.mesh.material as THREE.MeshStandardMaterial
        material.opacity = 1 - progress
        material.transparent = true
        material.emissiveIntensity = 2.0 * (1 - progress)

        // Shrink slightly
        const scale = 1 - progress * 0.5
        particle.mesh.scale.setScalar(scale)
      }

      requestAnimationFrame(animateExplosion)
    }

    requestAnimationFrame(animateExplosion)
  }

  private cleanupExplosion(scene: THREE.Scene): void {
    if (this.explosionGroup) {
      for (const particle of this.explosionParticles) {
        particle.mesh.geometry.dispose()
        ;(particle.mesh.material as THREE.Material).dispose()
      }
      scene.remove(this.explosionGroup)
      this.explosionGroup = null
    }
    this.explosionParticles = []
    this.isExploding = false
  }

  /**
   * Legacy flash effect (kept for fallback)
   */
  flash(onComplete: () => void): void {
    let flashes = 0
    const maxFlashes = 6
    const interval = setInterval(() => {
      this.group.visible = !this.group.visible
      flashes++
      if (flashes >= maxFlashes) {
        clearInterval(interval)
        this.group.visible = false
        onComplete()
      }
    }, 80)
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    this.accentMaterials = []
    this.fallbackAccentMaterials = []
    this.glbAccentMaterials = []
  }
}
