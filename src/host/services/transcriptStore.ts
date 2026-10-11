/**
 * The session transcript: what the user sent, per session.
 *
 * It is the third data file beside `pills.json` and `usage.jsonl`, read whole
 * and written whole through a sibling temporary file. Every write masks its
 * text first and caps one session's history ({@link MAX_ENTRIES_PER_SESSION}),
 * so a long-running session cannot grow this file without bound. Two clean-up
 * verbs follow the settings page's habit — both delete data and say so by
 * naming exactly what they remove: one session, or the whole file.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { MAX_ENTRIES_PER_SESSION, TRANSCRIPT_FILE } from '../../shared/constants/index.ts'
import { mask, type MaskLabels } from '../../shared/utils/mask.ts'
import type { SessionTranscript, Transcript, TranscriptEntry } from '../../shared/types/index.ts'

/** One prompt as it arrives from the page. */
export interface TranscriptAppend {
  readonly sessionId: string
  readonly text: string
  readonly workspace: string
  readonly at?: string
}

/** This plugin's transcript file. */
export interface TranscriptStore {
  /**
   * Append one prompt to its session, masking it on the way in.
   * @param append - the prompt to record; `at` defaults to now.
   * @param labels - the markers to write for whatever it masks.
   * @returns the session's entries after the write.
   */
  append(append: TranscriptAppend, labels: MaskLabels): Promise<readonly TranscriptEntry[]>
  /**
   * Read the whole transcript.
   * @returns every session, oldest first.
   */
  read(): Promise<Transcript>
  /**
   * Read one session's prompts.
   * @param sessionId - the session to read.
   * @returns its entries, or an empty list when nothing was recorded.
   */
  readSession(sessionId: string): Promise<readonly TranscriptEntry[]>
  /**
   * Forget one session.
   * @param sessionId - the session to drop.
   * @returns whether the session had anything stored.
   */
  remove(sessionId: string): Promise<boolean>
  /** Forget every session, the batch clear. */
  clear(): Promise<void>
}

/** Counts temporary file names, so two writers never share one. */
let temporaryCounter = 0

/** Whether a value is a transcript entry this plugin wrote. */
function entryProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'an entry must be an object'
  const record = value as Record<string, unknown>
  if (typeof record['at'] !== 'string' || Number.isNaN(Date.parse(record['at']))) return 'an entry needs a parseable `at`'
  if (typeof record['text'] !== 'string') return 'an entry needs a `text` string'
  if (typeof record['workspace'] !== 'string') return 'an entry needs a `workspace` string'
  return null
}

/**
 * Read one transcript file's text against the stored shape.
 *
 * A session whose rows are broken is dropped whole rather than half-read; the
 * rest of the file still answers, which is the same forgiving stance the
 * ledger takes with a bad line.
 * @param text - the file text, or `undefined` while the file is absent.
 * @returns the readable sessions.
 */
export function transcriptOf(text: string | undefined): Transcript {
  if (text === undefined) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const sessions: SessionTranscript[] = []
  for (const value of parsed) {
    if (typeof value !== 'object' || value === null) continue
    const record = value as Record<string, unknown>
    const sessionId = record['sessionId']
    const entries = record['entries']
    if (typeof sessionId !== 'string' || sessionId.length === 0 || !Array.isArray(entries)) continue
    if (entries.some(entry => entryProblem(entry) !== null)) continue
    sessions.push({ sessionId, entries: entries as TranscriptEntry[] })
  }
  return sessions
}

/** The file text of one transcript: pretty-printed, newline-terminated. */
function render(transcript: Transcript): string {
  return `${JSON.stringify(transcript, undefined, 2)}\n`
}

/**
 * Build this plugin's transcript layer over one directory.
 * @param dir - the plugin's data directory.
 * @returns the transcript store.
 */
export function createTranscriptStore(dir: string): TranscriptStore {
  const path = join(dir, TRANSCRIPT_FILE)
  let queue: Promise<unknown> = Promise.resolve()

  /** Run one operation after the previous one settled, whatever its outcome. */
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation)
    queue = next.catch(() => undefined)
    return next
  }

  /** Read the file as it stands; an absent or broken file is an empty transcript. */
  async function current(): Promise<Transcript> {
    try {
      return transcriptOf(await readFile(path, 'utf8'))
    } catch {
      return []
    }
  }

  /** Replace the file through a sibling temporary file. */
  async function writeAtomic(next: Transcript): Promise<void> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    temporaryCounter += 1
    const temporary = `${path}.${String(process.pid)}-${String(temporaryCounter)}.tmp`
    await writeFile(temporary, render(next), { mode: 0o600 })
    await rename(temporary, path)
  }

  return {
    append: (append, labels) => serialize(async () => {
      const entry: TranscriptEntry = {
        at: append.at === undefined ? new Date().toISOString() : new Date(append.at).toISOString(),
        // The file only ever holds masked text.
        text: mask(append.text, labels),
        workspace: append.workspace,
      }
      const transcript = await current()
      const existing = transcript.find(session => session.sessionId === append.sessionId)
      const entries = [...(existing?.entries ?? []), entry].slice(-MAX_ENTRIES_PER_SESSION)
      const next = existing === undefined
        ? [...transcript, { sessionId: append.sessionId, entries }]
        : transcript.map(session => (session.sessionId === append.sessionId ? { sessionId: session.sessionId, entries } : session))
      await writeAtomic(next)
      return entries
    }),

    read: () => serialize(async () => await current()),

    readSession: sessionId => serialize(async () => {
      const session = (await current()).find(candidate => candidate.sessionId === sessionId)
      return session?.entries ?? []
    }),

    remove: sessionId => serialize(async () => {
      const transcript = await current()
      const next = transcript.filter(session => session.sessionId !== sessionId)
      if (next.length === transcript.length) return false
      await writeAtomic(next)
      return true
    }),

    clear: () => serialize(async () => {
      await rm(path, { force: true })
    }),
  }
}
