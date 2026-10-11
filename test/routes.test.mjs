/**
 * The route surface behind `/dsh-fast-pills`: the seven routes, and what the
 * prefix answers for anything else.
 */

import assert from 'node:assert/strict'
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { loadPlugin, request, serveRoute } from './harness.mjs'

/** One mounted plugin and its own HTTP server. */
let plugin
let server

/**
 * The harness home this run is using.
 *
 * The plugin's data directory is `<home>/storages/dsh-fast-pills`, so the home
 * is two levels up — and the assertion is not decoration: this test writes a
 * credentials file, and the one home it must never write to is the reader's own
 * (`~/.dsh`).
 * @returns the temporary home `loadPlugin` made.
 */
function homeOfTest() {
  const home = dirname(dirname(plugin.dataDir))
  assert.match(home, /dsh-fast-pills-/u, 'refusing to touch anything but this run\'s temporary home')
  return home
}

before(async () => {
  plugin = await loadPlugin()
  server = await serveRoute(plugin.route)
})

after(async () => {
  await server.stop()
  await plugin.cleanup()
})

describe('the registered route', () => {
  it('is one prefix route on the plugin name', () => {
    assert.deepEqual(plugin.route, {
      kind: 'prefix',
      path: '/dsh-fast-pills',
      handler: plugin.route.handler,
    })
  })
})

describe('the route table', () => {
  it('reads the tree, the ledger and the range query', async () => {
    assert.equal((await request(server.url, '/pills')).status, 200)
    assert.equal((await request(server.url, '/usage')).status, 200)
    assert.equal((await request(server.url, '/usage?from=2026-10-01T00:00:00Z')).status, 200)
  })

  it('writes the tree and appends a row', async () => {
    const tree = [{ kind: 'pill', id: 'p1', name: '一', body: '', skill: null, quick: false, scope: [] }]
    assert.equal((await request(server.url, '/pills', { method: 'PUT', body: JSON.stringify(tree) })).status, 200)
    assert.equal((await request(server.url, '/usage', {
      method: 'POST',
      body: JSON.stringify({ pillId: 'p1' }),
    })).status, 201)
  })

  it('refuses recognition with no key, and never calls anywhere', async () => {
    const response = await request(server.url, '/recognize', { method: 'POST', body: '{"sessionId":"s1"}' })
    assert.equal(response.status, 409)
    assert.equal(response.body.code, 'no-credential')
    const nameless = await request(server.url, '/recognize', { method: 'POST', body: '{}' })
    assert.equal(nameless.status, 400)
    assert.equal(nameless.body.code, 'invalid-request')
  })

  it('records a prompt, lists sessions, reads one back and clears it', async () => {
    const appended = await request(server.url, '/transcript', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', text: '打 13812345678 给 zhangsan@example.com', workspace: 'my-app' }),
    })
    assert.equal(appended.status, 201)
    assert.equal(appended.body.count, 1)

    const list = await request(server.url, '/transcripts')
    assert.equal(list.status, 200)
    assert.deepEqual(list.body.map(row => row.sessionId), ['s1'])
    assert.equal(list.body[0].count, 1)

    const rows = await request(server.url, '/transcript?session=s1')
    // The route stores what the mask leaves, so the raw shapes are not in it.
    assert.equal(rows.body[0].text, '打 [已脱敏:手机号] 给 [已脱敏:邮箱]')
    assert.equal(rows.body[0].workspace, 'my-app')

    const missing = await request(server.url, '/transcript')
    assert.equal(missing.status, 400)
    assert.equal(missing.body.code, 'invalid-request')

    const dropped = await request(server.url, '/transcript?session=s1', { method: 'DELETE' })
    assert.equal(dropped.body.removed, true)
    assert.deepEqual((await request(server.url, '/transcripts')).body, [])
  })

  it('reports the key without its value, and refuses a write with no key in it', async () => {
    const settings = await request(server.url, '/settings')
    assert.equal(settings.status, 200)
    assert.equal(settings.body.model, 'deepseek-flash')
    // The custom prompt starts from a written preference, not a blank box.
    assert.equal(settings.body.customPrompt, plugin.module.DEFAULT_SETTINGS.customPrompt)
    assert.match(settings.body.customPrompt, /偏好/u)

    const written = await request(server.url, '/settings', {
      method: 'PUT',
      body: JSON.stringify({ customPrompt: '我们在做数据系统' }),
    })
    assert.equal(written.body.customPrompt, '我们在做数据系统')
    assert.equal((await request(server.url, '/settings')).body.customPrompt, '我们在做数据系统')

    // 推理程度：页面保存的那一档要真的落盘，读回来还是它；不认识的档位不写。
    assert.equal((await request(server.url, '/settings')).body.reasoningEffort, 'low')
    const effort = await request(server.url, '/settings', {
      method: 'PUT',
      body: JSON.stringify({ reasoningEffort: 'high' }),
    })
    assert.equal(effort.body.reasoningEffort, 'high')
    assert.equal((await request(server.url, '/settings')).body.reasoningEffort, 'high')
    await request(server.url, '/settings', { method: 'PUT', body: JSON.stringify({ reasoningEffort: 'medium' }) })
    assert.equal((await request(server.url, '/settings')).body.reasoningEffort, 'high')

    const facts = await request(server.url, '/credentials')
    assert.equal(facts.status, 200)
    assert.equal(facts.body.configured, false)
    assert.equal(facts.body.value, undefined)

    const malformed = await request(server.url, '/credentials', { method: 'PUT', body: JSON.stringify({ nope: 1 }) })
    assert.equal(malformed.status, 400)
    assert.equal(malformed.body.code, 'invalid-credential')
  })

  it('copies the harness key without ever handing it to the page', async () => {
    // 宿主的凭据文件是这个测试自己写的：`sync` 读它、写插件自己的文件，回答里没有值。
    // 家目录从插件的数据目录倒推（`<home>/storages/dsh-fast-pills`），并且必须确认它是
    // 这次测试的临时家目录——写错的代价是动到真的 `~/.dsh/.credentials.yaml`。
    const home = homeOfTest()
    await writeFile(join(home, '.credentials.yaml'), 'refs:\n  DEEPSEEK_API_KEY: sk-harness-only\n', { mode: 0o600 })

    const before = await request(server.url, '/credentials')
    assert.equal(before.body.configured, false, 'nothing is stored until the reader presses the button')
    assert.equal(before.body.syncable, true)

    const synced = await request(server.url, '/credentials/sync', { method: 'POST' })
    assert.equal(synced.status, 200)
    assert.equal(synced.body.configured, true)
    assert.equal(synced.body.key, undefined, 'the value never crosses the route')
    assert.match(String(synced.body.hint), /^[0-9a-f]{8}$/u, 'the page gets a fingerprint instead')

    // 值是宿主写进去的，插件自己的文件里是明文（0600），页面拿不到。
    const stored = JSON.parse(await readFile(join(plugin.dataDir, 'secret.json'), 'utf8'))
    assert.equal(stored.apiKey, 'sk-harness-only')
    const mode = (await stat(join(plugin.dataDir, 'secret.json'))).mode & 0o777
    assert.equal(mode, 0o600)

    const after = await request(server.url, '/credentials')
    assert.equal(after.body.configured, true)
    assert.equal(after.body.value, undefined)
    assert.equal(after.body.hint, synced.body.hint, 'the fingerprint is the stored key\'s')

    const cleared = await request(server.url, '/credentials/clear', { method: 'POST' })
    assert.equal(cleared.body.configured, false)
    assert.equal(cleared.body.hint, undefined)
  })

  it('tells “the harness has no key” apart from “the key could not be written”', async () => {
    await rm(join(homeOfTest(), '.credentials.yaml'), { force: true })
    const missing = await request(server.url, '/credentials/sync', { method: 'POST' })
    assert.equal(missing.status, 409)
    assert.equal(missing.body.code, 'no-harness-credential')
  })

  it('answers 404 below the prefix for a path it does not serve', async () => {
    const response = await request(server.url, '/nothing')
    assert.equal(response.status, 404)
    assert.equal(response.body.code, 'not-found')
    const bare = await request(server.url, '')
    assert.equal(bare.status, 404)
  })

  it('answers 405 with the methods the path accepts', async () => {
    const tree = await request(server.url, '/pills', { method: 'POST', body: '{}' })
    assert.equal(tree.status, 405)
    assert.equal(tree.headers.get('allow'), 'GET, PUT, DELETE')
    const usage = await request(server.url, '/usage', { method: 'PATCH' })
    assert.equal(usage.status, 405)
    assert.equal(usage.headers.get('allow'), 'GET, POST, DELETE')
  })

  it('clears the ledger and resets the tree, each on its own path', async () => {
    const cleared = await request(server.url, '/usage', { method: 'DELETE' })
    assert.equal(cleared.status, 200)
    assert.deepEqual(cleared.body, { ok: true })
    assert.deepEqual((await request(server.url, '/usage')).body, [])

    const reset = await request(server.url, '/pills', { method: 'DELETE' })
    assert.equal(reset.status, 200)
    assert.deepEqual(reset.body, JSON.parse(JSON.stringify(plugin.module.SEED_TREE)))
  })

  it('answers 400 for a body that is not JSON, or is not the shape it writes', async () => {
    const notJson = await request(server.url, '/pills', { method: 'PUT', body: 'not json' })
    assert.equal(notJson.status, 400)
    assert.equal(notJson.body.code, 'invalid-json')
    const empty = await request(server.url, '/pills', { method: 'PUT' })
    assert.equal(empty.status, 400)
    const wrongShape = await request(server.url, '/pills', { method: 'PUT', body: '{"kind":"pill"}' })
    assert.equal(wrongShape.status, 400)
    assert.equal(wrongShape.body.code, 'invalid-tree')
  })

  it('answers 400 for a range bound that is not an instant', async () => {
    const response = await request(server.url, '/usage?from=yesterday')
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'invalid-range')
  })

  it('answers 413 for a body over the limit', async () => {
    const response = await request(server.url, '/pills', {
      method: 'PUT',
      body: JSON.stringify([{ kind: 'pill', id: 'x', name: 'x'.repeat(300 * 1024), body: '', skill: null, quick: false, scope: [] }]),
    })
    assert.equal(response.status, 413)
    assert.equal(response.body.code, 'payload-too-large')
  })
})
