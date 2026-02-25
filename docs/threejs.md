# Three.js Reference

Three.js is a 3D graphics library that abstracts WebGL, providing scene graphs, materials, lights, cameras, and more.

## Core Architecture

```
Renderer -> Scene -> Mesh (Geometry + Material)
                  -> Light
```

Children inherit parent transforms. Use `Object3D` for grouping.

## Basic Setup

```typescript
import * as THREE from 'three'

// Renderer
const canvas = document.querySelector('#canvas') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })

// Scene
const scene = new THREE.Scene()

// Camera
const fov = 75                    // Field of view (degrees, vertical)
const aspect = canvas.clientWidth / canvas.clientHeight
const near = 0.1                  // Near clipping plane
const far = 1000                  // Far clipping plane
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
camera.position.z = 5

// Mesh = Geometry + Material
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshPhongMaterial({ color: 0x44aa88 })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// Light (required for MeshPhongMaterial)
const light = new THREE.DirectionalLight(0xffffff, 3)
light.position.set(-1, 2, 4)
scene.add(light)

// Animation loop
function animate(time: number) {
  time *= 0.001  // Convert to seconds
  cube.rotation.x = time
  cube.rotation.y = time
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
```

## Responsive Canvas

```typescript
function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer): boolean {
  const canvas = renderer.domElement
  const pixelRatio = window.devicePixelRatio
  const width = Math.floor(canvas.clientWidth * pixelRatio)
  const height = Math.floor(canvas.clientHeight * pixelRatio)
  const needResize = canvas.width !== width || canvas.height !== height
  if (needResize) {
    renderer.setSize(width, height, false)  // false = don't set CSS
  }
  return needResize
}

function animate(time: number) {
  if (resizeRendererToDisplaySize(renderer)) {
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    camera.updateProjectionMatrix()
  }
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
```

## Camera Types

```typescript
// Perspective (3D depth)
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

// Orthographic (2D/isometric)
const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far)
camera.zoom = 1
camera.updateProjectionMatrix()  // Required after changing properties
```

## Common Geometries

```typescript
new THREE.BoxGeometry(width, height, depth)
new THREE.SphereGeometry(radius, widthSegments, heightSegments)
new THREE.PlaneGeometry(width, height)
new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
new THREE.ConeGeometry(radius, height, radialSegments)
new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)
new THREE.CircleGeometry(radius, segments)
new THREE.RingGeometry(innerRadius, outerRadius, segments)
```

## Materials

```typescript
// Performance: Basic > Lambert > Phong > Standard > Physical

// Not affected by lights
new THREE.MeshBasicMaterial({ color: 0xff0000 })

// Light at vertices only (fast)
new THREE.MeshLambertMaterial({ color: 0xff0000 })

// Light per pixel, specular highlights
new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 30 })

// PBR material
new THREE.MeshStandardMaterial({
  color: 0xff0000,
  roughness: 0.5,  // 0 = mirror, 1 = diffuse
  metalness: 0.5,  // 0 = plastic, 1 = metal
})

// PBR with clearcoat
new THREE.MeshPhysicalMaterial({
  color: 0xff0000,
  roughness: 0.5,
  metalness: 0.5,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
})

// Common options
material.side = THREE.DoubleSide  // Render both sides
material.flatShading = true       // Faceted appearance
material.transparent = true
material.opacity = 0.5
```

## Setting Colors

```typescript
material.color.set(0x00ffff)              // Hex
material.color.set('purple')              // CSS name
material.color.set('rgb(255, 127, 64)')   // RGB
material.color.set('hsl(180, 50%, 25%)')  // HSL
material.color.setHSL(0.5, 1, 0.5)        // HSL (0-1 range)
```

## Light Types

```typescript
// Ambient - even lighting everywhere
new THREE.AmbientLight(color, intensity)

// Hemisphere - sky/ground gradient
new THREE.HemisphereLight(skyColor, groundColor, intensity)

// Directional - parallel rays (sun)
const light = new THREE.DirectionalLight(color, intensity)
light.position.set(x, y, z)
light.target.position.set(x, y, z)
scene.add(light.target)  // Must add target to scene

// Point - radiates from point (bulb)
const light = new THREE.PointLight(color, intensity)
light.position.set(x, y, z)
light.distance = 0  // 0 = infinite

// Spot - cone of light
const light = new THREE.SpotLight(color, intensity)
light.angle = Math.PI / 4        // Cone angle (radians)
light.penumbra = 0.5             // Edge softness (0-1)
scene.add(light.target)

// RectArea - rectangular panel (requires RectAreaLightUniformsLib)
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
RectAreaLightUniformsLib.init()
new THREE.RectAreaLight(color, intensity, width, height)
```

## Textures

```typescript
const loader = new THREE.TextureLoader()

// Basic loading
const texture = loader.load('path/to/texture.jpg')
texture.colorSpace = THREE.SRGBColorSpace  // For color textures
const material = new THREE.MeshBasicMaterial({ map: texture })

// With loading manager (for multiple textures)
const loadManager = new THREE.LoadingManager()
const loader = new THREE.TextureLoader(loadManager)

loadManager.onLoad = () => {
  // All textures loaded
}
loadManager.onProgress = (url, loaded, total) => {
  console.log(`${loaded}/${total} loaded`)
}

// Texture properties
texture.wrapS = THREE.RepeatWrapping
texture.wrapT = THREE.RepeatWrapping
texture.repeat.set(4, 2)           // Repeat 4x horizontal, 2x vertical
texture.offset.set(0.5, 0.25)      // Offset by half/quarter
texture.center.set(0.5, 0.5)       // Rotation center
texture.rotation = Math.PI / 4     // Rotate 45 degrees

// Filtering
texture.magFilter = THREE.LinearFilter    // When enlarged (smooth)
texture.minFilter = THREE.LinearMipmapLinearFilter  // When shrunk (best quality)
```

## Scene Graph & Hierarchy

```typescript
// Object3D for grouping (no geometry/material)
const group = new THREE.Object3D()
scene.add(group)

group.add(mesh1)
group.add(mesh2)

// Children inherit parent transforms
group.position.set(5, 0, 0)  // Both meshes move
group.rotation.y = Math.PI   // Both meshes rotate

// Access children
group.children.forEach(child => { ... })
const found = group.getObjectByName('myMesh')

// World position (after all parent transforms)
const worldPos = new THREE.Vector3()
mesh.getWorldPosition(worldPos)
```

## OrbitControls

```typescript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0, 0)  // Look-at point
controls.enableDamping = true  // Smooth motion
controls.dampingFactor = 0.05
controls.update()  // Required after manual camera changes

// In animation loop (if damping enabled)
function animate() {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
```

## Loading GLTF Models

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()

loader.load('model.gltf', (gltf) => {
  const model = gltf.scene
  scene.add(model)

  // Enable shadows on all meshes
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
})

// Find objects by name
const part = model.getObjectByName('PartName')
```

## Shadows

```typescript
// Enable on renderer
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// Light must cast shadows
const light = new THREE.DirectionalLight(0xffffff, 1)
light.castShadow = true
light.shadow.mapSize.width = 2048
light.shadow.mapSize.height = 2048
light.shadow.camera.near = 0.5
light.shadow.camera.far = 500

// Objects cast/receive shadows
mesh.castShadow = true
floor.receiveShadow = true
```

## Resource Cleanup

```typescript
// Dispose individual resources
geometry.dispose()
material.dispose()
texture.dispose()

// Remove from scene
scene.remove(mesh)

// ResourceTracker pattern for complex scenes
class ResourceTracker {
  resources = new Set<THREE.Object3D | { dispose(): void }>()

  track<T>(resource: T): T {
    if (resource instanceof THREE.Object3D) {
      this.resources.add(resource)
      this.track((resource as THREE.Mesh).geometry)
      this.track((resource as THREE.Mesh).material)
    } else if (resource && typeof (resource as { dispose?: () => void }).dispose === 'function') {
      this.resources.add(resource as { dispose(): void })
    }
    return resource
  }

  dispose() {
    for (const resource of this.resources) {
      if (resource instanceof THREE.Object3D && resource.parent) {
        resource.parent.remove(resource)
      }
      if ('dispose' in resource) {
        resource.dispose()
      }
    }
    this.resources.clear()
  }
}
```

## On-Demand Rendering

```typescript
let renderRequested = false

function render() {
  renderRequested = false
  controls.update()
  renderer.render(scene, camera)
}

function requestRender() {
  if (!renderRequested) {
    renderRequested = true
    requestAnimationFrame(render)
  }
}

// Render on changes only
controls.addEventListener('change', requestRender)
window.addEventListener('resize', requestRender)
render()  // Initial render
```

## Do's and Don'ts

| DO | DON'T |
|----|-------|
| Call `camera.updateProjectionMatrix()` after changing camera params | Forget to update projection matrix (changes won't apply) |
| Use `MeshStandardMaterial` for realistic PBR rendering | Use `MeshPhongMaterial` for PBR scenes (wrong lighting model) |
| Dispose geometries, materials, textures when done | Let resources accumulate (causes memory leaks) |
| Use `texture.colorSpace = THREE.SRGBColorSpace` for color textures | Leave color space default (washed out colors) |
| Set `material.side = THREE.DoubleSide` for 2D planes | Render single-sided planes that disappear from behind |
| Add `light.target` to scene for directional/spot lights | Forget to add target (light direction won't update) |
| Use `controls.update()` in loop when `enableDamping` is true | Skip update (damping animation won't work) |
| Check `resizeRendererToDisplaySize` each frame | Ignore canvas resize (distorted aspect ratio) |
| Use `Object3D` for grouping transforms | Apply complex math instead of using hierarchy |
| Set `near`/`far` as tight as possible | Use extreme values like 0.0001 and 1000000 (z-fighting) |
