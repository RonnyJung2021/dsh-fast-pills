/**
 * The row's two pure rules: what a press inserts, and which capsules the
 * current directory may show.
 *
 * They are imported from source, which Node runs through its own type
 * stripping — the behaviour under test is the code that ships, not a copy.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pillInsertion, scopeMatches, visibleChildren, visibleTree, workspaceName, workspaceScope } from '../src/shared/utils/pillRules.ts'

/** One capsule, with the fields the tests do not care about filled in. */
function pill(fields = {}) {
  return { kind: 'pill', id: 'p', name: 'P', body: '', skill: null, quick: false, scope: [], ...fields }
}

/** One group around the given children. */
function group(children, fields = {}) {
  return { kind: 'group', id: 'g', name: 'G', scope: [], children, ...fields }
}

describe('pillInsertion', () => {
  it('leads a skilled capsule with the skill and keeps a trailing space', () => {
    assert.deepEqual(pillInsertion(pill({ skill: 'mental-model-catalog-v3', body: '生成心智模型' })), {
      text: '/mental-model-catalog-v3 生成心智模型 ',
      quick: false,
    })
  })

  it('writes a skill capsule with an empty body as the bare skill token', () => {
    assert.deepEqual(pillInsertion(pill({ skill: 'zen', body: '' })), { text: '/zen  ', quick: false })
  })

  it('writes a plain capsule as its body alone', () => {
    assert.deepEqual(pillInsertion(pill({ body: '继续' })), { text: '继续', quick: false })
  })

  it('sends only for a quick capsule that has something to write', () => {
    assert.equal(pillInsertion(pill({ body: '继续', quick: true })).quick, true)
    assert.equal(pillInsertion(pill({ body: '   ', quick: true })).quick, false)
    assert.equal(pillInsertion(pill({ body: '', skill: 'zen', quick: true })).quick, true)
  })
})

describe('scopeMatches', () => {
  it('matches the directory itself and every directory below it', () => {
    assert.equal(scopeMatches('portico', '/Users/me/app/portico'), true)
    assert.equal(scopeMatches('portico', '/Users/me/app/portico/docs'), true)
    assert.equal(scopeMatches('my-app', '/Users/me/app/my-app/docs'), true)
  })

  it('does not match a neighbouring directory or a longer name', () => {
    assert.equal(scopeMatches('portico', '/Users/me/app/ws-dsh-fast-pills'), false)
    assert.equal(scopeMatches('my-app', '/Users/me/other-my-app'), false)
    assert.equal(scopeMatches('my-app', '/Users/me/my-app-old'), false)
  })

  it('takes an absolute entry as a whole path, and never matches an unnamed directory', () => {
    assert.equal(scopeMatches('/Users/me/app', '/Users/me/app/portico'), true)
    assert.equal(scopeMatches('/Users/me/app/portico', '/Users/me/app/portico'), true)
    assert.equal(scopeMatches('/Users/me/app', '/Users/me/app-other'), false)
    assert.equal(scopeMatches('my-app', undefined), false)
    assert.equal(scopeMatches('', '/Users/me/app'), false)
  })
})

describe('workspaceScope', () => {
  const workspaces = [{ path: '/Users/me/app' }, { path: '/Users/me/app/portico' }, { path: '/Users/me/other' }]

  it('limits a new capsule to the workspace the session sits in', () => {
    assert.deepEqual(workspaceScope(workspaces, '/Users/me/app'), ['/Users/me/app'])
    assert.deepEqual(workspaceScope(workspaces, '/Users/me/other/docs'), ['/Users/me/other'])
  })

  it('takes the deepest workspace when one holds another', () => {
    assert.deepEqual(workspaceScope(workspaces, '/Users/me/app/portico'), ['/Users/me/app/portico'])
    assert.deepEqual(workspaceScope(workspaces, '/Users/me/app/portico/docs'), ['/Users/me/app/portico'])
  })

  it('limits nothing when no workspace covers the directory', () => {
    assert.deepEqual(workspaceScope(workspaces, '/Users/me/elsewhere'), [])
    assert.deepEqual(workspaceScope(workspaces, undefined), [])
    assert.deepEqual(workspaceScope([], '/Users/me/app'), [])
  })
})

describe('visibleTree', () => {
  const plain = pill({ id: 'everywhere', name: '处处' })
  const here = pill({ id: 'here', name: '本地', scope: ['my-app'] })
  const elsewhere = pill({ id: 'elsewhere', name: '别处', scope: ['other-repo'] })
  const tree = [plain, here, elsewhere, group([here, elsewhere], { id: 'mixed' })]

  it('keeps unscoped capsules everywhere and drops a scoped capsule in another directory', () => {
    assert.deepEqual(visibleTree(tree, '/Users/me/my-app').map(node => node.id), ['everywhere', 'here', 'mixed'])
    assert.deepEqual(visibleTree(tree, '/Users/me/other-repo').map(node => node.id), ['everywhere', 'elsewhere', 'mixed'])
  })

  it('hides every scoped capsule when the host named no directory', () => {
    assert.deepEqual(visibleTree(tree, undefined).map(node => node.id), ['everywhere'])
  })

  it('drops a group whose children were all filtered out', () => {
    const only = [group([elsewhere], { id: 'only' })]
    assert.deepEqual(visibleTree(only, '/Users/me/my-app'), [])
    assert.deepEqual(visibleChildren(only[0], '/Users/me/my-app'), [])
  })
})

describe('workspaceName', () => {
  it('records the directory name the ledger column expects', () => {
    assert.equal(workspaceName('/Users/me/app/portico'), 'portico')
    assert.equal(workspaceName('/Users/me/app/portico/'), 'portico')
    assert.equal(workspaceName('portico'), 'portico')
  })

  it('records an unnamed directory as an empty column', () => {
    assert.equal(workspaceName(undefined), '')
    assert.equal(workspaceName('/'), '')
  })
})
