/**
 * The page's one read of the capsule tree, and its writes back to the host.
 *
 * The tree and the usage ledger are fetched once over the host half's route and
 * republished to every row and panel that subscribes; nothing is kept in
 * browser storage. The settings page edits that one published tree,
 * so a change lands in the row at the same instant it lands here, and the
 * statistics bucket the one published ledger. Writes leave through one queue,
 * in the order the user asked for them: the route's single-writer rule starts
 * at this end.
 */

import { DEGRADED_HEADER, PLUGIN_ID, ROUTE_PREFIX } from '../../shared/constants/index.ts'
import type { Locale, ReasoningEffort, ThemeChoice } from '../../shared/enums/index.ts'
import type {
  PillTree, RecognitionPreview, RecognitionResult, SessionTranscript,
  TranscriptEntry, UsageRecord,
} from '../../shared/types/index.ts'
import { normalizeTree } from '../../shared/utils/pillRules.ts'
import { countToday } from '../../shared/utils/usageStats.ts'

/** The capsule tree, read whole and written whole. */
const PILLS_ROUTE = `${ROUTE_PREFIX}/pills`

/** The usage ledger: read a range, append a row, or clear it. */
const USAGE_ROUTE = `${ROUTE_PREFIX}/usage`

/** The session transcript: append one prompt, list sessions, read or drop one. */
const TRANSCRIPT_ROUTE = `${ROUTE_PREFIX}/transcript`
const TRANSCRIPTS_ROUTE = `${ROUTE_PREFIX}/transcripts`

/** The custom prompt and the DeepSeek route. */
const SETTINGS_ROUTE = `${ROUTE_PREFIX}/settings`

/** Presence and writability of the DeepSeek key; never its value. */
const CREDENTIALS_ROUTE = `${ROUTE_PREFIX}/credentials`

/** The copy of the harness's own key into this plugin's store. */
const CREDENTIAL_SYNC_ROUTE = `${ROUTE_PREFIX}/credentials/sync`

/** Dropping the stored key. */
const CREDENTIAL_CLEAR_ROUTE = `${ROUTE_PREFIX}/credentials/clear`

/** The one manual recognition run, and the assembly that precedes it. */
const RECOGNIZE_ROUTE = `${ROUTE_PREFIX}/recognize`
const PREVIEW_ROUTE = `${ROUTE_PREFIX}/recognize/preview`

/** One session as the AI tab's list shows it. */
export interface TranscriptSummary {
  readonly sessionId: string
  readonly count: number
  /** Instant of the newest stored prompt, or an empty string when there is none. */
  readonly last: string
}

/** The custom prompt and the DeepSeek route, as the panel edits them. */
export interface PluginSettings {
  readonly customPrompt: string
  readonly provider: string
  readonly model: string
  readonly apiBase: string
  /** Which paper the panel is drawn on. */
  readonly theme: ThemeChoice
  /** Which language the panel speaks. */
  readonly locale: Locale
  /** How long a quick capsule waits before sending the draft, in milliseconds. */
  readonly quickDelayMs: number
  /** The drawer's width as a share of the page. */
  readonly drawerWidth: number
  /** The three colour families the panel paints with; empty means the shipped one. */
  readonly colors: Readonly<Record<'plain' | 'quick' | 'style' | 'scope', string>>
  /** Sampling temperature for the recognition call. */
  readonly temperature: number
  /** Nucleus sampling for the recognition call. */
  readonly topP: number
  /** Longest answer the model may write, in tokens. */
  readonly maxTokens: number
  /** How hard the model is asked to think before it answers (see the settings store). */
  readonly reasoningEffort: ReasoningEffort
}

/** The key's presence and writability. */
export interface CredentialFacts {
  readonly configured: boolean
  readonly writable: boolean
  readonly source?: string
  /** Whether the surrounding harness holds a DeepSeek key this plugin may copy. */
  readonly syncable?: boolean
  /** Fingerprint of the stored key (SHA-256, first eight hex digits); absent when none is stored. */
  readonly hint?: string
}

/** A rejected call, carrying what the host said. */
export class RouteError extends Error {
  /** The host's machine-readable code. */
  readonly code: string

  /**
   * @param code - the host's machine-readable code.
   * @param message - the host's sentence, shown as it stands.
   */
  constructor(code: string, message: string) {
    super(message)
    this.name = 'RouteError'
    this.code = code
  }
}

/** What the row and the panel know about the tree and the ledger. */
export interface PillStoreState {
  readonly status: 'loading' | 'ready' | 'error'
  /** The stored tree, in stored order; empty until the read lands. */
  readonly tree: PillTree
  /** Ledger rows recorded today, in the page's own local days. */
  readonly today: number
  /**
   * The whole ledger, oldest row first, as the statistics read it.
   *
   * `undefined` until the first read lands and again when that read failed; an
   * empty list is a ledger the host answered with nothing in it.
   */
  readonly usage?: readonly UsageRecord[]
  /** Why the read failed, for the row's one-line note. */
  readonly error?: string
  /** The file a damaged tree was moved to, when the host reported one. */
  readonly degraded?: string
  /** True when the browser cannot reach the route at all. */
  readonly offline?: boolean
}

/** The tree as the row and the settings page read it. */
export interface PillStore {
  getSnapshot(): PillStoreState
  subscribe(listener: () => void): () => void
  /** Read the tree and today's count again; a read already in flight is kept. */
  reload(): void
  /**
   * Replace the whole tree, publishing it before the write lands.
   * @param tree - the tree the user has just made.
   * @returns whether the host accepted the write.
   */
  save(tree: PillTree): Promise<boolean>
  /**
   * Put the default capsules back.
   * @returns whether the host accepted the write.
   */
  reset(): Promise<boolean>
  /**
   * Empty the usage ledger.
   * @returns whether the host accepted the write.
   */
  clearUsage(): Promise<boolean>
  /**
   * Record one inserting press, and count it.
   *
   * The row appends and waits for no answer: the press is already visible in
   * the draft, and a lost ledger line must not throw text away.
   * @param record - capsule, directory and session of the press.
   */
  notePress(record: Omit<UsageRecord, 'at'>): void
  /**
   * Count every row in the ledger, for the clear action's warning.
   * @returns the row count, or `undefined` when the ledger could not be read.
   */
  usageTotal(): Promise<number | undefined>
  /**
   * Record one submitted prompt into the transcript.
   *
   * The row does not wait: the prompt has already been sent, and losing a
   * transcript line must not disturb the conversation.
   * @param entry - session, text and directory of the submission.
   */
  notePrompt(entry: { readonly sessionId: string; readonly text: string; readonly workspace: string }): void
  /**
   * List the sessions the transcript holds.
   * @returns one row per session, newest prompt last; empty when the read failed.
   */
  transcripts(): Promise<TranscriptSummary[]>
  /**
   * Read one session's stored prompts, oldest first.
   * @param sessionId - the session to read.
   * @returns its entries; an unknown session answers with nothing.
   */
  transcript(sessionId: string): Promise<readonly TranscriptEntry[]>
  /**
   * Read one session's stored prompts.
   * @param sessionId - the session to read.
   * @returns its entries, masked as stored.
   */
  sessionTranscript(sessionId: string): Promise<SessionTranscript['entries']>
  /**
   * Forget one session's prompts, or every session's.
   * @param sessionId - the session to drop; omitted clears the whole transcript.
   * @returns whether the host accepted the call.
   */
  forgetTranscript(sessionId?: string): Promise<boolean>
  /**
   * Read the custom prompt and the DeepSeek route.
   * @returns the settings, or `undefined` when the read failed.
   */
  readSettings(): Promise<PluginSettings | undefined>
  /**
   * Store the custom prompt and the DeepSeek route.
   * @param patch - the fields to change.
   * @returns the settings after the write, or `undefined` when the write failed.
   */
  writeSettings(patch: Partial<PluginSettings>): Promise<PluginSettings | undefined>
  /**
   * Ask whether a DeepSeek key is configured; the value is never returned.
   * @returns presence and writability, or `undefined` when the call failed.
   */
  credentialFacts(): Promise<CredentialFacts | undefined>
  /**
   * Store a DeepSeek key in the harness credentials.
   * @param key - the key the reader typed.
   * @returns the facts after the write.
   * @throws {RouteError} when the store refused it.
   */
  storeCredential(key: string): Promise<CredentialFacts>
  /**
   * Copy the harness's own DeepSeek key into this plugin's store.
   *
   * The whole copy happens on the host side, so the value never reaches the
   * page: what comes back is the facts — including the fingerprint of the key
   * that is now stored.
   * @returns the facts as they stand after the copy.
   * @throws {RouteError} when the harness holds no DeepSeek key.
   */
  syncCredential(): Promise<CredentialFacts>
  /**
   * Drop the stored DeepSeek key; nothing resolves until one is stored again.
   * @returns the facts after the removal.
   * @throws {RouteError} when the host refused the request.
   */
  clearCredential(): Promise<CredentialFacts>
  /**
   * Assemble one request without sending it.
   * @param body - the session to analyse and the current capsules.
   * @returns exactly what a send would carry.
   * @throws {RouteError} when the host refused the request.
   */
  previewRecognize(body: {
    readonly sessionId: string
    readonly pills: PillTree
    readonly customPrompt?: string
    readonly model?: string
    readonly apiBase?: string
  }): Promise<RecognitionPreview>
  /**
   * Run one recognition.
   * @param body - the session to analyse and the current capsules.
   * @returns the suggestions to confirm.
   * @throws {RouteError} when the host refused or the model call failed.
   */
  recognize(body: {
    readonly sessionId: string
    readonly pills: PillTree
    readonly customPrompt?: string
    readonly model?: string
    readonly apiBase?: string
  }): Promise<RecognitionResult>
}

/**
 * Read and validate the tree answer.
 * @param fetchTree - performs the request.
 * @returns the tree half of the state, without the count or the ledger.
 */
async function loadTree(fetchTree: typeof fetch): Promise<Omit<PillStoreState, 'today' | 'usage'>> {
  const response = await fetchTree(PILLS_ROUTE, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    return { status: 'error', tree: [], error: `HTTP ${String(response.status)}` }
  }
  const body: unknown = await response.json()
  if (!Array.isArray(body)) {
    return { status: 'error', tree: [], error: 'the stored tree is not an array' }
  }
  const degraded = response.headers.get(DEGRADED_HEADER)
  return {
    status: 'ready',
    tree: normalizeTree(body as PillTree),
    ...(degraded === null ? {} : { degraded }),
  }
}

/**
 * Read ledger rows, optionally inside an inclusive instant range.
 * @param fetchTree - performs the request.
 * @param range - inclusive bounds; either end may be left open.
 * @returns the rows, or `undefined` when the ledger could not be read.
 */
export async function readUsage(
  fetchTree: typeof fetch,
  range: { readonly from?: string; readonly to?: string } = {},
): Promise<UsageRecord[] | undefined> {
  const query = new URLSearchParams()
  if (range.from !== undefined) query.set('from', range.from)
  if (range.to !== undefined) query.set('to', range.to)
  const suffix = query.size === 0 ? '' : `?${query.toString()}`
  try {
    const response = await fetchTree(`${USAGE_ROUTE}${suffix}`, { headers: { accept: 'application/json' } })
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    return Array.isArray(body) ? (body as UsageRecord[]) : undefined
  } catch {
    return undefined
  }
}

/**
 * Read the tree and the ledger again, from the page's own local midnight.
 *
 * Both are read together because they are published together: the row's count
 * and every statistics block are the same ledger seen at different widths, and
 * the ranges are cut from the page's clock rather than from the rows.
 * @param fetchTree - performs the requests.
 * @param now - the instant the page is reading at.
 * @returns the state to publish for this read.
 */
async function loadState(fetchTree: typeof fetch, now: Date): Promise<PillStoreState> {
  // The whole ledger, not only today's window: the statistics trend and range
  // tabs bucket the same rows by day, and one read answers all of them.
  const [tree, rows] = await Promise.all([loadTree(fetchTree), readUsage(fetchTree)])
  // A ledger the host could not answer for leaves the field off rather than
  // publishing an empty event list: "not read" and "nothing in it" differ.
  if (rows === undefined) return { ...tree, today: 0 }
  return { ...tree, today: countToday(rows, now), usage: rows }
}

/**
 * A rejected read is the page failing to reach the route at all, which on
 * `file:` and sandboxed pages is worth saying differently.
 * @param error - what the request threw.
 * @returns the state to publish.
 */
function failedState(error: unknown): PillStoreState {
  return {
    status: 'error',
    tree: [],
    today: 0,
    error: error instanceof Error ? error.message : String(error),
    offline: true,
  }
}

/**
 * Create one tree source.
 *
 * The read starts on the first subscription rather than here, so a caller that
 * only builds the handle does not touch the network.
 * @param fetchTree - the page's `fetch`; a parameter so the tests can drive the store.
 * @returns the tree source.
 */
export function createPillStore(fetchTree: typeof fetch): PillStore {
  let state: PillStoreState = { status: 'loading', tree: [], today: 0 }
  const listeners = new Set<() => void>()
  let reading = false
  let queue: Promise<unknown> = Promise.resolve()
  // Which read counts. A press also reads the ledger, and the read it jumped
  // ahead of was sent before the row existed, so that older answer must not
  // publish over the newer one's count.
  let generation = 0

  const publish = (next: PillStoreState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }

  /** Run one request after the previous one settled, whatever its outcome. */
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation)
    queue = next.catch(() => undefined)
    return next
  }

  /**
   * Read both files again, keeping one read in flight at a time.
   * @param started - the generation this read was sent at; an answer from a
   *   read two generations old is dropped rather than published over a newer one.
   */
  const read = (started = generation): void => {
    if (reading) return
    reading = true
    loadState(fetchTree, new Date()).then((next) => {
      generation += 1
      // Only the newest read publishes: an earlier one was cut before the
      // press whose row the page has already counted.
      if (started < generation - 1) return
      publish(next)
    }, (error: unknown) => { publish(failedState(error)) })
      .finally(() => { reading = false })
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      if (state.status === 'loading' && !reading) read()
      return () => {
        listeners.delete(listener)
      }
    },
    reload: read,

    save: (tree) => {
      // Published before the write is even queued: the row and the tree in the
      // panel are the same list, so an edit is visible at the keystroke.
      publish({ ...state, tree })
      return serialize(async () => {
        try {
          const response = await fetchTree(PILLS_ROUTE, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(tree),
          })
          if (response.ok) return true
          console.warn(`${PLUGIN_ID}: the tree was not saved`, response.status)
        } catch (error) {
          console.warn(`${PLUGIN_ID}: the tree was not saved`, error)
        }
        // The page must not claim an edit the host never took.
        read()
        return false
      })
    },

    reset: () => serialize(async () => {
      try {
        const response = await fetchTree(PILLS_ROUTE, { method: 'DELETE' })
        if (response.ok) {
          const body: unknown = await response.json()
          if (Array.isArray(body)) {
            publish({ status: 'ready', tree: normalizeTree(body as PillTree), today: state.today })
            return true
          }
        }
        console.warn(`${PLUGIN_ID}: the capsules were not reset`, response.status)
      } catch (error) {
        console.warn(`${PLUGIN_ID}: the capsules were not reset`, error)
      }
      return false
    }),

    clearUsage: () => serialize(async () => {
      try {
        const response = await fetchTree(USAGE_ROUTE, { method: 'DELETE' })
        if (response.ok) {
          // The statistics read the same published ledger, so they empty with
          // the row's count.
          publish({ ...state, today: 0, usage: [] })
          return true
        }
        console.warn(`${PLUGIN_ID}: the ledger was not cleared`, response.status)
      } catch (error) {
        console.warn(`${PLUGIN_ID}: the ledger was not cleared`, error)
      }
      return false
    }),

    notePress: (record) => {
      // Through the same queue as the edits: the page sends one write at a time.
      void serialize(async () => {
        if (await appendUsage(fetchTree, record)) {
          // The row's own instant is stamped by the host, which only answers
          // with the row count, so the ledger is read once more to learn it.
          // The read is queued behind this append, so it sees the row.
          publish({ ...state, today: state.today + 1 })
        }
        const rows = await readUsage(fetchTree)
        if (rows !== undefined) publish({ ...state, today: countToday(rows, new Date()), usage: rows })
      })
    },

    usageTotal: async () => {
      // The ledger this page already holds is the same file the host would
      // answer with; only a page that has never read it asks again.
      if (state.usage !== undefined) return state.usage.length
      const rows = await readUsage(fetchTree)
      return rows?.length
    },

    notePrompt: (entry) => {
      // Through the same queue as the other writes: the page sends one write
      // at a time, and a lost transcript line is reported, never raised (see
      // {@link appendUsage}).
      void serialize(async () => {
        try {
          const response = await fetchTree(TRANSCRIPT_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(entry),
          })
          if (!response.ok) console.warn(`${PLUGIN_ID}: the prompt was not recorded`, response.status)
        } catch (error) {
          console.warn(`${PLUGIN_ID}: the prompt was not recorded`, error)
        }
      })
    },

    transcript: async (sessionId) => {
      try {
        const body = await call(fetchTree, `${TRANSCRIPT_ROUTE}?session=${encodeURIComponent(sessionId)}`, 'GET')
        return Array.isArray(body) ? body as TranscriptEntry[] : []
      } catch (error) {
        console.warn(`${PLUGIN_ID}: the transcript was not read`, error)
        return []
      }
    },

    transcripts: async () => {
      try {
        const body = await call(fetchTree, TRANSCRIPTS_ROUTE, 'GET')
        return Array.isArray(body) ? body as TranscriptSummary[] : []
      } catch (error) {
        console.warn(`${PLUGIN_ID}: the transcript list was not read`, error)
        return []
      }
    },

    sessionTranscript: async (sessionId) => {
      try {
        const body = await call(fetchTree, `${TRANSCRIPT_ROUTE}?session=${encodeURIComponent(sessionId)}`, 'GET')
        return Array.isArray(body) ? body as SessionTranscript['entries'] : []
      } catch (error) {
        console.warn(`${PLUGIN_ID}: the transcript was not read`, error)
        return []
      }
    },

    forgetTranscript: async (sessionId) => {
      const route = sessionId === undefined
        ? TRANSCRIPTS_ROUTE
        : `${TRANSCRIPT_ROUTE}?session=${encodeURIComponent(sessionId)}`
      try {
        await call(fetchTree, route, 'DELETE')
        return true
      } catch (error) {
        console.warn(`${PLUGIN_ID}: the transcript was not cleared`, error)
        return false
      }
    },

    readSettings: async () => {
      const body = await call(fetchTree, SETTINGS_ROUTE, 'GET')
      return typeof body === 'object' && body !== null ? body as PluginSettings : undefined
    },

    writeSettings: async (patch) => {
      try {
        const body = await call(fetchTree, SETTINGS_ROUTE, 'PUT', patch)
        return typeof body === 'object' && body !== null ? body as PluginSettings : undefined
      } catch (error) {
        console.warn(`${PLUGIN_ID}: the settings were not saved`, error)
        return undefined
      }
    },

    credentialFacts: async () => {
      try {
        const body = await call(fetchTree, CREDENTIALS_ROUTE, 'GET')
        return typeof body === 'object' && body !== null ? body as CredentialFacts : undefined
      } catch {
        return undefined
      }
    },

    storeCredential: async (key) => {
      const body = await call(fetchTree, CREDENTIALS_ROUTE, 'PUT', { key })
      return body as CredentialFacts
    },

    syncCredential: async () => {
      const body = await call(fetchTree, CREDENTIAL_SYNC_ROUTE, 'POST')
      return body as CredentialFacts & { readonly key: string }
    },

    clearCredential: async () => {
      const body = await call(fetchTree, CREDENTIAL_CLEAR_ROUTE, 'POST')
      return body as CredentialFacts
    },

    previewRecognize: async (body) => {
      const answer = await call(fetchTree, PREVIEW_ROUTE, 'POST', body)
      return answer as RecognitionPreview
    },

    recognize: async (body) => {
      const answer = await call(fetchTree, RECOGNIZE_ROUTE, 'POST', body)
      return answer as RecognitionResult
    },
  }
}

/**
 * Make one call and hand back its JSON body.
 *
 * A non-2xx answer is the host explaining why it refused, so its sentence is
 * raised as-is instead of being invented here — 「没填 key」 is the host's
 * own answer.
 * @param fetchTree - the page's `fetch`.
 * @param route - path below the plugin prefix.
 * @param method - HTTP method.
 * @param body - JSON body, when the method carries one.
 * @returns the parsed body.
 * @throws {RouteError} when the request failed or the host answered non-2xx.
 */
export async function call(
  fetchTree: typeof fetch,
  route: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchTree(route, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    throw new RouteError('offline', error instanceof Error ? error.message : String(error))
  }
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text.length === 0 ? undefined : JSON.parse(text)
  } catch {
    parsed = undefined
  }
  if (response.ok) return parsed
  const failure = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  throw new RouteError(
    typeof failure['code'] === 'string' ? failure['code'] : `http-${String(response.status)}`,
    typeof failure['message'] === 'string' ? failure['message'] : `HTTP ${String(response.status)}`,
  )
}

/**
 * Append one usage row.
 *
 * The row's instant is left to the host half, which stamps it when the field
 * is missing, so the page and the ledger share one clock.
 * @param fetchTree - the page's `fetch`.
 * @param record - capsule, directory and session of the press.
 * @returns whether the row was written; never rejects.
 */
export async function appendUsage(
  fetchTree: typeof fetch,
  record: Omit<UsageRecord, 'at'>,
): Promise<boolean> {
  try {
    const response = await fetchTree(USAGE_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
    })
    if (!response.ok) {
      console.warn(`${PLUGIN_ID}: usage row was not written`, response.status)
      return false
    }
    return true
  } catch (error) {
    // The insert already happened; a lost ledger line is reported, not raised.
    console.warn(`${PLUGIN_ID}: usage row was not written`, error)
    return false
  }
}
