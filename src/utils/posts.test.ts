import { describe, it, expect } from 'bun:test'
import { parsePost, parsePosts, postIdSchema, postSchema } from './posts'

describe('postIdSchema', () => {
  it('accepts digit strings', () => {
    expect(postIdSchema.safeParse('1').success).toBe(true)
    expect(postIdSchema.safeParse('42').success).toBe(true)
  })

  it('rejects non-digit strings', () => {
    expect(postIdSchema.safeParse('abc').success).toBe(false)
    expect(postIdSchema.safeParse('1abc').success).toBe(false)
    expect(postIdSchema.safeParse('-1').success).toBe(false)
    expect(postIdSchema.safeParse('1.5').success).toBe(false)
    expect(postIdSchema.safeParse('').success).toBe(false)
  })
})

describe('postSchema', () => {
  it('accepts a well-formed jsonplaceholder post, stripping extra fields', () => {
    const result = postSchema.safeParse({
      userId: 1,
      id: 1,
      title: 'sunt aut facere',
      body: 'quia et suscipit',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        id: 1,
        title: 'sunt aut facere',
        body: 'quia et suscipit',
      })
    }
  })

  it('rejects a post missing required fields', () => {
    expect(postSchema.safeParse({ id: 1, title: 'no body' }).success).toBe(
      false,
    )
  })

  it('rejects a post with the wrong field types', () => {
    expect(
      postSchema.safeParse({ id: '1', title: 'x', body: 'y' }).success,
    ).toBe(false)
  })
})

describe('parsePost', () => {
  it('returns the parsed post for valid input', () => {
    const raw = { id: 1, title: 'Title', body: 'Body' }
    expect(parsePost(raw)).toEqual(raw)
  })

  it('throws for malformed upstream data', () => {
    expect(() => parsePost({ id: 1 })).toThrow()
  })

  it('throws for non-object input', () => {
    expect(() => parsePost(null)).toThrow()
    expect(() => parsePost('not a post')).toThrow()
  })
})

describe('parsePosts', () => {
  it('returns the parsed array for valid input', () => {
    const raw = [
      { id: 1, title: 'A', body: 'a' },
      { id: 2, title: 'B', body: 'b' },
    ]
    expect(parsePosts(raw)).toEqual(raw)
  })

  it('throws when any element is malformed', () => {
    expect(() =>
      parsePosts([{ id: 1, title: 'A', body: 'a' }, { id: 2 }]),
    ).toThrow()
  })

  it('throws for a non-array payload', () => {
    expect(() => parsePosts({ id: 1, title: 'A', body: 'a' })).toThrow()
  })
})
