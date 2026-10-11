/**
 * How the ledger is read: what "today" means, what one day holds, and who the
 * capsules a row refers to are.
 *
 * Every day boundary in this plugin is the reader's own local midnight,
 * and the calendar itself lives in `localtime.ts`. The ledger's own rows go
 * stale in one way the tree does not: a capsule may be deleted after it was
 * pressed, so a row is joined against today's tree by id, and a row that
 * matches nothing is still drawn, named by its id and marked 已删除.
 */

import type { PillTree, UsageRecord } from '../types/index.ts'
import { dayKeyOf } from './localTime.ts'

/** One capsule as the ledger needs it: stored, or only named by a row. */
export interface PillIdentity {
  readonly id: string
  readonly name: string
  readonly quick: boolean
}

/**
 * Join the stored tree against the ledger.
 *
 * A capsule that is still in the tree takes its stored name and its 快速 mark;
 * one the ledger knows and the tree no longer holds keeps its id and is named
 * by that id, because a file never wrote the name down.
 * @param tree - the stored tree.
 * @param rows - the ledger rows.
 * @returns one identity per capsule, stored ones first.
 */
export function knownPills(tree: PillTree, rows: readonly UsageRecord[]): PillIdentity[] {
  const pills = new Map<string, PillIdentity>()
  for (const node of tree) {
    if (node.kind === 'pill') pills.set(node.id, { id: node.id, name: node.name, quick: node.quick })
    else for (const child of node.children) pills.set(child.id, { id: child.id, name: child.name, quick: child.quick })
  }
  const rowsByPill = new Map<string, number>()
  for (const row of rows) {
    rowsByPill.set(row.pillId, (rowsByPill.get(row.pillId) ?? 0) + 1)
    if (!pills.has(row.pillId)) pills.set(row.pillId, { id: row.pillId, name: row.pillId, quick: false })
  }
  // The busiest capsule leads: a list of everything ever pressed is long, and
  // the one the reader is looking for is almost always near its top.
  return [...pills.values()].sort((left, right) => (rowsByPill.get(right.id) ?? 0) - (rowsByPill.get(left.id) ?? 0))
}

/** One row of the picker table: what it is called, and what it holds. */
export interface PickerRow {
  /**
   * What the first column says: a fold's name, or a first-level capsule's own.
   *
   * The row that holds the capsules standing on their own has no owner, so it
   * carries no label — the first column is the table's own margin, and that row
   * is its head.
   */
  readonly label: string
  /** Empty for a fold and for the head row; the capsule's id for a lone one. */
  readonly id: string
  /** How the row is read, so the panel can word the generic ones. */
  readonly kind: 'top' | 'group' | 'pill' | 'gone'
  /** The capsules this row offers. */
  readonly pills: readonly PillIdentity[]
}

/**
 * The picker as a table: one row per owner, its capsules beside it.
 *
 * The head row holds the capsules that stand on their own — the ones no fold
 * holds, and so the ones with no other row to appear in — then each fold with
 * its children in stored order, then whatever the tree has dropped but the
 * ledger still remembers. A capsule inside a fold is offered once, on that
 * fold's row: the table is a way to find one capsule, and a name listed twice
 * only makes the reader check whether the two are the same.
 * @param tree - the stored tree.
 * @param rows - the ledger, which is what knows about deleted capsules.
 * @returns the rows, in the order the table draws them.
 */
export function pickerRows(tree: PillTree, rows: readonly UsageRecord[]): PickerRow[] {
  const table: PickerRow[] = []
  const alone: PillIdentity[] = []
  const folds: PickerRow[] = []
  for (const node of tree) {
    if (node.kind === 'pill') {
      alone.push({ id: node.id, name: node.name, quick: node.quick })
      continue
    }
    const children = node.children.map(child => ({ id: child.id, name: child.name, quick: child.quick }))
    if (children.length > 0) folds.push({ label: node.name, id: node.id, kind: 'group', pills: children })
  }
  table.push({ label: '', id: '', kind: 'top', pills: alone }, ...folds)

  // What the ledger remembers but the tree no longer holds. The busiest leads
  // here: there are no stored names to keep in order, and this tail is only
  // ever looked through by frequency. The row carries no wording of its own —
  // how it is captioned is the panel's business, and this module stays free of
  // any one language.
  const stored = new Set(table.flatMap(row => row.pills.map(pill => pill.id)))
  const gone = new Map<string, number>()
  for (const row of rows) {
    if (!stored.has(row.pillId)) gone.set(row.pillId, (gone.get(row.pillId) ?? 0) + 1)
  }
  const orphans = [...gone.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => ({ id, name: id, quick: false }))
  if (orphans.length > 0) table.push({ label: '', id: '', kind: 'gone', pills: orphans })
  return table
}

/**
 * The rows of one local day.
 * @param rows - the ledger rows to filter.
 * @param day - an instant inside the wanted day.
 * @returns the rows of that day, oldest first.
 */export function rowsOfDay(rows: readonly UsageRecord[], day: Date): UsageRecord[] {
  const key = dayKeyOf(day)
  return rows
    .filter(row => {
      const at = Date.parse(row.at)
      return !Number.isNaN(at) && dayKeyOf(new Date(at)) === key
    })
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
}

/**
 * How many ledger rows belong to the day an instant falls in.
 *
 * A row stamped on another local day, or in the future, is not today's; a row
 * whose instant cannot be parsed is skipped rather than counted.
 * @param rows - the ledger rows to count.
 * @param now - the instant whose local day is "today".
 * @returns the number of rows in that day.
 */
export function countToday(rows: readonly UsageRecord[], now: Date): number {
  const today = dayKeyOf(now)
  return rows.filter(row => {
    const at = Date.parse(row.at)
    return !Number.isNaN(at) && dayKeyOf(new Date(at)) === today
  }).length
}
