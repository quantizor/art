/**
 * Shared WebGPU renderer factory.
 *
 * `WebGPURenderer` silently falls back to a WebGL2 backend when
 * `navigator.gpu` is unavailable (see `WebGPUBackendParameters.getFallback`
 * in three's source). This factory refuses that fallback: it checks GPU
 * availability up front and re-asserts the backend after `init()` so a
 * scene never renders WebGL2 under a name that promises WebGPU.
 *
 * Deliberately does not import `three/addons/capabilities/WebGPU.js`.
 * That module has a top-level `await navigator.gpu.requestAdapter()` call,
 * which would block module evaluation and duplicate the check below.
 */

import { WebGPURenderer } from 'three/webgpu'
import type { WebGPURendererParameters } from 'three/webgpu'

export interface GpuRendererOptions {
  alpha?: boolean
  antialias?: boolean
  powerPreference?: 'high-performance' | 'low-power'
  signal?: AbortSignal
}

export interface GpuRendererHandle {
  renderer: WebGPURenderer
  /** Releases GPU resources held by the renderer. */
  dispose: () => void
}

/** True when the current environment exposes the WebGPU API at all. */
export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/**
 * Creates and initializes a `WebGPURenderer` bound to `canvas`, throwing
 * if the environment cannot provide a genuine WebGPU backend.
 */
export async function createGpuRenderer(
  canvas: HTMLCanvasElement,
  options: GpuRendererOptions = {},
): Promise<GpuRendererHandle> {
  if (!isWebGpuAvailable()) {
    throw new Error(
      'WebGPU is unavailable in this browser (navigator.gpu is missing). ' +
        'This scene requires a WebGPU-capable browser and will not run on the WebGL fallback.',
    )
  }

  if (options.signal?.aborted) {
    throw new DOMException('WebGPU initialization was aborted', 'AbortError')
  }

  const parameters: WebGPURendererParameters = {
    canvas,
    alpha: options.alpha ?? false,
    antialias: options.antialias ?? true,
    powerPreference: options.powerPreference ?? 'high-performance',
  }

  const renderer = new WebGPURenderer(parameters)
  await renderer.init()

  if (options.signal?.aborted) {
    renderer.dispose()
    throw new DOMException('WebGPU initialization was aborted', 'AbortError')
  }

  const { backend } = renderer
  if (!('isWebGPUBackend' in backend) || backend.isWebGPUBackend !== true) {
    renderer.dispose()
    throw new Error(
      'WebGPURenderer initialized with a non-WebGPU backend (renderer.backend.isWebGPUBackend !== true). ' +
        'This usually means the device rejected the WebGPU adapter request.',
    )
  }

  return {
    renderer,
    dispose: () => renderer.dispose(),
  }
}

/** Snapshot of renderer.info.memory, useful for regression-testing resource leaks. */
export interface GpuAuditSnapshot {
  geometries: number
  renderTargets: number
  textures: number
  totalBytes: number
}

/** Structural subset of `Renderer` needed by `gpuAudit`, kept narrow so it is testable without a live GPU. */
interface RendererInfoLike {
  info: {
    memory: {
      geometries: number
      renderTargets: number
      textures: number
      total: number
    }
  }
}

/** Captures a point-in-time snapshot of the renderer's GPU memory accounting. */
export function gpuAudit(renderer: RendererInfoLike): GpuAuditSnapshot {
  const { memory } = renderer.info
  return {
    geometries: memory.geometries,
    renderTargets: memory.renderTargets,
    textures: memory.textures,
    totalBytes: memory.total,
  }
}
