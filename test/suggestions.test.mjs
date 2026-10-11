/**
 * Where a confirmed suggestion lands.
 *
 * The two functions are pure over the tree, so the confirmation list can say
 * what it will do before the reader presses anything — including the case
 * worth calling out by name: a group the model invented.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { textFor } from '../src/shared/locales/index.ts'
import { insertSuggestion, suggestionGroupNote } from '../src/shared/utils/suggestions.ts'

/** The asker the panel hands down; the tests read the Chinese wording. */
const zh = textFor('zh')

/** One capsule. */
function pill(id, fields = {}) {
  return { kind: 'pill', id, name: id, body: '', skill: null, quick: false, scope: [], ...fields }
}

/** One group. */
function group(id, name, children = []) {
  return { kind: 'group', id, name, scope: [], children }
}

/** The tree most cases start from: one plain capsule and one group. */
function tree() {
  return [pill('p1', { name: '继续' }), group('g1', '普通', [pill('p2', { name: 'multi-task' })])]
}

describe('confirming a suggestion', () => {
  it('puts a named capsule at the end of the group it asked for', () => {
    const next = insertSuggestion(tree(), pill('new', { name: '新胶囊' }), '普通')
    assert.deepEqual(next.map(node => node.id), ['p1', 'g1'])
    assert.deepEqual(next[1].children.map(child => child.id), ['p2', 'new'])
  })

  it('makes it a first-level entry when the suggestion named no group', () => {
    const next = insertSuggestion(tree(), pill('new'), null)
    assert.deepEqual(next.map(node => node.id), ['p1', 'g1', 'new'])
  })

  it('makes it a first-level entry when the named group does not exist', () => {
    const next = insertSuggestion(tree(), pill('new'), '插件制作DSH')
    assert.deepEqual(next.map(node => node.id), ['p1', 'g1', 'new'])
  })

  it('leaves the original tree untouched', () => {
    const before = tree()
    insertSuggestion(before, pill('new'), '普通')
    assert.deepEqual(before[1].children.map(child => child.id), ['p2'])
  })
})

describe('the line under a suggestion', () => {
  it('says which existing group takes it', () => {
    assert.equal(suggestionGroupNote(tree(), '普通', zh), '将插入分组「普通」的末尾。')
  })

  it('tells the reader an invented group is not used, without dropping the suggestion', () => {
    assert.equal(suggestionGroupNote(tree(), '插件制作DSH', zh), '原建议分组「插件制作DSH」不存在，将作为一级条目插入末尾。')
  })

  it('says a top-level suggestion is top-level', () => {
    assert.equal(suggestionGroupNote(tree(), null, zh), '将作为一级条目插入末尾。')
    assert.equal(suggestionGroupNote(tree(), '', zh), '将作为一级条目插入末尾。')
  })
})
