/**
 * Glass Torus — id1
 *
 * Small glass torus with intense chromatic dispersion.
 * High IOR (lead crystal) + dispersion for prismatic rainbow fringing.
 */

import * as THREE from 'three'

export function createGlassTorus(): THREE.Mesh {
  // Small torus — ring radius 0.16, tube radius 0.07
  const geometry = new THREE.TorusGeometry(0.16, 0.07, 32, 64)

  const material = new THREE.MeshPhysicalMaterial({
    transmission: 1.0,
    roughness: 0.0,
    ior: 1.9,               // lead crystal — high refraction
    thickness: 0.2,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    dispersion: 0.6,        // intense chromatic dispersion
    attenuationColor: new THREE.Color(0xffffff),
    attenuationDistance: 0.8,
    metalness: 0,
    color: new THREE.Color(0xffffff),
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = 0.35    // hover above the table
  mesh.castShadow = true

  return mesh
}
