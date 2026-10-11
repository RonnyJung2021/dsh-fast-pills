/**
 * The route table behind `/dsh-fast-pills`.
 *
 * One prefix route is registered on the engine's web server and everything the
 * browser half reads or writes goes through it, so the page keeps no durable
 * copy of anything. Keys are `METHOD /path` and the path is read from the
 * prefix's end.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import {
  DEGRADED_HEADER, DRAWER_WIDTH_MAX, DRAWER_WIDTH_MIN, MAX_BODY_BYTES, MAX_TOKENS_MAX,
  MAX_TOKENS_MIN, QUICK_DELAY_MAX_MS, QUICK_DELAY_MIN_MS, ROUTE_PREFIX, TEMPERATURE_MAX,
  TEMPERATURE_MIN, TOP_P_MAX, TOP_P_MIN,
} from '../../shared/constants/index.ts'
import {
  LOCALES, REASONING_EFFORTS, THEME_CHOICES, type Locale, type ReasoningEffort, type ThemeChoice,
} from '../../shared/enums/index.ts'
import type { PillTree, UsageRecord } from '../../shared/types/index.ts'
import { HttpError, readJsonBody, sendJson, sendMethodNotAllowed } from '../utils/http.ts'
import { pillTreeProblem, type Store } from '../services/pillStore.ts'
import { recognizeBodyOf, type Previewer, type Recognizer } from '../llm/recognition.ts'
import { maskLabels } from '../../shared/locales/index.ts'
import type { SettingsStore } from '../services/settingsStore.ts'
import type { TranscriptStore } from '../services/transcriptStore.ts'
import type { CredentialHandler } from '../services/credentialStore.ts'

/**
 * Whether a patched number is a whole number inside its bounds.
 * @param value - the value from the request body.
 * @param low - the lowest accepted value.
 * @param high - the highest accepted value.
 * @returns whether the route should store it.
 */
function bounded(value: unknown, low: number, high: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high
}

/**
 * Read a patched colour family: each of the three is taken only when it is a
 * literal this build can paint, and anything else keeps the stored value.
 * @param value - the body's `colors` field.
 * @returns the accepted fields, or `undefined` when none of them were usable.
 */
function colorsPatch(value: unknown): { readonly colors?: Readonly<Record<'plain' | 'quick' | 'style' | 'scope', string>> } {
  if (typeof value !== 'object' || value === null) return {}
  const stored = (value as Record<string, unknown>)
  const patch: Record<string, string> = {}
  // Only families the body actually named are taken: the settings layer merges
  // this over what is stored, and a family left out keeps its value.
  for (const id of ['plain', 'quick', 'style', 'scope'] as const) {
    const raw = stored[id]
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim().toLowerCase()
    if (trimmed === '' || /^#[0-9a-f]{6}$/u.test(trimmed)) patch[id] = trimmed
  }
  if (Object.keys(patch).length === 0) return {}
  return { colors: { ...DEFAULT_COLORS, ...patch } }
}

/** The three families as a full record, for a patch that named only some. */
const DEFAULT_COLORS: Readonly<Record<'plain' | 'quick' | 'style' | 'scope', string>> = {
  plain: '', quick: '', style: '', scope: '',
}

/**
 * The pictures the plugin card shows, by the name the card asks for.
 *
 * A closed list rather than a path: the card wants three known pictures, and a
 * route that took a path would be a route that reads whatever it is handed.
 */
const CARD_SHOTS: readonly string[] = ['row', 'drawer', 'recognize']

/** Where the shipped pictures sit, seen from the built host half in `lib/`. */
const ASSET_DIR = new URL('../assets/', import.meta.url)

/**
 * Answer with one shipped picture.
 * @param res - the response to own.
 * @param name - the picture's name, without its extension.
 */
async function sendShot(res: ServerResponse, name: string): Promise<void> {
  const png = await readFile(new URL(`${name}.png`, ASSET_DIR))
  res.statusCode = 200
  res.setHeader('content-type', 'image/png')
  res.setHeader('content-length', String(png.byteLength))
  res.setHeader('cache-control', 'no-cache')
  res.end(png)
}

/** Whether a patched fraction is a real number inside its bounds. */
function sampled(value: unknown, low: number, high: number): boolean {
  return bounded(value, low, high)
}

/** One route handler: it owns the response. */
type RouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => void | Promise<void>

/** Everything the route table reads and writes. */
export interface RouteStores {
  readonly store: Store
  readonly transcripts: TranscriptStore
  readonly settings: SettingsStore
  readonly credentials: CredentialHandler
  readonly recognize: Recognizer
  readonly preview: Previewer
}

/**
 * Read one timestamp query parameter.
 * @param url - the request URL.
 * @param name - parameter name.
 * @returns the instant as given, or undefined when the parameter is absent.
 * @throws {HttpError} 400 when the parameter is present but not a parseable instant.
 */
function instantParameter(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)
  if (value === null) return undefined
  if (Number.isNaN(Date.parse(value))) throw new HttpError(400, 'invalid-range', `\`${name}\` must be an instant`)
  return value
}

/**
 * Read one ledger row from a request body.
 * @param body - the parsed request body.
 * @returns the row to append; the instant is stamped here when the caller left it out.
 * @throws {HttpError} 400 when the body is not a row.
 */
function usageRecordOf(body: unknown): UsageRecord {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'invalid-record', 'the body must be an object')
  const fields = body as Record<string, unknown>
  const pillId = fields['pillId']
  if (typeof pillId !== 'string' || pillId.length === 0) throw new HttpError(400, 'invalid-record', '`pillId` must be a non-empty string')
  const at = fields['at']
  if (at !== undefined && (typeof at !== 'string' || Number.isNaN(Date.parse(at)))) {
    throw new HttpError(400, 'invalid-record', '`at` must be an instant')
  }
  const text = (value: unknown): string => (typeof value === 'string' ? value : '')
  return {
    at: at === undefined ? new Date().toISOString() : new Date(at).toISOString(),
    pillId,
    workspace: text(fields['workspace']),
    session: text(fields['session']),
  }
}

/**
 * Build the handler for the plugin's prefix route.
 * @param stores - the files, the credential holder and the recognition run.
 * @returns the handler the host half registers.
 */
export function createRouteHandler(stores: RouteStores): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { store, transcripts, settings, credentials, recognize, preview } = stores

  /** Read the `session` query parameter, which the per-session verbs address. */
  const sessionParameter = (url: URL): string => {
    const session = url.searchParams.get('session')
    if (session === null || session.length === 0) {
      throw new HttpError(400, 'invalid-request', '`session` must name a session')
    }
    return session
  }

  const routes: Record<string, RouteHandler> = {
    'GET /pills': async (_req, res) => {
      const read = await store.readPills()
      if (read.backup !== undefined) res.setHeader(DEGRADED_HEADER, read.backup)
      sendJson(res, 200, read.tree)
    },

    'PUT /pills': async (req, res) => {
      const body = await readJsonBody(req, MAX_BODY_BYTES)
      const problem = pillTreeProblem(body)
      if (problem !== null) throw new HttpError(400, 'invalid-tree', problem)
      await store.writePills(body as PillTree)
      sendJson(res, 200, { ok: true })
    },

    // The settings page's reset: the file goes away and the seed that
    // replaced it answers, so the page needs no second read.
    'DELETE /pills': async (_req, res) => {
      const read = await store.resetPills()
      sendJson(res, 200, read.tree)
    },

    'GET /usage': async (_req, res, url) => {
      const from = instantParameter(url, 'from')
      const to = instantParameter(url, 'to')
      const rows = await store.readUsage({
        ...(from === undefined ? {} : { from }),
        ...(to === undefined ? {} : { to }),
      })
      sendJson(res, 200, rows)
    },

    'POST /usage': async (req, res) => {
      const record = usageRecordOf(await readJsonBody(req, MAX_BODY_BYTES))
      await store.appendUsage(record)
      sendJson(res, 201, { ok: true })
    },

    // The settings page's clear action, on the ledger's own path.
    'DELETE /usage': async (_req, res) => {
      await store.clearUsage()
      sendJson(res, 200, { ok: true })
    },

    // ── transcripts, settings and recognition ───────────────────────────────

    // The page records a prompt here right after the submission begins.
    // The masking happens on the way in, so the file never holds raw text.
    'POST /transcript': async (req, res) => {
      const body = await readJsonBody(req, MAX_BODY_BYTES)
      if (typeof body !== 'object' || body === null) throw new HttpError(400, 'invalid-entry', 'the body must be an object')
      const fields = body as Record<string, unknown>
      const sessionId = fields['sessionId']
      const text = fields['text']
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new HttpError(400, 'invalid-entry', '`sessionId` must be a non-empty string')
      }
      if (typeof text !== 'string') throw new HttpError(400, 'invalid-entry', '`text` must be a string')
      const at = fields['at']
      if (at !== undefined && (typeof at !== 'string' || Number.isNaN(Date.parse(at)))) {
        throw new HttpError(400, 'invalid-entry', '`at` must be an instant')
      }
      const entries = await transcripts.append({
        sessionId,
        text,
        workspace: typeof fields['workspace'] === 'string' ? fields['workspace'] : '',
        ...(at === undefined ? {} : { at }),
      }, maskLabels((await settings.read()).locale))
      sendJson(res, 201, { ok: true, count: entries.length })
    },

    // The AI tab lists what is stored, one row per session.
    'GET /transcripts': async (_req, res) => {
      const sessions = await transcripts.read()
      sendJson(res, 200, sessions.map(session => ({
        sessionId: session.sessionId,
        count: session.entries.length,
        last: session.entries.at(-1)?.at ?? '',
      })))
    },

    // The prompt texts behind one row, for the reader's own inspection.
    'GET /transcript': async (_req, res, url) => {
      sendJson(res, 200, await transcripts.readSession(sessionParameter(url)))
    },

    // Forget one session.
    'DELETE /transcript': async (_req, res, url) => {
      const removed = await transcripts.remove(sessionParameter(url))
      sendJson(res, 200, { ok: true, removed })
    },

    // The batch clear.
    'DELETE /transcripts': async (_req, res) => {
      await transcripts.clear()
      sendJson(res, 200, { ok: true })
    },

    // One place for the custom prompt and the DeepSeek route.
    'GET /settings': async (_req, res) => {
      sendJson(res, 200, await settings.read())
    },

    'PUT /settings': async (req, res) => {
      const body = await readJsonBody(req, MAX_BODY_BYTES)
      if (typeof body !== 'object' || body === null) throw new HttpError(400, 'invalid-settings', 'the body must be an object')
      const fields = body as Record<string, unknown>
      const patch = {
        ...(typeof fields['customPrompt'] === 'string' ? { customPrompt: fields['customPrompt'] } : {}),
        ...(typeof fields['provider'] === 'string' ? { provider: fields['provider'] } : {}),
        ...(typeof fields['model'] === 'string' ? { model: fields['model'] } : {}),
        ...(typeof fields['apiBase'] === 'string' ? { apiBase: fields['apiBase'] } : {}),
        // 通用 settings: only values this build can honour are ever stored; the
        // bounds are applied on the way in, so the file cannot hold a drawer
        // wider than the page or a delay no one would wait for.
        ...(THEME_CHOICES.includes(fields['theme'] as ThemeChoice) ? { theme: fields['theme'] as ThemeChoice } : {}),
        ...(LOCALES.includes(fields['locale'] as Locale) ? { locale: fields['locale'] as Locale } : {}),
        ...(bounded(fields['quickDelayMs'], QUICK_DELAY_MIN_MS, QUICK_DELAY_MAX_MS) ? { quickDelayMs: Math.round(fields['quickDelayMs'] as number) } : {}),
        ...(bounded(fields['drawerWidth'], DRAWER_WIDTH_MIN, DRAWER_WIDTH_MAX) ? { drawerWidth: Math.round(fields['drawerWidth'] as number) } : {}),
        // 主题与外观: the three colour families. The settings layer falls back for
        // a value it cannot paint, but a patch is merged *over* the stored value,
        // so a bad one would win and be written as-is; the shape is checked here.
        ...colorsPatch(fields['colors']),
        // Sampling: a fraction to two decimals, a whole number of tokens.
        ...(sampled(fields['temperature'], TEMPERATURE_MIN, TEMPERATURE_MAX) ? { temperature: Math.round((fields['temperature'] as number) * 100) / 100 } : {}),
        ...(sampled(fields['topP'], TOP_P_MIN, TOP_P_MAX) ? { topP: Math.round((fields['topP'] as number) * 100) / 100 } : {}),
        ...(bounded(fields['maxTokens'], MAX_TOKENS_MIN, MAX_TOKENS_MAX) ? { maxTokens: Math.round(fields['maxTokens'] as number) } : {}),
        // 推理程度四档之一；别的值不写，读回来自然是存着的那一档。
        ...(REASONING_EFFORTS.includes(fields['reasoningEffort'] as ReasoningEffort)
          ? { reasoningEffort: fields['reasoningEffort'] as ReasoningEffort }
          : {}),
      }
      sendJson(res, 200, await settings.write(patch))
    },

    // Presence and writability only — the value never crosses this
    // route, in either direction.
    'GET /credentials': async (_req, res) => {
      const facts = await credentials.facts()
      sendJson(res, 200, {
        configured: facts.configured,
        writable: facts.writable,
        // Whether the harness holds a key this plugin may copy: the page needs
        // it to decide on its 「用 DSH 的 key」 button, and it is a fact rather
        // than a value, so it may cross the route.
        syncable: facts.syncable,
        // 指纹也是事实：页面靠它说明「现在存的是哪把」（值本身永远不过这条路由）。
        ...(facts.hint === undefined ? {} : { hint: facts.hint }),
        ...(facts.source === undefined ? {} : { source: facts.source }),
      })
    },

    // Convenience: a reader who has already configured the harness should
    // not have to paste the same key again. The copy happens entirely on this
    // side — the page learns only that it worked.
    'POST /credentials/sync': async (_req, res) => {
      // 拷贝整个发生在宿主这一边：读宿主的凭据、写插件自己的文件，回答里只有事实。
      // `sync()` 自己带状态码（宿主没有 key → 409；写不进去 → 照旧抛成 5xx）。
      sendJson(res, 200, await credentials.sync())
    },

    // The other half of the same convenience: dropping a key without touching
    // the file by hand. Answering with the facts is what the page redraws on.
    'POST /credentials/clear': async (_req, res) => {
      sendJson(res, 200, await credentials.clear())
    },

    'PUT /credentials': async (req, res) => {
      const body = await readJsonBody(req, MAX_BODY_BYTES)
      const key = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['key'] : undefined
      if (typeof key !== 'string') throw new HttpError(400, 'invalid-credential', '`key` must be a string')
      try {
        await credentials.store(key)
      } catch (error) {
        // A read-only layer shadows the write; the reader must hear that the
        // key they typed is not the key that would be used.
        throw new HttpError(409, 'readonly-credential', error instanceof Error ? error.message : String(error))
      }
      const facts = await credentials.facts()
      sendJson(res, 200, {
        configured: facts.configured,
        writable: facts.writable,
        syncable: facts.syncable,
        ...(facts.hint === undefined ? {} : { hint: facts.hint }),
        ...(facts.source === undefined ? {} : { source: facts.source }),
      })
    },

    // The one button's route. It answers suggestions; nothing is stored
    // until the reader confirms one in the panel.
    'POST /recognize': async (req, res) => {
      const body = recognizeBodyOf(await readJsonBody(req, MAX_BODY_BYTES))
      sendJson(res, 200, await recognize(body))
    },

    // Assemble without sending, so the panel can show what a send would
    // carry before anything leaves the machine.
    'POST /recognize/preview': async (req, res) => {
      const body = recognizeBodyOf(await readJsonBody(req, MAX_BODY_BYTES))
      sendJson(res, 200, await preview(body))
    },
  }

  return async (req, res) => {
    try {
      const url = new URL(String(req.url), 'http://localhost')
      // The prefix's own path lands on `/`, which no route claims.
      const rest = url.pathname.slice(ROUTE_PREFIX.length) || '/'
      // The card's pictures are files rather than JSON, so they are answered
      // here: the table below is keyed by exact paths and has no room for one.
      const shot = rest.startsWith('/asset/') ? rest.slice('/asset/'.length) : ''
      if (CARD_SHOTS.includes(shot)) {
        if (req.method !== 'GET') {
          sendMethodNotAllowed(res, ['GET'])
          return
        }
        try {
          await sendShot(res, shot)
        } catch {
          throw new HttpError(404, 'no-shot', `no picture named ${shot}`)
        }
        return
      }
      const handler = routes[`${req.method ?? 'GET'} ${rest}`]
      if (handler !== undefined) {
        await handler(req, res, url)
        return
      }
      const allowed = Object.keys(routes)
        .filter(key => key.endsWith(` ${rest}`))
        .map(key => key.slice(0, key.indexOf(' ')))
      if (allowed.length > 0) {
        sendMethodNotAllowed(res, allowed)
        return
      }
      sendJson(res, 404, { code: 'not-found', message: `no route for ${req.method ?? 'GET'} ${url.pathname}` })
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { code: error.code, message: error.message })
        return
      }
      throw error
    }
  }
}
