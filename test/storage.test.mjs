/**
 * The storage contract: what the two files look like, and what happens when
 * they are missing or wrong.
 */

import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { loadPlugin, request, serveRoute } from './harness.mjs'

/** One mounted plugin: its scratch home, its route, and its base URL. */
let plugin
let server

before(async () => {
  plugin = await loadPlugin()
  server = await serveRoute(plugin.route)
})

after(async () => {
  await server.stop()
  await plugin.cleanup()
})

/** Read the capsule tree through the route. */
async function readPills() {
  return await request(server.url, '/pills')
}

/** Replace the tree through the route. */
async function writePills(tree) {
  return await request(server.url, '/pills', { method: 'PUT', body: JSON.stringify(tree) })
}

describe('the capsule tree', () => {
  it('writes the seed on the first read', async () => {
    const response = await readPills()
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, JSON.parse(JSON.stringify(plugin.module.SEED_TREE)))
    assert.deepEqual((await readdir(plugin.dataDir)).sort(), ['pills.json', 'settings.json'])
    const onDisk = JSON.parse(await readFile(join(plugin.dataDir, 'pills.json'), 'utf8'))
    assert.deepEqual(onDisk, response.body)
  })

  it('seeds one capsule on its own above the example fold', async () => {
    const { body } = await readPills()
    assert.deepEqual(body.map(node => node.name), ['继续', '常用'])
    assert.deepEqual(body.map(node => node.kind), ['pill', 'group'])
    const group = body[1]
    assert.ok(group.children.length > 0, `${group.name} has capsules`)
    assert.ok(group.children.every(child => child.kind === 'pill'))
  })

  it('stores what a whole-tree write sends', async () => {
    const tree = [{ kind: 'group', id: 'g1', name: '组', scope: [], children: [
      { kind: 'pill', id: 'p1', name: '一', body: '正文', skill: 'demo', quick: true, scope: ['my-app'] },
    ] }]
    assert.equal((await writePills(tree)).status, 200)
    assert.deepEqual((await readPills()).body, tree)
    await writePills(plugin.module.SEED_TREE)
  })

  it('refuses a tree that is not one, and leaves the file alone', async () => {
    const before = await readPills()
    const response = await writePills([{ kind: 'group', id: 'g1', name: '组', scope: [], children: [
      { kind: 'group', id: 'g2', name: '组中组', scope: [], children: [] },
    ] }])
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'invalid-tree')
    assert.match(response.body.message, /groups do not nest/)
    assert.deepEqual((await readPills()).body, before.body)
  })

  it('moves an unreadable tree aside and starts from the seed', async () => {
    await writeFile(join(plugin.dataDir, 'pills.json'), '{ this is not JSON')
    const response = await readPills()
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, JSON.parse(JSON.stringify(plugin.module.SEED_TREE)))
    const backup = response.headers.get('x-dsh-fast-pills-degraded')
    assert.ok(backup !== null, 'the repair is reported beside the tree')
    assert.equal(await readFile(join(plugin.dataDir, backup), 'utf8'), '{ this is not JSON')
    assert.deepEqual(JSON.parse(await readFile(join(plugin.dataDir, 'pills.json'), 'utf8')), response.body)
  })

  it('treats a parseable file of the wrong shape as unreadable too', async () => {
    await writeFile(join(plugin.dataDir, 'pills.json'), '{"tree": []}')
    const response = await readPills()
    assert.equal(response.status, 200)
    assert.ok(response.headers.get('x-dsh-fast-pills-degraded') !== null)
    assert.deepEqual(response.body, JSON.parse(JSON.stringify(plugin.module.SEED_TREE)))
  })

  it('puts the seed back when the reset is asked for, and answers with it', async () => {
    await writePills([{ kind: 'pill', id: 'mine', name: '我的', body: '走了', skill: null, quick: false, scope: [] }])
    const response = await request(server.url, '/pills', { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, JSON.parse(JSON.stringify(plugin.module.SEED_TREE)))
    assert.deepEqual((await readPills()).body, response.body)
    assert.deepEqual(JSON.parse(await readFile(join(plugin.dataDir, 'pills.json'), 'utf8')), response.body)
  })
})

describe('the usage ledger', () => {
  it('appends rows and keeps the history it already had', async () => {
    const first = await request(server.url, '/usage', {
      method: 'POST',
      body: JSON.stringify({ pillId: 'p1', workspace: 'my-app', session: 's1' }),
    })
    assert.equal(first.status, 201)
    await request(server.url, '/usage', {
      method: 'POST',
      body: JSON.stringify({ pillId: 'p2', workspace: '', session: '' }),
    })
    const { body } = await request(server.url, '/usage')
    assert.deepEqual(body.map(row => row.pillId), ['p1', 'p2'])
    assert.equal(body[0].workspace, 'my-app')
    assert.ok(!Number.isNaN(Date.parse(body[0].at)), 'the host stamps the instant')
  })

  it('skips a damaged row and reads the rest', async () => {
    const file = join(plugin.dataDir, 'usage.jsonl')
    await writeFile(file, `${await readFile(file, 'utf8')}{ broken\n{"at":"nope"}\n`)
    const { body } = await request(server.url, '/usage')
    assert.deepEqual(body.map(row => row.pillId), ['p1', 'p2'])
  })

  it('reads an inclusive instant range', async () => {
    const at = ['2026-10-01T00:00:00.000Z', '2026-10-05T00:00:00.000Z', '2026-10-09T00:00:00.000Z']
    for (const instant of at) {
      await request(server.url, '/usage', {
        method: 'POST',
        body: JSON.stringify({ pillId: `range-${instant}`, at: instant }),
      })
    }
    const from = encodeURIComponent('2026-10-01T00:00:00.000Z')
    const to = encodeURIComponent('2026-10-05T00:00:00.000Z')
    const { body } = await request(server.url, `/usage?from=${from}&to=${to}`)
    assert.deepEqual(body.map(row => row.at), [at[0], at[1]])
  })

  it('throws every row away when the ledger is cleared', async () => {
    const before = (await request(server.url, '/usage')).body.length
    assert.ok(before > 0, 'there is something to clear')
    const cleared = await request(server.url, '/usage', { method: 'DELETE' })
    assert.equal(cleared.status, 200)
    assert.deepEqual(cleared.body, { ok: true })
    assert.deepEqual((await request(server.url, '/usage')).body, [])
  })

  it('lands every row when writes arrive at once', async () => {
    const before = (await request(server.url, '/usage')).body.length
    await Promise.all(Array.from({ length: 25 }, async (_unused, index) => await request(server.url, '/usage', {
      method: 'POST',
      body: JSON.stringify({ pillId: `burst-${String(index)}` }),
    })))
    const { body } = await request(server.url, '/usage')
    assert.equal(body.length, before + 25)
  })

  it('rejects a row without a capsule id', async () => {
    const response = await request(server.url, '/usage', { method: 'POST', body: JSON.stringify({ session: 's' }) })
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'invalid-record')
  })
})

describe('the data directory', () => {
  it('holds one file per store, and the settings the seed reads its language from', async () => {
    const entries = (await readdir(plugin.dataDir)).filter(name => !name.includes('.bak-')).sort()
    assert.deepEqual(entries, ['pills.json', 'settings.json', 'usage.jsonl'])
  })
})
