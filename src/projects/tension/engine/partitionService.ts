/**
 * Partition service — main-thread wrapper around the partition worker.
 *
 * Runs cavity partition + wall-distance transform off the main thread
 * so the dissolve animation stays smooth through the handoff to the
 * growing phase.
 */

import type { Seed } from '../types'
import { isPartitionResponse } from './partitionProtocol'
import type { PartitionRequest } from './partitionProtocol'

let worker: Worker | null = null
interface PendingPartition {
  reject: (error: Error) => void
  resolve: (result: { gridData: Uint16Array; wallDist: Uint16Array }) => void
}
const pending = new Map<number, PendingPartition>()
let nextId = 0

function rejectAllPending(message: string): void {
  const error = new Error(message)
  for (const { reject } of pending.values()) reject(error)
  pending.clear()
}

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./partitionWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (evt: MessageEvent<unknown>) => {
    const data = evt.data
    if (!isPartitionResponse(data)) {
      rejectAllPending(
        'Partition worker returned a malformed response; retry the generation.',
      )
      return
    }
    const request = pending.get(data.id)
    if (!request) return
    pending.delete(data.id)
    request.resolve({
      gridData: new Uint16Array(data.gridBuffer),
      wallDist: new Uint16Array(data.wallBuffer),
    })
  }
  worker.onerror = () => {
    rejectAllPending('Partition worker failed; retry the generation.')
  }
  return worker
}

export function runPartition(
  seeds: Seed[],
  W: number,
  H: number,
  noiseScale: number,
  warpStrength: number
): Promise<{ gridData: Uint16Array; wallDist: Uint16Array }> {
  const w = ensureWorker()
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { reject, resolve })
    const req: PartitionRequest = {
      type: 'partition-request',
      id,
      seeds: seeds.slice(),
      W,
      H,
      noiseScale,
      warpStrength,
    }
    w.postMessage(req)
  })
}
