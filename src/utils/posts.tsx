import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { debug } from './debug'

/** Post ids from jsonplaceholder are positive integers rendered as digit strings. */
export const postIdSchema = z
  .string()
  .regex(/^\d+$/, 'Post id must be a digit string')

export const postSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string(),
})

export type PostType = z.infer<typeof postSchema>

const postsSchema = z.array(postSchema)

/** Validate a single post payload from the upstream API, throwing on malformed data. */
export function parsePost(raw: unknown): PostType {
  return postSchema.parse(raw)
}

/** Validate a list of post payloads from the upstream API, throwing on malformed data. */
export function parsePosts(raw: unknown): Array<PostType> {
  return postsSchema.parse(raw)
}

export const fetchPost = createServerFn({ method: 'POST' })
  .inputValidator(postIdSchema)
  .handler(async ({ data: postId }) => {
    debug(`Fetching post with id ${postId}...`)
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts/${postId}`,
    )
    if (!res.ok) {
      if (res.status === 404) {
        throw notFound()
      }

      throw new Error('Failed to fetch post')
    }

    try {
      return parsePost(await res.json())
    } catch (cause) {
      throw new Error('Upstream returned malformed post data', { cause })
    }
  })

export const fetchPosts = createServerFn().handler(async () => {
  debug('Fetching posts...')
  const res = await fetch('https://jsonplaceholder.typicode.com/posts')
  if (!res.ok) {
    throw new Error('Failed to fetch posts')
  }

  try {
    const raw: unknown = await res.json()
    return parsePosts(Array.isArray(raw) ? raw.slice(0, 10) : raw)
  } catch (cause) {
    throw new Error('Upstream returned malformed posts data', { cause })
  }
})
