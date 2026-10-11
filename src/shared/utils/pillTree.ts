/**
 * Every edit the settings page can make, as a pure function of the tree.
 *
 * One tree, two levels, never nested: an entry is a capsule or a group, and a
 * group's children are capsules. All of these answer a new tree in the shape
 * the host half's `PUT /pills` accepts, so the panel only has to publish the
 * result — the rules themselves are testable without a page.
 */

import type { Pill, PillGroup, PillNode, PillTree } from '../types/index.ts'

/** Where a new capsule goes. */
export type PillTarget =
  | { readonly kind: 'top' }
  | { readonly kind: 'group'; readonly groupId: string }

/** How a deleted group treats the capsules that were inside it. */
export type GroupRemoval = 'children' | 'promote'

/**
 * Mint an id for a new entry.
 *
 * The ledger refers to capsules by id, so it has to be unique on its own
 * rather than reused after a delete; a random name is the cheapest way to
 * guarantee that without keeping a counter in the file.
 * @param prefix - `pill` or `group`, so a stored id says what it names.
 * @returns an id no other entry is using.
 */
export function newId(prefix: 'pill' | 'group'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Move one item inside a list.
 *
 * The item lands at the dropped-on item's own index, which pushes that item
 * down (or up) — dragging a row onto another is read as "put it here".
 * @param items - the list to reorder.
 * @param from - the item's index now.
 * @param to - the index it was dropped on.
 * @returns a new list; the original is untouched.
 */
export function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item === undefined) return next
  next.splice(to, 0, item)
  return next
}

/**
 * Put a capsule at the top of a level.
 *
 * The top is where it belongs: a capsule that was just made is the one the
 * reader is about to use, and hunting for it at the end of a long row is the
 * one thing the row cannot afford. The same rule holds for a press that moves
 * a capsule into a fold.
 * @param tree - the tree to edit.
 * @param target - the first level, or one group.
 * @param pill - the capsule to add.
 * @returns a new tree.
 */
export function addPill(tree: PillTree, target: PillTarget, pill: Pill): PillTree {
  return insertPill(tree, target, pill, 0)
}

/**
 * Put a capsule at one position of a level.
 * @param tree - the tree to edit.
 * @param target - the first level, or one group.
 * @param pill - the capsule to add.
 * @param index - where in that level it goes; past the end means the end.
 * @returns a new tree.
 */
export function insertPill(tree: PillTree, target: PillTarget, pill: Pill, index: number): PillTree {
  if (target.kind === 'top') {
    const next = [...tree]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, pill)
    return next
  }
  return tree.map(node => {
    if (node.kind !== 'group' || node.id !== target.groupId) return node
    const children = [...node.children]
    children.splice(Math.max(0, Math.min(index, children.length)), 0, pill)
    return { ...node, children }
  })
}

/**
 * Find one capsule, wherever it sits.
 * @param tree - the tree to search.
 * @param id - the capsule to find.
 * @returns the capsule, or `undefined` when the tree does not hold it.
 */
export function findPill(tree: PillTree, id: string): Pill | undefined {
  for (const node of tree) {
    if (node.kind === 'pill') {
      if (node.id === id) return node
      continue
    }
    const child = node.children.find(entry => entry.id === id)
    if (child !== undefined) return child
  }
  return undefined
}

/**
 * Move one capsule to a position of a level, from wherever it is.
 *
 * The two halves are separate on purpose: the capsule leaves its old place
 * first, so an index computed against the tree it came from still lands where
 * the reader pointed when the move stays on the same level.
 * @param tree - the tree to edit.
 * @param id - the capsule to move.
 * @param target - the level it lands on.
 * @param index - where in that level it goes.
 * @returns a new tree.
 */
export function movePill(tree: PillTree, id: string, target: PillTarget, index: number): PillTree {
  const pill = findPill(tree, id)
  if (pill === undefined) return tree
  return insertPill(removePill(tree, id), target, pill, index)
}

/**
 * Move one first-level entry to a new index among the first-level entries.
 * @param tree - the tree to edit.
 * @param id - the entry to move.
 * @param index - the index it lands on.
 * @returns a new tree.
 */
export function moveEntry(tree: PillTree, id: string, index: number): PillTree {
  const from = tree.findIndex(node => node.id === id)
  if (from < 0) return tree
  return move(tree, from, Math.max(0, Math.min(index, tree.length - 1)))
}

/**
 * Rewrite one group's scope and name.
 * @param tree - the tree to edit.
 * @param id - the group to edit.
 * @param patch - the fields to change.
 * @returns a new tree.
 */
export function editGroup(
  tree: PillTree,
  id: string,
  patch: { readonly name?: string; readonly scope?: readonly string[] },
): PillTree {
  return tree.map(node => (
    node.kind === 'group' && node.id === id ? { ...node, ...patch } : node
  ))
}

/**
 * Put a new, empty group at the end of the first level.
 * @param tree - the tree to edit.
 * @param name - the group's first name.
 * @returns a new tree and the id the group was given.
 */
export function addGroup(tree: PillTree, name: string): { readonly tree: PillTree; readonly group: PillGroup } {
  const group: PillGroup = { kind: 'group', id: newId('group'), name, scope: [], children: [] }
  return { tree: [...tree, group], group }
}

/**
 * Rename an entry.
 * @param tree - the tree to edit.
 * @param id - the entry to rename, at either level.
 * @param name - its new display name.
 * @returns a new tree.
 */
export function renameNode(tree: PillTree, id: string, name: string): PillTree {
  return tree.map(node => (node.id === id ? { ...node, name } : withChildren(node, edit)))
  function edit(child: Pill): Pill {
    return child.id === id ? { ...child, name } : child
  }
}

/**
 * Rewrite a capsule's body and features.
 * @param tree - the tree to edit.
 * @param pill - the capsule in its new shape; it is found by id, at either level.
 * @returns a new tree.
 */
export function updatePill(tree: PillTree, pill: Pill): PillTree {
  return tree.map(node => (
    node.kind === 'pill' && node.id === pill.id ? pill : withChildren(node, edit)
  ))
  function edit(child: Pill): Pill {
    return child.id === pill.id ? pill : child
  }
}

/**
 * Delete one capsule, wherever it sits.
 * @param tree - the tree to edit.
 * @param id - the capsule to delete.
 * @returns a new tree.
 */
export function removePill(tree: PillTree, id: string): PillTree {
  return tree
    .filter(node => node.id !== id)
    .map(node => (
      node.kind === 'group' ? { ...node, children: node.children.filter(child => child.id !== id) } : node
    ))
}

/**
 * Delete one group, deciding what happens to its capsules.
 * @param tree - the tree to edit.
 * @param id - the group to delete.
 * @param removal - `children` deletes them with it; `promote` lifts them to the first level.
 * @returns a new tree.
 */
export function removeGroup(tree: PillTree, id: string, removal: GroupRemoval): PillTree {
  const index = tree.findIndex(node => node.id === id && node.kind === 'group')
  if (index < 0) return tree
  const group = tree[index] as PillGroup
  if (removal === 'children') return tree.filter(node => node.id !== id)
  const next = [...tree]
  next.splice(index, 1, ...group.children)
  return next
}

/**
 * Reorder the first level.
 * @param tree - the tree to edit.
 * @param from - the entry's index now.
 * @param to - the index it was dropped on.
 * @returns a new tree.
 */
export function moveNode(tree: PillTree, from: number, to: number): PillTree {
  return move(tree, from, to)
}

/**
 * Reorder one group's capsules.
 * @param tree - the tree to edit.
 * @param groupId - the group whose children move.
 * @param from - the child's index now.
 * @param to - the index it was dropped on.
 * @returns a new tree.
 */
export function moveChild(tree: PillTree, groupId: string, from: number, to: number): PillTree {
  return tree.map(node => (
    node.kind === 'group' && node.id === groupId
      ? { ...node, children: move(node.children, from, to) }
      : node
  ))
}

/**
 * Count the capsules and the groups in one tree, for the reset warning.
 * @param tree - the tree to count.
 * @returns how many capsules and how many groups it holds.
 */
export function countEntries(tree: PillTree): { readonly pills: number; readonly groups: number } {
  let pills = 0
  let groups = 0
  for (const node of tree) {
    if (node.kind === 'pill') pills += 1
    else {
      groups += 1
      pills += node.children.length
    }
  }
  return { pills, groups }
}

/**
 * Rewrite one group's capsules, leaving a first-level capsule alone.
 * @param node - the entry to descend into.
 * @param edit - turns one child into its next shape.
 * @returns the entry, with its children edited when it is a group.
 */
function withChildren(node: PillNode, edit: (child: Pill) => Pill): PillNode {
  return node.kind === 'group' ? { ...node, children: node.children.map(edit) } : node
}
