/**
 * Builds both halves of the fast pills.
 *
 * The host half is one ESM file the engine's loader imports directly, and it
 * keeps no bare import of its own: an install links this package into a profile
 * while its files stay in this checkout, so a bare import would have to be
 * resolved back here, and nothing needs it.
 *
 * The browser half must come out in the shell's module-table dialect — a
 * classic script that registers a CommonJS factory through
 * `window.__ModuleLoader__` — with the platform seed words left as `require(...)`
 * calls, because the shell hands the factory its own `require`.
 *
 * Usage:
 *   node build.mjs
 *   node build.mjs --watch
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = join(root, 'lib')

/** Package name; the page loads this bundle under the same id. */
const PLUGIN_ID = 'dsh-fast-pills'

/** Platform seed words: the shell serves these from its own module table. */
const CLIENT_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives']

/**
 * Load the esbuild this checkout declares.
 * @returns the esbuild module.
 * @throws when it was never installed.
 */
async function loadEsbuild() {
  try {
    return await import(createRequire(import.meta.url).resolve('esbuild'))
  } catch (error) {
    throw new Error(`build: esbuild was not found. Install it here (cd ${root} && npm install). (${String(error)})`)
  }
}

const { build, context } = await loadEsbuild()

/** esbuild options for the host half. */
function hostOptions() {
  return {
    entryPoints: [join(root, 'src', 'index.ts')],
    outfile: join(outDir, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    logLevel: 'info',
  }
}

/** esbuild options for the browser half. */
function clientOptions() {
  return {
    entryPoints: [join(root, 'src', 'client', 'index.ts')],
    outfile: join(outDir, 'client.raw.js'),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    external: CLIENT_EXTERNALS,
    logLevel: 'info',
  }
}

/**
 * Wrap a built CommonJS bundle in the module-table registration envelope.
 *
 * The `__esModule` marker esbuild puts on a CommonJS result is deleted: the
 * loader normalizes an export object by `__esModule`, and an object marked that
 * way without a `default` export resolves to `undefined`, so the row would fail
 * to activate. A namespace with `apply`/`inject` and no marker is the form the
 * shipped client bundles register.
 * @param raw - the CommonJS output.
 * @returns the classic script the shell loads.
 */
function wrapClient(raw) {
  return `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(PLUGIN_ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${raw}
\t\tdelete module.exports.__esModule;
\t\treturn module.exports;
\t}
});
`
}

/** Build once, writing the wrapped browser bundle. */
async function buildOnce() {
  mkdirSync(outDir, { recursive: true })
  await build(hostOptions())
  const client = await build({ ...clientOptions(), write: false })
  writeFileSync(join(outDir, 'client.js'), wrapClient(client.outputFiles[0].text))
  process.stdout.write(`${PLUGIN_ID}: built\n`)
}

/** Writes the wrapped browser bundle for watch mode. */
function wrapPlugin() {
  return {
    name: 'wrap-client',
    setup(build) {
      build.onEnd((result) => {
        const raw = result.outputFiles?.[0]?.text
        if (raw === undefined) return
        writeFileSync(join(outDir, 'client.js'), wrapClient(raw))
      })
    },
  }
}

/** Rebuild on change. */
async function watch() {
  mkdirSync(outDir, { recursive: true })
  const host = await context(hostOptions())
  const client = await context({ ...clientOptions(), write: false, plugins: [wrapPlugin()] })
  await Promise.all([host.watch(), client.watch()])
  process.stdout.write(`${PLUGIN_ID}: watching\n`)
}

if (process.argv.includes('--watch')) await watch()
else await buildOnce()
