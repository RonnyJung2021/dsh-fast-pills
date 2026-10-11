/**
 * The two data files, and the discipline their writers follow.
 *
 * `pills.json` is the whole capsule tree: read whole, written whole, replaced
 * atomically through a sibling temporary file. `usage.jsonl` is a ledger: rows
 * are appended and history is never rewritten. Every operation of one store
 * runs behind a single queue, so the host half is the only writer and its own
 * writes never interleave. The settings page's two clean-up actions are the one
 * exception to both habits, and they say so by deleting a whole file: the tree
 * file back to the seed, the ledger file gone.
 *
 * Both files are allowed to be wrong without taking the plugin down: a tree
 * that cannot be read is moved aside and replaced by the seed, and a ledger row
 * that cannot be read is skipped.
 */

import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { PILLS_BACKUP_PREFIX, PILLS_FILE, USAGE_FILE } from '../../shared/constants/index.ts'
import type { PillTree, UsageRecord } from '../../shared/types/index.ts'

/** One read of the capsule tree. */
export interface PillsRead {
  readonly tree: PillTree
  /** Set when the file could not be read and was replaced by the seed. */
  readonly backup?: string
}

/** Inclusive instant range for a ledger read; either end may be left open. */
export interface UsageRange {
  readonly from?: string
  readonly to?: string
}

/** This plugin's file layer. */
export interface Store {
  /**
   * Read the capsule tree, writing the seed when the file is absent.
   * @returns the tree, plus the moved-aside file name when the old one was unreadable.
   */
  readPills(): Promise<PillsRead>
  /** Replace the tree in one atomic step. */
  writePills(tree: PillTree): Promise<void>
  /**
   * Throw the stored tree away and put the seed back in its place.
   *
   * The settings page's reset: the file is removed first, so the seed is what
   * a reader finds whether or not this call finishes the rewrite.
   * @returns the seed tree now on disk.
   */
  resetPills(): Promise<PillsRead>
  /** Append one ledger row. */
  appendUsage(record: UsageRecord): Promise<void>
  /** Empty the ledger, for the settings page's clear action. */
  clearUsage(): Promise<void>
  /**
   * Read the ledger.
   * @param range - inclusive bounds on the row instant; neither bound is required.
   * @returns the readable rows inside the range, in file order.
   */
  readUsage(range?: UsageRange): Promise<UsageRecord[]>
}

/** Counts temporary file names, so two writers never share one. */
let temporaryCounter = 0

/**
 * Read one capsule tree value against the stored shape.
 * @param value - parsed JSON, or anything else.
 * @returns a description of the first problem, or `null` when it is a tree.
 */
export function pillTreeProblem(value: unknown): string | null {
  if (!Array.isArray(value)) return 'the tree must be an array'
  for (const [index, node] of value.entries()) {
    const where = `entry ${String(index)}`
    if (typeof node !== 'object' || node === null) return `${where} must be an object`
    const record = node as Record<string, unknown>
    if (typeof record['id'] !== 'string' || record['id'].length === 0) return `${where} needs a non-empty id`
    if (typeof record['name'] !== 'string') return `${where} needs a name`
    if (record['kind'] === 'pill') {
      const problem = pillProblem(record, where)
      if (problem !== null) return problem
      continue
    }
    if (record['kind'] === 'group') {
      const scope = record['scope']
      if (scope !== undefined && (!Array.isArray(scope) || scope.some(entry => typeof entry !== 'string'))) {
        return `${where} needs a scope of strings`
      }
      const children = record['children']
      if (!Array.isArray(children)) return `${where} is a group without children`
      for (const [childIndex, child] of children.entries()) {
        const childWhere = `${where} child ${String(childIndex)}`
        if (typeof child !== 'object' || child === null) return `${childWhere} must be an object`
        const childRecord = child as Record<string, unknown>
        if (childRecord['kind'] !== 'pill') return `${childWhere} must be a capsule; groups do not nest`
        if (typeof childRecord['id'] !== 'string' || childRecord['id'].length === 0) return `${childWhere} needs a non-empty id`
        if (typeof childRecord['name'] !== 'string') return `${childWhere} needs a name`
        const problem = pillProblem(childRecord, childWhere)
        if (problem !== null) return problem
      }
      continue
    }
    return `${where} must be a pill or a group`
  }
  return null
}

/**
 * Read one ledger row against the stored shape.
 * @param value - parsed JSON, or anything else.
 * @returns a description of the first problem, or `null` when it is a row.
 */
export function usageRecordProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'a row must be an object'
  const record = value as Record<string, unknown>
  if (typeof record['at'] !== 'string' || Number.isNaN(Date.parse(record['at']))) return 'a row needs a parseable `at` instant'
  if (typeof record['pillId'] !== 'string' || record['pillId'].length === 0) return 'a row needs a non-empty `pillId`'
  if (typeof record['workspace'] !== 'string') return 'a row needs a `workspace` string'
  if (typeof record['session'] !== 'string') return 'a row needs a `session` string'
  return null
}

/**
 * Check the fields every capsule carries.
 * @param record - the candidate capsule.
 * @param where - position text for the message.
 * @returns a description of the first problem, or `null`.
 */
function pillProblem(record: Record<string, unknown>, where: string): string | null {
  if (typeof record['body'] !== 'string') return `${where} needs a body`
  if (record['skill'] !== null && typeof record['skill'] !== 'string') return `${where} needs a skill name or null`
  if (typeof record['quick'] !== 'boolean') return `${where} needs a quick flag`
  const scope = record['scope']
  if (!Array.isArray(scope) || scope.some(entry => typeof entry !== 'string')) return `${where} needs a scope of workspace names`
  return null
}

/** The file text of one tree: pretty-printed, newline-terminated. */
function renderTree(tree: PillTree): string {
  return `${JSON.stringify(tree, undefined, 2)}\n`
}

/** Build this plugin's file layer over one directory. */
export function createStore(dir: string, seedTree: () => Promise<PillTree>): Store {
  const pillsPath = join(dir, PILLS_FILE)
  const usagePath = join(dir, USAGE_FILE)
  let queue: Promise<unknown> = Promise.resolve()

  /**
   * Run one operation after the previous one settled, whatever its outcome.
   * @param operation - the file work to run alone.
   * @returns the operation's result.
   */
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation)
    queue = next.catch(() => undefined)
    return next
  }

  /**
   * Replace one file through a sibling temporary file, so a reader never sees a half-written tree.
   * @param path - file to replace.
   * @param text - its complete next content.
   */
  async function writeAtomic(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    temporaryCounter += 1
    const temporary = `${path}.${String(process.pid)}-${String(temporaryCounter)}.tmp`
    await writeFile(temporary, text, { mode: 0o600 })
    await rename(temporary, path)
  }

  /**
   * Move an unreadable tree aside and start from the seed.
   * @returns the seed tree and the backup file name.
   */
  async function repair(): Promise<PillsRead> {
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
    const backup = `${PILLS_BACKUP_PREFIX}${stamp}`
    await rename(pillsPath, join(dir, backup))
    const seed = await seedTree()
    await writeAtomic(pillsPath, renderTree(seed))
    return { tree: seed, backup }
  }

  /**
   * Put the seed tree on disk, replacing whatever was there.
   * @returns the seed tree.
   */
  async function seed(): Promise<PillsRead> {
    const seed = await seedTree()
    await writeAtomic(pillsPath, renderTree(seed))
    return { tree: seed }
  }

  return {
    readPills: () => serialize(async () => {
      let text: string
      try {
        text = await readFile(pillsPath, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        return await seed()
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return await repair()
      }
      if (pillTreeProblem(parsed) !== null) return await repair()
      return { tree: parsed as PillTree }
    }),

    writePills: tree => serialize(async () => {
      await writeAtomic(pillsPath, renderTree(tree))
    }),

    resetPills: () => serialize(async () => {
      await rm(pillsPath, { force: true })
      return await seed()
    }),

    appendUsage: record => serialize(async () => {
      await mkdir(dir, { recursive: true, mode: 0o700 })
      await appendFile(usagePath, `${JSON.stringify(record)}\n`, { mode: 0o600 })
    }),

    clearUsage: () => serialize(async () => {
      await rm(usagePath, { force: true })
    }),

    readUsage: (range = {}) => serialize(async () => {
      let text: string
      try {
        text = await readFile(usagePath, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        return []
      }
      const from = range.from === undefined ? undefined : Date.parse(range.from)
      const to = range.to === undefined ? undefined : Date.parse(range.to)
      const rows: UsageRecord[] = []
      for (const line of text.split('\n')) {
        if (line.trim().length === 0) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(line)
        } catch {
          continue
        }
        if (usageRecordProblem(parsed) !== null) continue
        const record = parsed as UsageRecord
        const at = Date.parse(record.at)
        if (from !== undefined && at < from) continue
        if (to !== undefined && at > to) continue
        rows.push(record)
      }
      return rows
    }),
  }
}
