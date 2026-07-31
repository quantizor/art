import type { Node, Scene } from 'three/webgpu'

/** Sets a TSL node as the scene's image-based-lighting environment. */
export function setEnvironmentNode(scene: Scene, node: Node<'vec3'>): void {
  scene.environmentNode = node
}
