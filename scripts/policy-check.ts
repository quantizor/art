/**
 * Policy check for forbidden GPU / module / enum patterns in hand-authored code.
 * Fails the process on any hit. Set POLICY_STRICT=0 to report without failing.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCAN_ROOTS = ['src', 'scripts', 'vite.config.ts']

const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
  { name: 'WebGLRenderer', pattern: /\bWebGLRenderer\b/ },
  { name: 'ShaderMaterial', pattern: /\bShaderMaterial\b/ },
  { name: 'RawShaderMaterial', pattern: /\bRawShaderMaterial\b/ },
  { name: 'EffectComposer', pattern: /\bEffectComposer\b/ },
  { name: 'TypeScript enum', pattern: /\benum\s+[A-Za-z_]/ },
  {
    name: 'bare three import',
    pattern: /from\s+['"]three['"]|require\(\s*['"]three['"]\s*\)/,
  },
]

const IGNORE_BASENAMES = new Set(['routeTree.gen.ts', 'policy-check.ts'])

async function walk(entry: string): Promise<string[]> {
  const absolute = path.resolve(ROOT, entry)
  const entries = await readdir(absolute, { withFileTypes: true }).catch(async () => {
    // Single file root (e.g. vite.config.ts)
    return null
  })

  if (entries === null) {
    return [absolute]
  }

  const files: string[] = []
  for (const dirent of entries) {
    const child = path.join(absolute, dirent.name)
    if (dirent.isDirectory()) {
      if (dirent.name === 'node_modules' || dirent.name === '.git') continue
      files.push(...(await walk(child)))
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(dirent.name)) {
      if (!IGNORE_BASENAMES.has(dirent.name)) {
        files.push(child)
      }
    }
  }
  return files
}

interface Hit {
  rule: string
  file: string
  line: number
  text: string
}

async function main(): Promise<void> {
  const files = (
    await Promise.all(SCAN_ROOTS.map((root) => walk(root)))
  ).flat()

  const hits: Hit[] = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const lines = source.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i]
      // Skip comment-only mentions in doc comments that quote forbidden names
      // as prose about the ban itself.
      if (/^\s*(\/\/|\*|\/\*)/.test(text) && /ban|never|forbid|do not|don't/i.test(text)) {
        continue
      }
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(text)) {
          hits.push({
            rule: rule.name,
            file: path.relative(ROOT, file),
            line: i + 1,
            text: text.trim(),
          })
        }
      }
    }
  }

  if (hits.length === 0) {
    console.warn('policy-check: clean')
    return
  }

  console.warn(`policy-check: ${hits.length} violation(s)`)
  for (const hit of hits) {
    console.warn(`  [${hit.rule}] ${hit.file}:${hit.line}: ${hit.text}`)
  }

  if (process.env.POLICY_STRICT !== '0') {
    process.exitCode = 1
  }
}

await main()
