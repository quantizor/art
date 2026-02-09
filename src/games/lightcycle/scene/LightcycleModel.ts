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
  private accentMaterials: THREE.MeshStandardMaterial[] = []
  private color: number
  private modelLoaded = false
  private baseY = 0
  private explosionParticles: ExplosionParticle[] = []
  private explosionGroup: THREE.Group | null = null
  private isExploding = false

  constructor(color: number) {
    this.color = color
    this.group = new THREE.Group()

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

      // Clear fallback
      this.disposeFallback()

      // Add loaded model
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
                this.accentMaterials.push(mat)
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

      this.group.add(model)
      this.modelLoaded = true
      console.log('[LightcycleModel] Model setup complete')
    } catch (error) {
      console.warn('[LightcycleModel] Failed to load GLB:', error)
      // Keep fallback geometry
    }
  }

  /**
   * Create simple geometric fallback (looks like a TRON cycle)
   */
  private createFallbackModel(): void {
    // Body - elongated box with glossy piano black finish
    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.4, 2)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.2,
      metalness: 0.9,
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 0.5

    // Front wheel arc (visual only)
    const wheelFrontGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16)
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.25,
      metalness: 0.9,
    })
    const wheelFront = new THREE.Mesh(wheelFrontGeometry, wheelMaterial)
    wheelFront.rotation.z = Math.PI / 2
    wheelFront.position.set(0, 0.4, -0.8)

    // Rear wheel
    const wheelRear = new THREE.Mesh(wheelFrontGeometry, wheelMaterial)
    wheelRear.rotation.z = Math.PI / 2
    wheelRear.position.set(0, 0.4, 0.8)

    // Accent strip (glowing line on top)
    const accentGeometry = new THREE.BoxGeometry(0.1, 0.15, 1.8)
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.5,
    })
    const accent = new THREE.Mesh(accentGeometry, accentMaterial)
    accent.position.y = 0.75
    this.accentMaterials.push(accentMaterial)

    // Side accents
    const sideAccentGeometry = new THREE.BoxGeometry(0.05, 0.1, 1.6)
    const sideLeft = new THREE.Mesh(sideAccentGeometry, accentMaterial.clone())
    sideLeft.position.set(-0.32, 0.5, 0)
    this.accentMaterials.push(sideLeft.material as THREE.MeshStandardMaterial)

    const sideRight = new THREE.Mesh(sideAccentGeometry, accentMaterial.clone())
    sideRight.position.set(0.32, 0.5, 0)
    this.accentMaterials.push(sideRight.material as THREE.MeshStandardMaterial)

    // Front light
    const frontLightGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.05)
    const frontLight = new THREE.Mesh(frontLightGeometry, accentMaterial.clone())
    frontLight.position.set(0, 0.5, -1.02)
    this.accentMaterials.push(frontLight.material as THREE.MeshStandardMaterial)

    this.group.add(body, wheelFront, wheelRear, accent, sideLeft, sideRight, frontLight)
  }

  private disposeFallback(): void {
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
    this.group.clear()
    this.accentMaterials = []
  }

  /**
   * Update position and rotation (uses continuous angle)
   */
  setTransform(position: { x: number; z: number }, angle: number, yOffset: number = 0): void {
    this.group.position.set(position.x, this.baseY + yOffset, position.z)
    this.group.rotation.y = angle
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
  }
}
