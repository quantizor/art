# React

Version pin: **19.2.4** (`react`, `react-dom`, `@types/react` **19.2.x**).

TanStack Start app with file routes, SSR/prerender, and client hydration. GPU scenes mount in route components or `NotFound`, not in server-only trees without guards.

## Ref as a prop

React 19 treats `ref` as a normal prop on function components.

Do:

- Accept `ref?: React.Ref<T>` in component props and pass it to the underlying DOM node or imperative handle target.
- Use `useImperativeHandle(ref, () => handle, [deps])` when exposing an instance API (canvas controllers, game loops).

Do not:

- Add **new** `forwardRef` wrappers. Legacy `forwardRef` in `src/ui/` remains until migrated; new components use ref-as-prop.
- Use `React.forwardRef` for one-line passthrough refs.

```tsx
type CanvasHostProps = {
  ref?: React.Ref<HTMLCanvasElement>
  className?: string
}

export function CanvasHost({ ref, className }: CanvasHostProps) {
  return <canvas ref={ref} className={className} />
}
```

## StrictMode and GPU init

React StrictMode (when enabled) double-invokes mount/unmount in development to surface unsafe side effects.

Implications for async WebGPU / Three.js setup:

- `await renderer.init()` and `SceneManager.create()` must be idempotent or guarded by a cancellation token / `AbortSignal`.
- On unmount (or StrictMode's simulated unmount), abort in-flight init, dispose partial resources, and ignore late resolves.
- Do not register global listeners, `requestAnimationFrame` loops, or WebGPU device callbacks without matching teardown in the effect cleanup.
- Prefer a ref or module-level "generation" counter so stale async work cannot attach to a disposed canvas.

Do not rely on mount happening exactly once in dev. Production mounts once; dev may mount twice.

## Effects and scenes

Pattern for GPU-backed viewers:

```tsx
useEffect(() => {
  const ac = new AbortController()
  let manager: SceneManager | undefined

  void SceneManager.create(canvas, { signal: ac.signal }).then((m) => {
    manager = m
  })

  return () => {
    ac.abort()
    manager?.dispose()
  }
}, [canvasRef])
```

Rules:

- Create the renderer/scene in `useEffect` (or a dedicated hook), not during render.
- Pass `signal` into async factory methods; check `signal.aborted` before applying results.
- Call `dispose()` on the scene manager, post-processing nodes, and renderer in cleanup.

## Imports

- Route components: `@tanstack/react-router` (`createFileRoute`, `Link`, `Outlet`, etc.).
- Design system: `~/ui` (see `agent-docs/tailwind-css.md`).
- Project modules: `~/components`, `~/projects`, `~/games`, etc. via the `~/*` path alias in `tsconfig.json`.
