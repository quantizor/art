/**
 * MinHeap — array-backed binary min-heap for frontier selection.
 *
 * Stores (key, score) pairs sorted by score. Provides O(log N)
 * push and O(log N) pop-minimum. Used for nearest-first frontier
 * expansion in FloodFillSimulation.
 *
 * Uses parallel arrays (keys[], scores[]) instead of objects to
 * avoid GC pressure in the hot loop.
 */

export class MinHeap {
  private keys: number[]
  private scores: number[]
  private count: number

  constructor(capacity = 256) {
    this.keys = new Array(capacity)
    this.scores = new Array(capacity)
    this.count = 0
  }

  get size(): number {
    return this.count
  }

  push(key: number, score: number): void {
    const i = this.count
    if (i >= this.keys.length) {
      // Double capacity
      const newLen = this.keys.length * 2
      const newKeys = new Array(newLen)
      const newScores = new Array(newLen)
      for (let j = 0; j < i; j++) {
        newKeys[j] = this.keys[j]
        newScores[j] = this.scores[j]
      }
      this.keys = newKeys
      this.scores = newScores
    }

    this.keys[i] = key
    this.scores[i] = score
    this.count++
    this.bubbleUp(i)
  }

  /** Remove and return the key with the minimum score, or -1 if empty */
  pop(): number {
    if (this.count === 0) return -1

    const minKey = this.keys[0]
    this.count--

    if (this.count > 0) {
      this.keys[0] = this.keys[this.count]
      this.scores[0] = this.scores[this.count]
      this.sinkDown(0)
    }

    return minKey
  }

  /** Peek at the minimum score without removing */
  peekScore(): number {
    return this.count > 0 ? this.scores[0] : Infinity
  }

  clear(): void {
    this.count = 0
  }

  private bubbleUp(i: number): void {
    const keys = this.keys
    const scores = this.scores

    while (i > 0) {
      const parent = (i - 1) >> 1
      if (scores[i] >= scores[parent]) break

      // Swap
      const tmpK = keys[i]; keys[i] = keys[parent]; keys[parent] = tmpK
      const tmpS = scores[i]; scores[i] = scores[parent]; scores[parent] = tmpS
      i = parent
    }
  }

  private sinkDown(i: number): void {
    const keys = this.keys
    const scores = this.scores
    const n = this.count

    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2

      if (left < n && scores[left] < scores[smallest]) smallest = left
      if (right < n && scores[right] < scores[smallest]) smallest = right
      if (smallest === i) break

      const tmpK = keys[i]; keys[i] = keys[smallest]; keys[smallest] = tmpK
      const tmpS = scores[i]; scores[i] = scores[smallest]; scores[smallest] = tmpS
      i = smallest
    }
  }
}
