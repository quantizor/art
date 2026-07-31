import { z } from 'zod'

/** Persisted camera pose for id1: eye position plus orbit target, both in world units. */
const cameraStateSchema = z.object({
  px: z.number().finite(),
  py: z.number().finite(),
  pz: z.number().finite(),
  tx: z.number().finite(),
  ty: z.number().finite(),
  tz: z.number().finite(),
})

export type CameraState = z.infer<typeof cameraStateSchema>

/**
 * Parse a persisted camera state from localStorage, returning null for
 * anything that isn't valid JSON or doesn't match the six-finite-number
 * shape (missing keys, wrong types, NaN, or infinities).
 */
export function parseCameraState(raw: string | null): CameraState | null {
  if (raw == null) return null

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }

  const result = cameraStateSchema.safeParse(json)
  return result.success ? result.data : null
}

/** Serialize a finite camera pose, returning null instead of persisting invalid state. */
export function serializeCameraState(state: CameraState): string | null {
  const result = cameraStateSchema.safeParse(state)
  return result.success ? JSON.stringify(result.data) : null
}
