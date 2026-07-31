import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, type PluginOption } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import typegpuPlugin from 'unplugin-typegpu/vite'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Dev-only endpoint for dumping canvas screenshots to /tmp so an
 * AI assistant can actually inspect the rendered output at native
 * resolution (MCP screenshots are lossy JPEGs).
 *
 * POST /__snapshot { name: string, dataUrl: 'data:image/png;base64,...' }
 *   → writes /tmp/tension-snapshots/<name>.png and returns { path }.
 */
function snapshotPlugin(): PluginOption {
  return {
    name: 'snapshot-dump',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__snapshot', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const raw = Buffer.concat(chunks).toString('utf8')
        try {
          const { name, dataUrl } = JSON.parse(raw) as { name: string; dataUrl: string }
          const safeName = String(name || 'snapshot').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
          const buf = Buffer.from(base64, 'base64')
          const dir = '/tmp/tension-snapshots'
          await mkdir(dir, { recursive: true })
          const path = join(dir, `${safeName}.png`)
          await writeFile(path, buf)
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ path, bytes: buf.length }))
        } catch (err) {
          res.statusCode = 400
          res.end(String(err))
        }
      })
    },
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      treeshake: {
        manualPureFunctions: ['debug'],
      },
    },
  },
  server: {
    port: 3010,
  },
  resolve: {
    // Addons (OrbitControls, RGBELoader, GLTFLoader, ...) import bare
    // 'three'. App code is banned from doing the same (see policy-check.ts),
    // so this alias exists solely to make addon-internal imports resolve to
    // the WebGPU build instead of pulling in a second, WebGL-only copy of
    // three's core classes.
    alias: {
      // Trailing `$` forces an exact match; without it, this would also
      // rewrite 'three/addons/...' and 'three/tsl' subpath imports.
      three$: 'three/webgpu',
    },
    dedupe: ['three'],
  },
  plugins: [
    typegpuPlugin({}),
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro(),
    snapshotPlugin(),
  ],
})
