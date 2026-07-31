/**
 * Debug logging gated behind dev builds.
 *
 * Vite's Rollup config marks `debug` as a pure function, so production builds
 * drop calls and their argument expressions. Use this instead of a bare
 * `console.log` for development-only output. Keep `console.warn` and
 * `console.error` for problems users should see.
 */
export function debug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    // oxlint-disable-next-line no-console
    console.log(...args)
  }
}
