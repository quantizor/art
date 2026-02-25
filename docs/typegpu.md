# TypeGPU Reference

TypeGPU is a type-safe WebGPU toolkit that enables writing GPU shaders in TypeScript with full type inference.

## Setup

TypeGPU is configured in this project with:
- `typegpu` - Core library
- `@webgpu/types` - TypeScript WebGPU type definitions
- `unplugin-typegpu` - Build plugin for shader transpilation

## Core Concepts

### Roots

Roots are typed wrappers around WebGPU devices that manage resource allocation and lifecycle.

```typescript
import tgpu from 'typegpu'

// Initialize with default device
const root = await tgpu.init()

// From existing device
const root = tgpu.initFromDevice({ device })

// Access underlying device
const device = root.device

// Cleanup
root.destroy()
```

### Data Schemas

```typescript
import * as d from 'typegpu/data'

// Primitives
d.f32    // 32-bit float
d.f16    // 16-bit float
d.u32    // unsigned 32-bit int
d.i32    // signed 32-bit int
d.bool   // boolean

// Vectors (2, 3, 4 components)
d.vec2f, d.vec3f, d.vec4f  // float vectors
d.vec2i, d.vec3i, d.vec4i  // int vectors
d.vec2u, d.vec3u, d.vec4u  // unsigned int vectors
d.vec2h, d.vec3h, d.vec4h  // half-precision vectors

// Matrices
d.mat2x2f, d.mat3x3f, d.mat4x4f  // square float matrices

// Structs
const Particle = d.struct({
  position: d.vec3f,
  velocity: d.vec3f,
  lifetime: d.f32,
})

// Arrays
d.arrayOf(d.vec3f, 100)  // fixed-size array
d.disarrayOf(d.vec3f)    // dynamic array (for vertex layouts)

// Constructors
d.vec3f(1, 2, 3)         // create vector
d.vec3f(1)               // broadcast: (1, 1, 1)
Particle({ position: d.vec3f(0, 0, 0), velocity: d.vec3f(1, 0, 0), lifetime: 5.0 })
```

### Buffers

```typescript
// Create buffer with schema and optional initial value
const positionBuffer = root.createBuffer(d.vec3f, d.vec3f(0, 0, 0))

// Array buffer
const particlesBuffer = root.createBuffer(
  d.arrayOf(Particle, 1000),
  initialParticles
)

// Declare usage flags (required before shader binding)
positionBuffer.$usage('uniform')
particlesBuffer.$usage('storage')

// Available flags: 'uniform', 'storage', 'vertex'

// Write data
positionBuffer.write(d.vec3f(1, 2, 3))

// Read data (async)
const position = await positionBuffer.read()

// Wrap existing GPUBuffer
const typedBuffer = root.createBuffer(d.u32, existingGPUBuffer)
```

### GPU Functions

Functions marked with `'use gpu'` are transpiled to WGSL by the build plugin.

```typescript
import * as std from 'typegpu/std'

// Basic function
const lerp = (a: number, b: number, t: number) => {
  'use gpu'
  return a + (b - a) * t
}

// Vector math (use std namespace)
const normalize = (v: d.Vec3f) => {
  'use gpu'
  return std.normalize(v)
}

// Type inference from call site
const addVectors = (a: d.Vec3f, b: d.Vec3f) => {
  'use gpu'
  return std.add(a, b)  // Inferred as Vec3f
}

// Numeric literals
// - Integers default to i32
// - Decimals default to f32
// - Explicit cast: d.u32(1), d.f16(3.14)
```

### Function Shells (Explicit Signatures)

```typescript
const clampedLerp = tgpu.fn(
  [d.f32, d.f32, d.f32],  // argument types
  d.f32                    // return type
)((a, b, t) => {
  'use gpu'
  return std.clamp(a + (b - a) * t, 0, 1)
})
```

### WGSL Direct Implementation

```typescript
const customFn = tgpu.fn([d.f32, d.f32], d.f32)`
  (a: f32, b: f32) -> f32 {
    return a * b + 0.5;
  }
`
```

### Compute Pipelines

```typescript
// Simple compute pipeline with bounds checking
const pipeline = root['~unstable'].createGuardedComputePipeline((x) => {
  'use gpu'
  // x = global invocation ID
  const value = particlesBuffer[x].position
  outputBuffer[x] = std.length(value)
})

// Execute with exact thread count
pipeline.dispatchThreads(1000)

// With bind groups
pipeline
  .with(bindGroup)
  .dispatchThreads(1000)

// Standard compute pipeline
const computePipeline = root['~unstable']
  .withCompute(computeShader)
  .createPipeline()

computePipeline.dispatchWorkgroups(10, 10, 1)
```

### Render Pipelines

```typescript
const renderPipeline = root['~unstable']
  .withVertex(vertexShader, { position: positionLayout })
  .withFragment(fragmentShader, { format: 'rgba8unorm' })
  .withPrimitive({ topology: 'triangle-list' })
  .createPipeline()

renderPipeline
  .withColorAttachment({
    view: textureView,
    loadOp: 'clear',
    storeOp: 'store',
  })
  .with(vertexLayout, vertexBuffer)
  .draw(3)
```

### Textures

```typescript
const texture = root['~unstable'].createTexture({
  size: [256, 256],
  format: 'rgba8unorm',
  mipLevelCount: 4,
})
  .$usage('sampled', 'render')

// Write from image
const imageBitmap = await createImageBitmap(blob)
texture.write(imageBitmap)

// Generate mipmaps (requires 'sampled' + 'render' usage)
texture.generateMipmaps()

// Create view for shader binding
const view = texture.createView(d.texture2d(d.f32))

// Samplers
const sampler = root['~unstable'].createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})
```

### Vertex Layouts

```typescript
const VertexData = d.struct({
  position: d.location(0, d.vec3f),
  normal: d.location(1, d.vec3f),
  uv: d.location(2, d.vec2f),
})

const vertexLayout = tgpu.vertexLayout(
  d.arrayOf(VertexData),
  'vertex'  // or 'instance'
)

// Loose layouts (bypass alignment, use vertex formats)
const LooseVertex = d.unstruct({
  position: d.location(0, d.vec3f),
  color: d.location(1, d.unorm8x4),  // 8-bit normalized
})

const looseLayout = tgpu.vertexLayout(d.disarrayOf(LooseVertex))
```

### Standard Library (`typegpu/std`)

```typescript
import * as std from 'typegpu/std'

// Math
std.abs, std.sin, std.cos, std.sqrt, std.pow
std.min, std.max, std.clamp, std.mix, std.step

// Vector
std.dot, std.cross, std.normalize, std.length, std.distance
std.reflect, std.refract

// Matrix
std.transpose, std.determinant, std.mul
std.identity2, std.identity3, std.identity4

// Arithmetic (for vectors/matrices)
std.add, std.sub, std.mul, std.div, std.neg

// Comparison
std.eq, std.ne, std.lt, std.le, std.gt, std.ge

// Texture
std.textureSample, std.textureLoad, std.textureStore

// Atomic
std.atomicAdd, std.atomicLoad, std.atomicStore, std.atomicMax

// Barriers
std.workgroupBarrier, std.storageBarrier
```

### Debugging

```typescript
const debugFn = () => {
  'use gpu'
  console.log('Debug from GPU')  // Outputs with [GPU] prefix
}
```

## Do's and Don'ts

| DO | DON'T |
|----|-------|
| Use `'use gpu'` directive for GPU functions | Forget the directive (function won't be transpiled) |
| Use `std.*` functions for vector/matrix math | Use `+`, `-`, `*` operators on vectors (not supported) |
| Use `d.u32()`, `d.f32()` for explicit numeric types | Assume numeric type inference matches your intent |
| Declare `.$usage()` before binding buffers | Bind buffers without usage flags |
| Use `createGuardedComputePipeline` for simple tasks | Create complex pipeline setups for basic computations |
| Use `d.location()` for vertex attributes | Forget location markers (shader won't compile) |
| Use `d.struct()` for aligned data (uniforms/storage) | Use `d.struct()` for vertex buffers (use `d.unstruct()`) |
| Access outer scope values as compile-time constants | Expect outer scope mutations to affect shader |
| Use `AsyncLocalStorage` patterns for context | Pass context manually through deeply nested calls |
