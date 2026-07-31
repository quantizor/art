/**
 * TRON-style procedural sky environment.
 *
 * Replaces the old CubeCamera-baked WebGL gradient sphere and its hand-rolled
 * GLSL material. The previous setup rendered a small scene once to bake a cube
 * target; this node instead reads the world-space reflection direction
 * (`reflectVector`) directly, so `Scene.environmentNode` computes the gradient
 * and grid pattern wherever a PBR material samples the environment.
 *
 * Simplification versus the original bake: `EnvironmentNode` normally
 * samples radiance from the view-reflection direction and irradiance from
 * the surface normal, which a texture-based env map honors via its UV
 * context. This node ignores that context and always reads
 * `reflectVector`, so irradiance picks up the same view-angle-dependent
 * tint radiance does. For a slowly-varying decorative sky (height-based
 * color, occasional grid glint) the difference is imperceptible during
 * gameplay.
 */

import { Fn, abs, fract, mix, reflectVector, step, vec3 } from 'three/tsl'

/** 0x000000 - directly overhead */
const TOP_COLOR = vec3(0, 0, 0)
/** 0x002255 - at the horizon */
const HORIZON_COLOR = vec3(0, 0x22 / 255, 0x55 / 255)
/** 0x001133 - directly underfoot */
const BOTTOM_COLOR = vec3(0, 0x11 / 255, 0x33 / 255)
/** Grid-line tint added on top of the sky gradient */
const GRID_TINT = vec3(0, 0.1, 0.2)
/** Matches the radius of the original baked sky sphere, so the grid's spatial frequency is unchanged */
const SKY_RADIUS = 100

export const tronEnvironment = Fn(() => {
  const dir = reflectVector.normalize()
  const h = dir.y

  const upMix = mix(HORIZON_COLOR, TOP_COLOR, h)
  const downMix = mix(HORIZON_COLOR, BOTTOM_COLOR, h.negate())
  const sky = h.greaterThan(0).select(upMix, downMix)

  const worldPos = dir.mul(SKY_RADIUS)
  const absPos = abs(worldPos)
  const grid = step(0.95, fract(absPos.x.mul(0.1))).add(step(0.95, fract(absPos.z.mul(0.1))))

  return sky.add(GRID_TINT.mul(grid).mul(0.3))
})()
