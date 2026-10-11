/**
 * The three routes the recognition panel calls.
 *
 * They are split from the file routes because they answer a different
 * question: the transcript and settings routes are storage, while
 * `POST /recognize` is the one place this plugin takes a secret out of the
 * credential store and puts data on the wire. Everything that leaves for
 * DeepSeek passes {@link maskDeep} first, so the request body is masked as a
 * whole — transcript, pills and the custom prompt alike — no matter which
 * half produced it.
 */

import { HttpError } from '../utils/http.ts'
import { MAX_CUSTOM_PROMPT_CHARS } from '../../shared/constants/index.ts'
import { maskDeep } from '../../shared/utils/mask.ts'
import type {
  PillTree, RecognitionPreview, RecognitionPreviewBlock, RecognitionResult,
} from '../../shared/types/index.ts'
import type { TranscriptStore } from '../services/transcriptStore.ts'
import { maskLabels, translate } from '../../shared/locales/index.ts'
import type { SettingsStore } from '../services/settingsStore.ts'
import {
  recognize, systemPromptFor, userMessageOf,
} from './deepseekClient.ts'
import type { CredentialHandler } from '../services/credentialStore.ts'

/** One recognition request, as the page sends it. */
export interface RecognizeRequest {
  /** Session whose stored transcript is analysed. */
  readonly sessionId: string
  /** Capsule tree the page holds; the host falls back to the stored tree when absent. */
  readonly pills?: PillTree
  /** Custom system prompt; falls back to the stored setting. */
  readonly customPrompt?: string
  /** Model id; falls back to the stored setting. */
  readonly model?: string
  /** Messages endpoint; falls back to the stored setting. */
  readonly apiBase?: string
  /** Sampling overrides; each falls back to the stored setting. */
  readonly temperature?: number
  readonly topP?: number
  readonly maxTokens?: number
}

/** What one recognition call needs from the rest of the plugin. */
export interface RecognizeContext {
  readonly transcripts: TranscriptStore
  readonly settings: SettingsStore
  readonly credentials: CredentialHandler
  /** Reads the stored capsule tree when the request did not carry one. */
  readonly tree: () => Promise<PillTree>
  /** Test seam: the platform `fetch`. */
  readonly fetch?: typeof fetch
}

/** The run verb the route table calls. */
export type Recognizer = (request: RecognizeRequest) => Promise<RecognitionResult>

/** The preview verb the route table calls. */
export type Previewer = (request: RecognizeRequest) => Promise<RecognitionPreview>

/**
 * Render capsules the way the prompt describes them: one line each, grouped.
 * @param tree - the stored capsule tree.
 * @returns the text handed to the model as "现有胶囊".
 */
export function pillsTextOf(tree: PillTree): string {
  const lineOf = (name: string, body: string, skill: string | null): string => {
    const content = skill === null ? body : `/${skill} ${body}`.trimEnd()
    return `${name} => ${content}`
  }
  const lines: string[] = []
  for (const node of tree) {
    if (node.kind === 'pill') {
      lines.push(lineOf(node.name, node.body, node.skill))
      continue
    }
    lines.push(`【${node.name}】`)
    for (const child of node.children) lines.push(`  ${lineOf(child.name, child.body, child.skill)}`)
  }
  return lines.join('\n')
}

/**
 * Render one session's stored prompts, one line each.
 * @param entries - the session's masked entries.
 * @param sessionId - the session the lines belong to.
 * @returns the text handed to the model as "会话记录".
 */
export function transcriptTextOf(entries: readonly { at: string; workspace: string; text: string }[], sessionId: string): string {
  return entries
    .map(entry => `[${entry.at}] [${entry.workspace.length === 0 ? 'recognize.unknownDirectory' : entry.workspace}] [会话 ${sessionId}] ${entry.text}`)
    .join('\n')
}

/** Read one optional string field out of a request body. */
function stringField(body: Record<string, unknown>, name: string): string | undefined {
  const value = body[name]
  return typeof value === 'string' ? value : undefined
}

/**
 * Validate an endpoint override, so a mis-set value cannot aim the request at
 * a scheme the platform fetch would refuse.
 * @param value - the configured base.
 * @returns the endpoint base without its trailing slashes.
 * @throws {HttpError} 400 when it is not an absolute `http(s)` URL.
 */
function endpointOf(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new HttpError(400, 'invalid-endpoint', '`apiBase` must be an absolute URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'invalid-endpoint', '`apiBase` must use http or https')
  }
  return value.replace(/\/+$/u, '')
}

/**
 * Assemble the request this recognition would put on the wire: read the
 * transcript and the tree, join them with the bundled prompt and the reader's
 * own, and mask the whole thing.
 *
 * The preview route and the run route both come through here, so what the panel
 * shows before a send is the very text a send would carry — not a second
 * assembly that could drift from it.
 * @param context - the stores and the tree reader.
 * @param request - what the page asked for.
 * @returns the masked system prompt, user message and route.
 */
export async function assembleRecognize(context: RecognizeContext, request: RecognizeRequest): Promise<RecognitionPreview> {
  const settings = await context.settings.read()
  const customPrompt = (request.customPrompt ?? settings.customPrompt).slice(0, MAX_CUSTOM_PROMPT_CHARS)
  const model = request.model ?? settings.model
  const apiBase = endpointOf(request.apiBase ?? settings.apiBase)
  // The sampling the settings carry, overridable per request the way the model
  // and the endpoint are; the panel sends none, so this is the reader's setting.
  const temperature = request.temperature ?? settings.temperature
  const topP = request.topP ?? settings.topP
  const maxTokens = request.maxTokens ?? settings.maxTokens
  const entries = await context.transcripts.readSession(request.sessionId)
  const tree = request.pills ?? await context.tree()

  // One pass over everything the reader supplied, and only for this
  // request. The rules lean strict, and masking more never blocks the
  // send.
  //
  // What it does **not** pass over is the bundled prompt itself: that is a
  // constant of this plugin with nothing of the reader's in it, and running the
  // rules across it only damages it — the assignment net eats the JSON example
  // the model is asked to answer in, and the schema stops looking like a schema.
  const masked = maskDeep({
    transcript: transcriptTextOf(entries, request.sessionId),
    pills: pillsTextOf(tree),
    customPrompt: customPrompt.trim(),
  }, maskLabels(settings.locale))
  const payload = masked.value as { transcript: string; pills: string; customPrompt: string }
  // 读者写的那段**不进 system**——它降一档放进用户消息，标题写明它只是风格倾向。
  const system = systemPromptFor(settings.locale)
  const user = userMessageOf({
    transcript: payload.transcript,
    pills: payload.pills,
    custom: payload.customPrompt,
  }, settings.locale)
  const blocks: RecognitionPreviewBlock[] = [
    { part: 'bundled', heading: '', text: system },
    ...(payload.customPrompt.length === 0
      ? []
      : [{ part: 'custom' as const, heading: translate(settings.locale, 'prompts.headingCustom'), text: payload.customPrompt }]),
    { part: 'transcript', heading: translate(settings.locale, 'prompts.headingTranscript'), text: payload.transcript },
    { part: 'pills', heading: translate(settings.locale, 'prompts.headingCapsules'), text: payload.pills },
  ]
  return {
    system,
    user,
    blocks,
    model,
    reasoningEffort: settings.reasoningEffort,
    apiBase,
    temperature,
    topP,
    maxTokens,
    // The panel tells the reader that the outbound pass replaced spans.
    masked: masked.masked > 0,
  }
}

/**
 * Assemble one request without sending it.
 * @param context - the stores and the tree reader.
 * @param request - what the page asked for.
 * @returns what a send would carry.
 */
export function previewRecognize(context: RecognizeContext, request: RecognizeRequest): Promise<RecognitionPreview> {
  return assembleRecognize(context, request)
}

/**
 * Run one recognition: resolve the key, assemble the request, and hand the
 * model's answer back as suggestions.
 * @param context - the stores, the key holder and the fetch seam.
 * @param request - what the page asked for.
 * @returns the suggestions and their provenance.
 */
export async function runRecognize(context: RecognizeContext, request: RecognizeRequest): Promise<RecognitionResult> {
  const apiKey = await context.credentials.resolve()
  // No key, no request. The panel says the same thing, and this is the
  // half that can be certain.
  if (apiKey === undefined) {
    const locale = (await context.settings.read()).locale
    throw new HttpError(409, 'no-credential', translate(locale, 'recognize.hostNoCredential'))
  }
  const { system, user, model, reasoningEffort, apiBase, temperature, topP, maxTokens, masked } =
    await assembleRecognize(context, request)
  const locale = (await context.settings.read()).locale
  const outcome = await recognize({
    system,
    user,
    model,
    reasoningEffort,
    apiBase,
    temperature,
    topP,
    locale,
    maxTokens,
    apiKey,
    ...(context.fetch === undefined ? {} : { fetch: context.fetch }),
  })
  if (!outcome.ok) throw new HttpError(502, outcome.code, outcome.message)
  return { ...outcome.result, masked }
}

/**
 * Read one recognition request from a parsed body.
 * @param value - the parsed request body.
 * @returns the request the runner reads.
 * @throws {HttpError} 400 when the body carries no session to analyse.
 */
export function recognizeBodyOf(value: unknown): RecognizeRequest {
  if (typeof value !== 'object' || value === null) throw new HttpError(400, 'invalid-request', 'the body must be an object')
  const body = value as Record<string, unknown>
  const sessionId = stringField(body, 'sessionId')
  if (sessionId === undefined || sessionId.length === 0) {
    throw new HttpError(400, 'invalid-request', '`sessionId` must be a non-empty string')
  }
  const customPrompt = stringField(body, 'customPrompt')
  const model = stringField(body, 'model')
  const apiBase = stringField(body, 'apiBase')
  const pills = body['pills']
  return {
    sessionId,
    ...(Array.isArray(pills) ? { pills: pills as PillTree } : {}),
    ...(customPrompt === undefined ? {} : { customPrompt }),
    ...(model === undefined ? {} : { model }),
    ...(apiBase === undefined ? {} : { apiBase }),
  }
}
