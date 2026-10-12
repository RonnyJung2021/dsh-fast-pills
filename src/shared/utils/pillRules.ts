/**
 * What a press inserts, which capsules the current directory may show, and which
 * workspace a new capsule starts limited to.
 *
 * These are the row's rules that hold no React: every one is a pure function of
 * the stored tree (or of the page's workspace list) and the session's directory,
 * so the tests drive them without a page. The component turns their answers into
 * buttons.
 */

import type { Pill, PillNode, PillTree, PillGroup } from '../types/index.ts'

/** What one press of a capsule puts into the draft. */
export interface PillInsertion {
  /** Text to splice at the editor selection. */
  readonly text: string
  /**
   * Whether this capsule submits the draft about a second later.
   *
   * A quick capsule with nothing to insert has nothing to send, so it stays
   * false and the press only records.
   */
  readonly quick: boolean
}

/**
 * Build the text one press writes.
 *
 * A capsule with a skill leads with `/skill`; a skill-less capsule writes its
 * body alone. With an empty body the skill keeps a trailing space and the
 * result is still written.
 * @param pill - the capsule that was pressed.
 * @returns the insertion, and whether the press also submits.
 */
export function pillInsertion(pill: Pill): PillInsertion {
  const text = pill.skill === null ? pill.body : `/${pill.skill} ${pill.body} `
  return { text, quick: pill.quick && text.trim().length > 0 }
}

/**
 * The text a capsule stands for, without the press-time trailing space.
 *
 * The prompt tells the model what each capsule writes, so it needs the same
 * words a press produces minus the padding that only matters when text
 * is spliced into a draft.
 * @param pill - the capsule to describe.
 * @returns the `/skill body`, or the plain body.
 */
export function pillToText(pill: Pill): string {
  return (pill.skill === null ? pill.body : `/${pill.skill} ${pill.body}`).trimEnd()
}

/**
 * Whether one scope entry names the directory the session sits in.
 *
 * An entry covers the directory it names and every directory below it. A
 * leading separator makes the entry a whole path, which has to qualify the
 * directory; without one — `my-app`, `another-repo`, the names the
 * editor writes — the entry names a directory, and the host reports absolute
 * paths, so it matches any one path segment.
 * @param scope - one scope entry.
 * @param directory - the session's working directory, or `undefined` when the host has not said.
 * @returns whether the entry covers that directory.
 */
export function scopeMatches(scope: string, directory: string | undefined): boolean {
  if (directory === undefined) return false
  const entry = scope.replace(/[\\/]+$/u, '')
  if (entry.length === 0) return false
  const path = directory.replace(/[\\/]+$/u, '')
  if (/^[\\/]/u.test(entry)) return path === entry || path.startsWith(`${entry}/`) || path.startsWith(`${entry}\\`)
  const segments = path.split(/[\\/]+/u).filter(segment => segment.length > 0)
  return segments.includes(entry)
}

/**
 * The scope a new capsule starts limited to: the workspace the session sits in.
 *
 * The deepest workspace covering the session's directory wins, so a session
 * opened inside a project that is itself a workspace is limited to that project
 * rather than to the directory holding it. A directory no workspace covers picks
 * nothing, which is the same as everywhere.
 * @param workspaces - the workspaces the page knows, each with its absolute path.
 * @param directory - the session's directory, when the host has said.
 * @returns the paths to limit it to, which is at most one.
 */
export function workspaceScope(
  workspaces: readonly { readonly path: string }[],
  directory: string | undefined,
): string[] {
  const deepest = workspaces
    .filter(item => scopeMatches(item.path, directory))
    .reduce<{ readonly path: string } | undefined>(
      (best, item) => (best === undefined || item.path.length > best.path.length ? item : best),
      undefined,
    )
  return deepest === undefined ? [] : [deepest.path]
}

/**
 * Whether the current directory may show this capsule.
 *
 * No scope means everywhere; a scoped capsule is hidden when the host reports
 * no directory at all.
 * @param pill - the capsule to test.
 * @param directory - the session's working directory, or `undefined`.
 * @returns whether the capsule belongs in the row.
 */
export function pillVisible(pill: Pill, directory: string | undefined): boolean {
  if (pill.scope.length === 0) return true
  return pill.scope.some(entry => scopeMatches(entry, directory))
}

/**
 * Fill in what an older stored tree leaves out.
 *
 * Groups gained a scope of their own after the first trees were written, so a
 * file on disk may hold a fold without one. Everything below reads the type as
 * written, and this is the one place a tree from the outside is made to match
 * it.
 * A tree that already carries every field is handed back untouched, so a read
 * that changes nothing does not hand the page a new array to re-render over.
 * @param tree - a tree as the host served it.
 * @returns the same tree, with every fold carrying a scope list.
 */
export function normalizeTree(tree: PillTree): PillTree {
  if (tree.every(node => node.kind !== 'group' || Array.isArray(node.scope))) return tree
  return tree.map(node => (
    node.kind === 'group' ? { ...node, scope: node.scope ?? [] } : node
  ))
}

/**
 * Whether a group's own scope covers the current directory.
 * @param group - the group capsule.
 * @param directory - the session's working directory, or `undefined`.
 * @returns whether the fold was scoped to this directory.
 */
export function groupVisible(group: PillGroup, directory: string | undefined): boolean {
  return group.scope.length > 0 && group.scope.some(entry => scopeMatches(entry, directory))
}

/**
 * The capsules of one group that the current directory shows, in order.
 *
 * The fold's scope and the capsule's own are taken together: either one
 * covering the directory is enough. A capsule with no scope of its own is
 * shown everywhere already, so a fold can only ever widen what its children
 * reach — never narrow it.
 * @param group - the group capsule.
 * @param directory - the session's working directory, or `undefined`.
 * @returns the visible children.
 */
export function visibleChildren(group: PillGroup, directory: string | undefined): Pill[] {
  const fold = groupVisible(group, directory)
  return group.children.filter(child => fold || pillVisible(child, directory))
}

/**
 * The first-level entries the row renders in this directory.
 *
 * A group that loses every child to the scope filter disappears with them, the
 * same rule as a group that was emptied in the settings.
 * @param tree - the stored tree.
 * @param directory - the session's working directory, or `undefined`.
 * @returns the visible entries, in stored order.
 */
export function visibleTree(tree: PillTree, directory: string | undefined): PillNode[] {
  return tree.filter((node) => {
    if (node.kind === 'pill') return pillVisible(node, directory)
    return visibleChildren(node, directory).length > 0
  })
}

/**
 * The workspace name one usage row records.
 *
 * The ledger stores the directory's name, not the path, matching the names the
 * scope entries and the seed already use; a path the host reported without a
 * name is recorded whole rather than dropped.
 * @param directory - the session's working directory, or `undefined`.
 * @returns the name to store, or an empty string when the host has not said.
 */
export function workspaceName(directory: string | undefined): string {
  if (directory === undefined) return ''
  const trimmed = directory.replace(/[\\/]+$/u, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return cut < 0 ? trimmed : trimmed.slice(cut + 1)
}
