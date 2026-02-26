/**
 * Table Mesh — id1
 *
 * Rosewood table surface with PBR textures:
 * albedo, normal, roughness, and displacement maps.
 */

import * as THREE from 'three'

const TEXTURE_BASE = '/textures/rosewood/rosewood_veneer1'

export function createTable(): THREE.Mesh {
  const loader = new THREE.TextureLoader()

  // Load PBR texture set
  const albedo = loader.load(`${TEXTURE_BASE}_diff_2k.jpg`)
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.wrapS = THREE.RepeatWrapping
  albedo.wrapT = THREE.RepeatWrapping

  const normal = loader.load(`${TEXTURE_BASE}_nor_gl_2k.png`)
  normal.wrapS = THREE.RepeatWrapping
  normal.wrapT = THREE.RepeatWrapping

  const roughness = loader.load(`${TEXTURE_BASE}_rough_2k.png`)
  roughness.wrapS = THREE.RepeatWrapping
  roughness.wrapT = THREE.RepeatWrapping

  const displacement = loader.load(`${TEXTURE_BASE}_disp_2k.png`)
  displacement.wrapS = THREE.RepeatWrapping
  displacement.wrapT = THREE.RepeatWrapping

  // Normal map handles visual grain; displacement only needs moderate subdivisions
  const geometry = new THREE.PlaneGeometry(4, 4, 64, 64)

  const material = new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: normal,
    normalScale: new THREE.Vector2(2, 2),
    roughnessMap: roughness,
    roughness: 1.4,          // multiply against roughness map — pushes toward matte/satin
    displacementMap: displacement,
    displacementScale: 0.08,
    metalness: 0,
    envMapIntensity: 0.3,    // tame environment reflections
  })

  const mesh = new THREE.Mesh(geometry, material)
  // Rotate to lie flat on XZ plane
  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true

  return mesh
}
