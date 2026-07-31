import { describe, it, expect } from 'bun:test'
import { parseUser, parseUsers, userIdSchema, userSchema } from './users'

describe('userIdSchema', () => {
  it('accepts positive integer strings', () => {
    const result = userIdSchema.safeParse('1')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(1)
    }
  })

  it('rejects zero, negative, non-integer, and non-numeric values', () => {
    expect(userIdSchema.safeParse('0').success).toBe(false)
    expect(userIdSchema.safeParse('-1').success).toBe(false)
    expect(userIdSchema.safeParse('1.5').success).toBe(false)
    expect(userIdSchema.safeParse('abc').success).toBe(false)
    expect(userIdSchema.safeParse('').success).toBe(false)
  })
})

describe('userSchema', () => {
  it('accepts a well-formed jsonplaceholder user, stripping extra fields', () => {
    const result = userSchema.safeParse({
      id: 1,
      name: 'Leanne Graham',
      username: 'Bret',
      email: 'Sincere@april.biz',
      address: { city: 'Gwenborough' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        id: 1,
        name: 'Leanne Graham',
        email: 'Sincere@april.biz',
      })
    }
  })

  it('rejects a user missing required fields', () => {
    expect(userSchema.safeParse({ id: 1, name: 'No email' }).success).toBe(
      false,
    )
  })

  it('rejects a user with an invalid email', () => {
    expect(
      userSchema.safeParse({ id: 1, name: 'X', email: 'not-an-email' })
        .success,
    ).toBe(false)
  })
})

describe('parseUser', () => {
  it('returns the parsed user for valid input', () => {
    const raw = { id: 1, name: 'Leanne Graham', email: 'Sincere@april.biz' }
    expect(parseUser(raw)).toEqual(raw)
  })

  it('throws for malformed upstream data', () => {
    expect(() => parseUser({ id: 1 })).toThrow()
  })
})

describe('parseUsers', () => {
  it('returns the parsed array for valid input', () => {
    const raw = [
      { id: 1, name: 'A', email: 'a@example.com' },
      { id: 2, name: 'B', email: 'b@example.com' },
    ]
    expect(parseUsers(raw)).toEqual(raw)
  })

  it('throws when any element is malformed', () => {
    expect(() =>
      parseUsers([{ id: 1, name: 'A', email: 'a@example.com' }, { id: 2 }]),
    ).toThrow()
  })
})
