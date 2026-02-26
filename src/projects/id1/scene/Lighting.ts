/**
 * Lighting — id1
 *
 * Dark room lighting: one dramatic key spot from above-right,
 * one subtle rect area fill from the left. No ambient.
 */

import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'

export interface SceneLights {
  keyLight: THREE.SpotLight
  fillLight: THREE.RectAreaLight
}

export function createLighting(scene: THREE.Scene): SceneLights {
  RectAreaLightUniformsLib.init()

  // Key light — warm spot from above-right
  const keyLight = new THREE.SpotLight(
    0xfff0e0,      // warm white
    8,             // intensity
    20,            // distance
    Math.PI / 6,   // cone angle (30°)
    0.5,           // penumbra (soft edge)
    1,             // decay
  )
  keyLight.position.set(0.5, 3, -3)
  keyLight.target.position.set(0, 0, 0)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.width = 2048
  keyLight.shadow.mapSize.height = 2048
  keyLight.shadow.camera.near = 0.5
  keyLight.shadow.camera.far = 10
  keyLight.shadow.bias = -0.0001
  keyLight.shadow.radius = 8

  scene.add(keyLight)
  scene.add(keyLight.target)

  // Fill light — cool rect area from the left, very low
  const fillLight = new THREE.RectAreaLight(
    0xc0d8ff,   // cool blue-white
    0.3,         // very subtle
    2,           // width
    2,           // height
  )
  fillLight.position.set(-2.5, 1.5, 0)
  fillLight.lookAt(0, 0.3, 0)
  scene.add(fillLight)

  return { keyLight, fillLight }
}
