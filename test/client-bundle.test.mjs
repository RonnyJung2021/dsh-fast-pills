/**
 * The built browser bundle, checked against what the shell's module loader
 * expects. The shell loads it as a classic script and runs its factory with
 * its own `require`, so a surviving `import`/`export` statement or a request
 * for a module the page does not have would only fail in a browser.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** The built browser half. */
const artifact = await readFile(join(root, 'lib', 'client.js'), 'utf8')

/** Specifiers the page's module table answers. */
const PLATFORM_MODULES = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit',
])

describe('the browser bundle', () => {
  it('registers one factory under the package name', () => {
    assert.match(artifact, /window\.__ModuleLoader__\.load\(\{\s*id: "dsh-fast-pills",/)
    assert.match(artifact, /factory: \(require\) => \{/)
  })

  it('stays a classic script', () => {
    assert.doesNotMatch(artifact, /^\s*(import|export)\s/mu)
  })

  it('asks the page only for modules the module table holds', () => {
    const requested = [...artifact.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/gu)].map(match => match[1])
    assert.ok(requested.length > 0, 'the factory gets its require')
    for (const specifier of new Set(requested)) {
      assert.ok(PLATFORM_MODULES.has(specifier), `${specifier} is a platform module`)
    }
  })

  it('drops the __esModule marker, which would hide the plugin object', () => {
    // esbuild marks its CommonJS result; the loader resolves a marked object
    // through `default`, which this module does not have.
    assert.match(artifact, /delete module\.exports\.__esModule;/)
    assert.match(artifact, /__toCommonJS\(index_exports\)/)
  })
})
