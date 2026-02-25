/**
 * Walker Compiler
 *
 * Generates a JIT-compiled step function with all grid constants inlined.
 * The V8 JIT sees pure integer math — no config lookups, no type guards.
 */

import type { StepFunction } from '../types'

interface CompileConfig {
  gridW: number
  gridH: number
  stepsPerFrame: number
}

/**
 * Compile a specialized walker step function.
 *
 * The generated function walks all active walkers for `stepsPerFrame` steps,
 * checking 4-connected neighbors at each position. When a walker lands adjacent
 * to an occupied cell, it sticks (freezes), writes to the grid, and fires onStick.
 */
export function compileStepFunction(config: CompileConfig): StepFunction {
  const { gridW, gridH, stepsPerFrame } = config

  // Generate the function body with constants inlined
  const body = `
    var random = Math.random;
    for (var w = 0; w < count; w++) {
      if (!walkerActive[w]) continue;
      var x = walkerX[w], y = walkerY[w];
      var bx = biasX[w], by = biasY[w];
      for (var s = 0; s < ${stepsPerFrame}; s++) {
        x += (random() - 0.5 + bx) * stepSize;
        y += (random() - 0.5 + by) * stepSize;
        var cx = (x) | 0;
        var cy = (y) | 0;
        if (cx < 1 || cx >= ${gridW - 1} || cy < 1 || cy >= ${gridH - 1}) {
          walkerActive[w] = 0;
          break;
        }
        var idx = cy * ${gridW} + cx;
        if (grid[idx - 1] | grid[idx + 1] | grid[idx - ${gridW}] | grid[idx + ${gridW}]) {
          grid[idx] = walkerSeedId[w];
          walkerActive[w] = 0;
          onStick(w, cx, cy, walkerSeedId[w]);
          break;
        }
      }
      if (walkerActive[w]) {
        walkerX[w] = x;
        walkerY[w] = y;
      }
    }
  `

  // eslint-disable-next-line no-new-func
  return new Function(
    'walkerX',
    'walkerY',
    'walkerActive',
    'walkerSeedId',
    'grid',
    'count',
    'stepSize',
    'biasX',
    'biasY',
    'onStick',
    body
  ) as StepFunction
}
