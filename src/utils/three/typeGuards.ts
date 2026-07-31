/**
 * Object3D type guards.
 *
 * Three.js tags renderable subclasses with an own `isX: true` property
 * (e.g. `Mesh.isMesh`) in addition to the class hierarchy. Prefer these
 * guards over `instanceof` when traversing a scene graph to dispose
 * resources: `instanceof` can give a false negative if an addon or a
 * duplicated dependency ends up holding a different module instance of
 * the same class.
 */

import type { LineSegments, Material, Mesh, MeshStandardMaterial, Object3D } from 'three/webgpu'

/** True when `object` is (or behaves like) a `Mesh`. */
export function isMesh(object: Object3D): object is Mesh {
  return 'isMesh' in object && object.isMesh === true
}

/** True when `object` is (or behaves like) a `LineSegments`. */
export function isLineSegments(object: Object3D): object is LineSegments {
  return 'isLineSegments' in object && object.isLineSegments === true
}

/** True when `material` is (or behaves like) a `MeshStandardMaterial`. */
export function isMeshStandardMaterial(material: Material): material is MeshStandardMaterial {
  return 'isMeshStandardMaterial' in material && material.isMeshStandardMaterial === true
}
