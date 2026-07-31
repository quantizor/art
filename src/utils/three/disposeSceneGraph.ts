import { Texture } from 'three/webgpu'
import type { Material, Object3D } from 'three/webgpu'
import { isLineSegments, isMesh } from './typeGuards'

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose()
  }
  material.dispose()
}

/**
 * Releases geometry, materials, and material-owned textures below `root`.
 * Scene-level resources such as environment maps remain the owner's
 * responsibility because those resources need not belong to a graph node.
 */
export function disposeSceneGraph(root: Object3D): void {
  root.traverse((object) => {
    if (!isMesh(object) && !isLineSegments(object)) return

    object.geometry.dispose()
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) disposeMaterial(material)
  })
}
