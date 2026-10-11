/**
 * The settings page's edits, as pure rules over the tree.
 *
 * Every one of them answers a tree the host's `PUT /pills` accepts, which is
 * what lets the page edit optimistically: the panel only publishes the result.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  addGroup, addPill, countEntries, move, moveChild, moveNode, movePill, newId, removeGroup, removePill,
  renameNode, updatePill,
} from '../src/shared/utils/pillTree.ts'

/** One capsule. */
function pill(id, fields = {}) {
  return { kind: 'pill', id, name: id, body: '', skill: null, quick: false, scope: [], ...fields }
}

/** One group. */
function group(id, children = [], fields = {}) {
  return { kind: 'group', id, name: id, scope: [], children, ...fields }
}

/** The ids of the first level, for a compact assertion. */
function ids(tree) {
  return tree.map(node => node.id)
}

describe('newId', () => {
  it('mints a unique, kind-prefixed identity', () => {
    const first = newId('pill')
    assert.match(first, /^pill-[0-9a-f]{8}$/u)
    assert.notEqual(first, newId('pill'))
    assert.match(newId('group'), /^group-/u)
  })
})

describe('move', () => {
  it('lands the item on the index it was dropped on', () => {
    assert.deepEqual(move(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
    assert.deepEqual(move(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
    assert.deepEqual(move(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c'])
  })

  it('leaves the original list alone and survives a stray index', () => {
    const items = ['a', 'b']
    assert.deepEqual(move(items, 0, 1), ['b', 'a'])
    assert.deepEqual(items, ['a', 'b'])
    assert.deepEqual(move(items, 9, 0), ['a', 'b'])
  })
})

describe('addPill', () => {
  it('puts a new capsule at the top of the first level, and of a group', () => {
    const tree = [group('g', [pill('a')]), pill('b')]
    assert.deepEqual(ids(addPill(tree, { kind: 'top' }, pill('c'))), ['c', 'g', 'b'])
    const inside = addPill(tree, { kind: 'group', groupId: 'g' }, pill('c'))
    assert.deepEqual(ids(inside[0].children), ['c', 'a'])
    assert.equal(inside.length, 2, 'a group target adds no first-level entry')
  })

  it('ignores a group that is not there', () => {
    const tree = [group('g', [])]
    assert.deepEqual(addPill(tree, { kind: 'group', groupId: 'nope' }, pill('c')), tree)
  })
})

describe('addGroup', () => {
  it('appends an empty group and hands back its identity', () => {
    const made = addGroup([pill('a')], '新分组')
    assert.deepEqual(ids(made.tree), ['a', made.group.id])
    assert.deepEqual(made.group.children, [])
    assert.equal(made.group.name, '新分组')
  })
})

describe('renameNode and updatePill', () => {
  it('renames a capsule or a group, wherever it sits', () => {
    const tree = [group('g', [pill('a')]), pill('b')]
    assert.equal(renameNode(tree, 'a', '甲')[0].children[0].name, '甲')
    assert.equal(renameNode(tree, 'g', '组名')[0].name, '组名')
  })

  it('rewrites a capsule’s features and leaves its neighbours', () => {
    const tree = [group('g', [pill('a'), pill('b')])]
    const edited = updatePill(tree, pill('a', { name: '甲', quick: true, skill: 'zen', scope: ['my-app'] }))
    assert.deepEqual(edited[0].children[0], pill('a', { name: '甲', quick: true, skill: 'zen', scope: ['my-app'] }))
    assert.deepEqual(edited[0].children[1], pill('b'))
  })
})

describe('removePill', () => {
  it('deletes a first-level capsule and a group child alike', () => {
    const tree = [group('g', [pill('a'), pill('b')]), pill('c')]
    const withoutA = removePill(tree, 'a')
    assert.deepEqual(ids(withoutA[0].children), ['b'])
    assert.deepEqual(ids(removePill(tree, 'c')), ['g'])
    assert.deepEqual(ids(removePill(tree, 'nope')), ['g', 'c'])
  })
})

describe('removeGroup', () => {
  it('takes the children with it, or lifts them to the first level where it stood', () => {
    const tree = [pill('x'), group('g', [pill('a'), pill('b')]), pill('y')]
    assert.deepEqual(ids(removeGroup(tree, 'g', 'children')), ['x', 'y'])
    assert.deepEqual(ids(removeGroup(tree, 'g', 'promote')), ['x', 'a', 'b', 'y'])
  })

  it('leaves a tree without that group alone', () => {
    const tree = [pill('x')]
    assert.deepEqual(removeGroup(tree, 'g', 'promote'), tree)
  })
})

describe('moveNode and moveChild', () => {
  it('reorders the first level, groups included', () => {
    const tree = [pill('a'), group('g', []), pill('b')]
    assert.deepEqual(ids(moveNode(tree, 2, 0)), ['b', 'a', 'g'])
    assert.deepEqual(ids(moveNode(tree, 0, 2)), ['g', 'b', 'a'])
  })

  it('reorders one group’s capsules and touches no other level', () => {
    const tree = [group('g', [pill('a'), pill('b')]), group('h', [pill('c'), pill('d')])]
    const moved = moveChild(tree, 'g', 0, 1)
    assert.deepEqual(ids(moved[0].children), ['b', 'a'])
    assert.deepEqual(ids(moved[1].children), ['c', 'd'])
    assert.deepEqual(ids(moveChild(tree, 'nope', 0, 1)), ['g', 'h'])
  })

  it('carries a first-level capsule into a fold, at the index it was dropped on', () => {
    const tree = [pill('a'), group('g', [pill('b'), pill('c')])]
    const top = movePill(tree, 'a', { kind: 'group', groupId: 'g' }, 0)
    assert.deepEqual(ids(top), ['g'])
    assert.deepEqual(ids(top[0].children), ['a', 'b', 'c'])
    const middle = movePill(tree, 'a', { kind: 'group', groupId: 'g' }, 1)
    assert.deepEqual(ids(middle[0].children), ['b', 'a', 'c'])
    const end = movePill(tree, 'a', { kind: 'group', groupId: 'g' }, 2)
    assert.deepEqual(ids(end[0].children), ['b', 'c', 'a'])
  })

  it('reorders inside one fold and back out to the first level', () => {
    const tree = [group('g', [pill('a'), pill('b'), pill('c')]), pill('z')]
    const down = movePill(tree, 'a', { kind: 'group', groupId: 'g' }, 2)
    assert.deepEqual(ids(down[0].children), ['b', 'c', 'a'])
    const up = movePill(tree, 'c', { kind: 'group', groupId: 'g' }, 0)
    assert.deepEqual(ids(up[0].children), ['c', 'a', 'b'])
    const out = movePill(tree, 'b', { kind: 'top' }, 1)
    assert.deepEqual(ids(out), ['g', 'b', 'z'])
    assert.deepEqual(ids(out[0].children), ['a', 'c'])
  })
})

describe('countEntries', () => {
  it('counts what a reset would throw away', () => {
    const tree = [pill('a'), group('g', [pill('b'), pill('c')]), group('h', [])]
    assert.deepEqual(countEntries(tree), { pills: 3, groups: 2 })
    assert.deepEqual(countEntries([]), { pills: 0, groups: 0 })
  })
})
