/**
 * Where a confirmed suggestion lands.
 *
 * Two rules, both pure functions of the tree, so the confirmation list can
 * explain itself before the reader presses anything: a named group that exists
 * takes the capsule at its end, and everything else becomes a first-level entry
 * — including a group the model invented, which is labelled rather than
 * dropped.
 */

import type { Pill, PillGroup, PillTree } from '../types/index.ts'
import type { Text } from '../types/index.ts'

/**
 * Whether the tree has a group by this name.
 * @param tree - the tree to search.
 * @param name - the group name, or `null`.
 * @returns the group when one exists.
 */
function groupNamed(tree: PillTree, name: string | null): PillGroup | undefined {
  if (name === null || name.length === 0) return undefined
  return tree.find((node): node is PillGroup => node.kind === 'group' && node.name === name)
}

/**
 * Put one capsule where the suggestion said.
 *
 * Nothing is dropped: a group name that matches no existing group makes the
 * capsule a first-level entry instead, and the confirmation list says so.
 * @param tree - the tree to edit.
 * @param pill - the capsule to add.
 * @param groupName - the suggested group name, or `null`.
 * @returns a new tree with the capsule at the end of its target.
 */
export function insertSuggestion(tree: PillTree, pill: Pill, groupName: string | null): PillTree {
  const group = groupNamed(tree, groupName)
  if (group === undefined) return [...tree, pill]
  return tree.map(node => (node === group ? { ...group, children: [...group.children, pill] } : node))
}

/**
 * One line saying where this suggestion would land.
 * @param tree - the current tree.
 * @param groupName - the suggested group name, or `null`.
 * @param t - the asker for the panel's language.
 * @returns the sentence shown under the suggestion.
 */
export function suggestionGroupNote(tree: PillTree, groupName: string | null, t: Text): string {
  if (groupName === null || groupName.length === 0) return t('suggestions.landsEndFirstLevel')
  if (groupNamed(tree, groupName) !== undefined) return t('suggestions.landsEndGroupGroup', { group: groupName })
  return t('suggestions.inventedGroup', { group: groupName })
}
