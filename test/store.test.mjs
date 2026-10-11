/**
 * The page's tree source and its writes, driven through a fake `fetch`: the
 * tests see exactly the requests the page would send.
 *
 * The fake answers each route on its own, because the source reads the tree and
 * today's ledger range together and writes through three verbs.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { appendUsage, createPillStore } from '../src/client/services/pillStore.ts'

/** One seeded capsule tree. */
const TREE = [{ kind: 'pill', id: 'continue', name: '继续', body: '继续', skill: null, quick: true, scope: [] }]

/** A ledger row at a given instant. */
function row(at, pillId = 'p') {
  return { at, pillId, workspace: '', session: 's' }
}

/** One fake response. */
function answer(fields = {}) {
  return {
    ok: fields.ok ?? true,
    status: fields.status ?? 200,
    headers: { get: name => fields.headers?.[name] ?? null },
    json: () => Promise.resolve(fields.body),
  }
}

/**
 * A `fetch` that answers from a queue and records every call.
 *
 * A queued answer is used by the next call whatever its route — that is how a
 * test says "this read fails". When the queue is empty the route answers its
 * own default, and the ledger stands in for a host that appends what it was
 * posted and hands the whole file back on a read.
 * @param answers - one answer per call, in order.
 * @param options - the tree and the ledger rows the host starts with.
 * @returns the fake and its recorded calls.
 */
function fakeFetch(answers = [], options = {}) {
  const calls = []
  const ledger = [...(options.usage ?? [])]
  const fetchTree = (url, init) => {
    const method = init?.method ?? 'GET'
    calls.push({ url: String(url), method, init })
    const queued = answers.shift()
    if (queued !== undefined) {
      if (queued instanceof Error) return Promise.reject(queued)
      return Promise.resolve(typeof queued.then === 'function' ? queued : answer(queued))
    }
    if (String(url).includes('/usage') && method === 'GET') return Promise.resolve(answer({ body: ledger }))
    if (String(url).includes('/usage') && method === 'POST') {
      // The host stamps a row that arrived without its instant, which is what
      // the page relies on when it reads the ledger back.
      const record = JSON.parse(init.body)
      ledger.push({ at: new Date().toISOString(), ...record })
      return Promise.resolve(answer({ status: 201, body: { ok: true } }))
    }
    return Promise.resolve(answer({ body: options.tree ?? TREE }))
  }
  return { fetchTree, calls }
}

/** Let the source's chained promises settle. */
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('createPillStore', () => {
  it('reads the tree and the ledger once on the first subscription, and republishes them', async () => {
    const rows = [row(new Date().toISOString()), row(new Date().toISOString())]
    const { fetchTree, calls } = fakeFetch([], { usage: rows })
    const store = createPillStore(fetchTree)
    assert.equal(calls.length, 0, 'building the handle reads nothing')

    let changes = 0
    const unsubscribe = store.subscribe(() => { changes += 1 })
    store.subscribe(() => {})
    await settle()

    assert.equal(calls.length, 2)
    assert.equal(calls[0].url, '/dsh-fast-pills/pills')
    // The whole ledger, not a query window: the statistics bucket the same
    // rows by day and one read answers all of them.
    assert.equal(calls[1].url, '/dsh-fast-pills/usage')
    assert.equal(changes, 1)
    assert.deepEqual(store.getSnapshot(), { status: 'ready', tree: TREE, today: 2, usage: rows })

    // A second read leaves the first answer in place until a new one lands.
    store.reload()
    assert.equal(store.getSnapshot().tree, TREE)
    unsubscribe()
  })

  it('counts only the rows of the page’s own local day', async () => {
    const now = new Date()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59)
    const { fetchTree } = fakeFetch([], { usage: [row(now.toISOString()), row(yesterday.toISOString())] })
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()
    assert.equal(store.getSnapshot().today, 1)
    assert.equal(store.getSnapshot().usage.length, 2, 'yesterday is still in the ledger')
  })

  it('reports a failed read and an unreadable body instead of an empty row', async () => {
    const failed = fakeFetch([{ ok: false, status: 500 }, { ok: false, status: 500 }])
    const refused = createPillStore(failed.fetchTree)
    refused.subscribe(() => {})
    await settle()
    assert.deepEqual(refused.getSnapshot(), { status: 'error', tree: [], today: 0, error: 'HTTP 500' })
    assert.equal(refused.getSnapshot().usage, undefined, 'a failed read is not an empty ledger')

    const unreadable = fakeFetch([{ body: { not: 'a tree' } }])
    const store = createPillStore(unreadable.fetchTree)
    store.subscribe(() => {})
    await settle()
    assert.equal(store.getSnapshot().status, 'error')
    assert.equal(store.getSnapshot().error, 'the stored tree is not an array')
  })

  it('keeps the ledger unread when only the ledger read fails', async () => {
    const half = fakeFetch([undefined, { ok: false, status: 500 }])
    const store = createPillStore(half.fetchTree)
    store.subscribe(() => {})
    await settle()
    assert.equal(store.getSnapshot().status, 'ready')
    assert.equal(store.getSnapshot().usage, undefined)
    assert.equal(store.getSnapshot().today, 0)
  })

  it('says so when the page cannot reach the route at all', async () => {
    const unreachable = fakeFetch([new Error('Failed to fetch')])
    const store = createPillStore(unreachable.fetchTree)
    store.subscribe(() => {})
    await settle()
    assert.deepEqual(store.getSnapshot(), {
      status: 'error', tree: [], today: 0, error: 'Failed to fetch', offline: true,
    })
  })

  it('carries the repaired-file name when the host reported one', async () => {
    const damaged = fakeFetch([{ body: TREE, headers: { 'x-dsh-fast-pills-degraded': 'pills.json.bak-1' } }])
    const store = createPillStore(damaged.fetchTree)
    store.subscribe(() => {})
    await settle()
    assert.equal(store.getSnapshot().degraded, 'pills.json.bak-1')
  })

  it('publishes an edit before the write lands, and keeps it when the host takes it', async () => {
    const { fetchTree, calls } = fakeFetch()
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()

    const edited = [{ ...TREE[0], name: '改过的' }]
    const written = store.save(edited)
    assert.deepEqual(store.getSnapshot().tree, edited, 'the row changes at once')

    assert.equal(await written, true)
    const put = calls.find(call => call.method === 'PUT')
    assert.equal(put.url, '/dsh-fast-pills/pills')
    assert.deepEqual(JSON.parse(put.init.body), edited)
    assert.deepEqual(store.getSnapshot().tree, edited)
  })

  it('reads the tree back when the host refuses the write', async () => {
    const { fetchTree } = fakeFetch([undefined, undefined, { ok: false, status: 400 }])
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()
    const written = await store.save([{ ...TREE[0], name: '不该留下' }])
    assert.equal(written, false)
    await settle()
    assert.deepEqual(store.getSnapshot().tree, TREE)
  })

  it('sends one write at a time', async () => {
    let release
    const held = new Promise((resolve) => { release = resolve })
    const { fetchTree, calls } = fakeFetch([answer({ body: TREE }), answer({ body: [] }), held, answer({ ok: true })])
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()

    const first = store.save([{ ...TREE[0], name: '一' }])
    const second = store.save([{ ...TREE[0], name: '二' }])
    await settle()
    assert.equal(calls.filter(call => call.method === 'PUT').length, 1, 'the second waits for the first')

    release(answer({ ok: true }))
    assert.equal(await first, true)
    assert.equal(await second, true)
    assert.equal(calls.filter(call => call.method === 'PUT').length, 2)
  })

  it('publishes the seed the reset answers with', async () => {
    const seed = [{ ...TREE[0], name: '默认' }]
    const { fetchTree, calls } = fakeFetch([undefined, undefined, { body: seed }])
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()

    assert.equal(await store.reset(), true)
    assert.equal(calls.find(call => call.method === 'DELETE').url, '/dsh-fast-pills/pills')
    assert.deepEqual(store.getSnapshot().tree, seed)
  })

  it('empties the ledger and the count when the clear is accepted', async () => {
    const { fetchTree, calls } = fakeFetch([], { usage: [row(new Date().toISOString())] })
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()
    assert.equal(store.getSnapshot().today, 1)

    assert.equal(await store.clearUsage(), true)
    assert.equal(store.getSnapshot().today, 0)
    assert.equal(calls.find(call => call.method === 'DELETE').url, '/dsh-fast-pills/usage')
  })

  it('counts the ledger it already read for the clear action’s warning', async () => {
    const rows = [row('2026-10-01T00:00:00.000Z'), row('2026-10-02T00:00:00.000Z')]
    const { fetchTree, calls } = fakeFetch([], { usage: rows })
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()

    assert.equal(await store.usageTotal(), 2)
    assert.equal(calls.filter(call => call.url === '/dsh-fast-pills/usage').length, 1, 'the held ledger is not read again')
  })

  it('counts a press only once the host has taken the row', async () => {
    const { fetchTree, calls } = fakeFetch()
    const store = createPillStore(fetchTree)
    store.subscribe(() => {})
    await settle()

    store.notePress({ pillId: 'continue', workspace: 'my-app', session: 's1' })
    await settle()
    assert.equal(store.getSnapshot().today, 1)
    assert.equal(store.getSnapshot().usage.length, 1, 'the press is in the ledger the panel reads')
    const post = calls.find(call => call.method === 'POST')
    assert.equal(post.url, '/dsh-fast-pills/usage')
    assert.deepEqual(JSON.parse(post.init.body), { pillId: 'continue', workspace: 'my-app', session: 's1' })

    // One ledger row, one count: the read that follows the append must not
    // count the same press twice.
    await settle()
    assert.equal(store.getSnapshot().today, 1)

    const refused = fakeFetch([undefined, undefined, { ok: false, status: 500 }])
    const other = createPillStore(refused.fetchTree)
    other.subscribe(() => {})
    await settle()
    other.notePress({ pillId: 'continue', workspace: '', session: 's1' })
    await settle()
    assert.equal(other.getSnapshot().today, 0)
  })
})

describe('appendUsage', () => {
  it('posts the capsule, the directory and the session, and leaves the instant to the host', async () => {
    const { fetchTree, calls } = fakeFetch()
    assert.equal(await appendUsage(fetchTree, { pillId: 'continue', workspace: 'my-app', session: 's1' }), true)

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, '/dsh-fast-pills/usage')
    assert.equal(calls[0].method, 'POST')
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      pillId: 'continue', workspace: 'my-app', session: 's1',
    })
  })

  it('swallows a failed write: the text is already in the draft', async () => {
    const { fetchTree } = fakeFetch([new Error('offline')])
    assert.equal(await appendUsage(fetchTree, { pillId: 'p', workspace: '', session: 's1' }), false)
  })
})
