import { z } from 'zod'

/** User ids from jsonplaceholder are positive integers carried as path-param strings. */
export const userIdSchema = z.coerce.number().int().positive()

export const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
})

export type User = z.infer<typeof userSchema>

const usersSchema = z.array(userSchema)

/** Validate a single user payload from the upstream API, throwing on malformed data. */
export function parseUser(raw: unknown): User {
  return userSchema.parse(raw)
}

/** Validate a list of user payloads from the upstream API, throwing on malformed data. */
export function parseUsers(raw: unknown): Array<User> {
  return usersSchema.parse(raw)
}
