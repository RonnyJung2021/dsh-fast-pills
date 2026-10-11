/**
 * The one model call this plugin makes.
 *
 * DeepSeek only, through its Messages endpoint, with the key resolved from the
 * harness credentials just before the request — the key is never read
 * from a file this plugin owns and never reaches the browser. The request body
 * it sends is already masked by the route, so nothing here has to know about
 * secrets; this file only turns a request into the endpoint's own shape and
 * turns the answer back into structured suggestions.
 *
 * The transport is the platform's own `fetch` rather than the engine's LLM
 * seam: the seam is a plugin the deployment may not carry, and one
 * `POST /v1/messages` does not need it.
 */

import {
  ANTHROPIC_VERSION, DEEPSEEK_BASE_URL, DEFAULT_MODEL, MAX_SCOPE_ENTRIES, MAX_SUGGESTIONS,
} from '../../shared/constants/index.ts'
import type { Locale, ReasoningEffort } from '../../shared/enums/index.ts'
import { translate } from '../../shared/locales/index.ts'
import type { PillSuggestion, RecognitionResult } from '../../shared/types/index.ts'

/** What one recognition run needs to know. */
export interface RecognizeInput {
  /** The system prompt, already masked and already joined. */
  readonly system: string
  /** The user message, already masked: the transcript and the existing capsules. */
  readonly user: string
  /** Model id to ask for. */
  readonly model: string
  /** How hard the model is asked to think before it answers. */
  readonly reasoningEffort: ReasoningEffort
  /** Messages endpoint; the settings name it, and a deployment may point it elsewhere. */
  readonly apiBase: string
  /** Sampling temperature: low keeps the answer close to what the records say. */
  readonly temperature: number
  /** Nucleus sampling. */
  readonly topP: number
  /** Longest answer the model may write, in tokens. */
  readonly maxTokens: number
  /** The language the reader reads the panel in; the failure notes are written in it too. */
  readonly locale: Locale
  /** The resolved API key. */
  readonly apiKey: string
  /** Test seam: the platform `fetch`. */
  readonly fetch?: typeof fetch
}

/** What one recognition run answered with, or the failure to report. */
export type RecognizeOutcome =
  | { readonly ok: true; readonly result: RecognitionResult }
  | { readonly ok: false; readonly code: string; readonly message: string }

/**
 * The bundled prompt: what the model is being asked to recognise.
 *
 * It is a message-table entry rather than a constant, because the model is being
 * asked about a reader's own words and is asked in that reader's own language:
 * `prompts.system` is written in both files, and the host picks the one the
 * settings name. Everything the reader supplies travels in the user message
 * below, in whichever language they wrote it.
 * @param locale - the language the reader reads the panel in.
 * @returns the system prompt for this run.
 */
export function systemPromptFor(locale: Locale): string {
  return translate(locale, 'prompts.system')
}

/**
 * Build the user message one run sends.
 *
 * The headings live here as constants because the preview lists the same
 * message block by block; one spelling keeps the two from drifting.
 * @param input - the two halves of the request body.
 * @param locale - the language the headings are written in.
 * @returns the message text.
 */
export function userMessageOf(input: {
  readonly transcript: string
  readonly pills: string
  /** The reader's own note, already trimmed; empty when they wrote none. */
  readonly custom?: string
}, locale: Locale): string {
  const custom = (input.custom ?? '').trim()
  return [
    // 读者写的那段**不进 system**：它在这里，字段本身就低一档，标题也写明它只是风格倾向，
    // 而且排在数据前面——自带提示词里那条边界再压一次，它就没有推翻规则的能力了。
    ...(custom.length === 0 ? [] : [translate(locale, 'prompts.headingCustom'), custom, '']),
    translate(locale, 'prompts.headingTranscript'),
    input.transcript.trim().length === 0 ? translate(locale, 'prompts.emptyTranscript') : input.transcript,
    '',
    translate(locale, 'prompts.headingCapsules'),
    input.pills.trim().length === 0 ? translate(locale, 'prompts.emptyCapsules') : input.pills,
  ].join('\n')
}

/** Pull the model's text out of a Messages answer. */
function textOf(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const content = (payload as Record<string, unknown>)['content']
  if (!Array.isArray(content)) return undefined
  const parts = content
    .filter((block): block is Record<string, unknown> => typeof block === 'object' && block !== null)
    .filter(block => block['type'] === 'text' && typeof block['text'] === 'string')
    .map(block => block['text'] as string)
  return parts.length === 0 ? undefined : parts.join('')
}

/**
 * Read the JSON object out of an answer that may carry prose or a fence.
 * @param text - the model's text.
 * @returns the parsed value, or `undefined` when there is no JSON object in it.
 */
export function jsonIn(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

/**
 * Read a suggested scope: a short list of directory paths, cleaned.
 *
 * The model is asked to copy paths out of the records, but a wrong one must not
 * spoil the suggestion — anything that is not a non-empty string is dropped, the
 * list is deduped and capped, and an empty answer means "everywhere".
 * @param value - the `scope` field as it came back.
 * @returns the directories to limit the capsule to.
 */
function scopeOf(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const path = entry.trim().slice(0, 240)
    if (path.length === 0) continue
    seen.add(path)
    if (seen.size >= MAX_SCOPE_ENTRIES) break
  }
  return [...seen]
}

/**
 * Turn one model answer into suggestions, dropping what is not shaped right.
 *
 * A suggestion the model got wrong must not take the rest of the answer down,
 * so every field falls back and an entry with no usable name is skipped.
 * @param payload - the parsed JSON object.
 * @returns the suggestions to show, capped at {@link MAX_SUGGESTIONS}.
 */
export function suggestionsOf(payload: unknown): PillSuggestion[] {
  if (typeof payload !== 'object' || payload === null) return []
  const list = (payload as Record<string, unknown>)['suggestions']
  if (!Array.isArray(list)) return []
  const suggestions: PillSuggestion[] = []
  for (const value of list) {
    if (typeof value !== 'object' || value === null) continue
    const record = value as Record<string, unknown>
    const name = typeof record['name'] === 'string' ? record['name'].trim() : ''
    if (name.length === 0) continue
    const group = typeof record['group'] === 'string' ? record['group'].trim() : ''
    suggestions.push({
      name: name.slice(0, 40),
      body: typeof record['body'] === 'string' ? record['body'] : '',
      quick: record['quick'] === true,
      group: group.length === 0 ? null : group.slice(0, 40),
      scope: scopeOf(record['scope']),
      note: typeof record['note'] === 'string' ? record['note'].slice(0, 200) : '',
    })
    if (suggestions.length >= MAX_SUGGESTIONS) break
  }
  return suggestions
}

/**
 * How many times the token budget may be doubled before giving up.
 *
 * `deepseek-flash` thinks before it answers, and the thinking is part of the
 * same budget; a long transcript can spend all of it reasoning and leave no
 * text at all. That is a budget the reader never chose, so the answer is tried
 * again with more room rather than handed back as a failure. Three doublings
 * take a 1024-token budget to 8192, which is what the settings cap at.
 */
const BUDGET_RETRIES = 3

/**
 * Ask DeepSeek for capsule suggestions, giving the answer room to think.
 * @param input - prompts, payloads, model and key.
 * @returns the suggestions, or a failure the route can answer with.
 */
export async function recognize(input: RecognizeInput): Promise<RecognizeOutcome> {
  let attempt = await request(input)
  let budget = input.maxTokens
  for (let retry = 0; retry < BUDGET_RETRIES; retry += 1) {
    if (attempt.ok || attempt.code !== 'budget-spent') return attempt
    budget *= 2
    attempt = await request({ ...input, maxTokens: budget })
  }
  return attempt
}

/**
 * Put one request on the wire and read the answer.
 * @param input - prompts, payloads, model, key and the token budget.
 * @returns the suggestions, or a failure the caller may retry.
 */
async function request(input: RecognizeInput): Promise<RecognizeOutcome> {
  const endpoint = `${input.apiBase.replace(/\/+$/u, '')}/v1/messages`
  const thinking = input.reasoningEffort !== 'none'
  const body = {
    model: input.model.length === 0 ? DEFAULT_MODEL : input.model,
    // 思考模式：Anthropic 格式用 `thinking` 开或关，强度用 `output_config.effort`（low/high/max）。
    // 兼容端点会忽略 `budget_tokens`；`effort` 只认这三个值，所以界面也只给这三个加一个「关」。
    thinking: { type: thinking ? 'enabled' : 'disabled' },
    ...(thinking ? { output_config: { effort: input.reasoningEffort } } : {}),
    max_tokens: input.maxTokens,
    // Sampling is named on every call rather than left to the endpoint's own
    // default: recognition reads a transcript, and a reader who set the
    // temperature asked for exactly that.
    //
    // 注意：**开着思考模式时 temperature 不生效**（端点接受但不使用），`top_p` 只在思考模式下
    // 生效且下限 0.95。界面在取样那两栏上方写了这条，这里照发不误——把参数删掉反而让设置
    // 文件的含义变得含糊（读者写下的值仍然是他要的值，只是这一刻端点不用它）。
    temperature: input.temperature,
    top_p: input.topP,
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
  }
  let response: Response
  try {
    response = await (input.fetch ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-api-key': input.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    return { ok: false, code: 'unreachable', message: `连不上 DeepSeek：${error instanceof Error ? error.message : String(error)}` }
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return {
      ok: false,
      code: 'deepseek-error',
      message: `DeepSeek 回了 HTTP ${String(response.status)}${detail.length === 0 ? '' : `：${detail.slice(0, 300)}`}`,
    }
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    return { ok: false, code: 'bad-answer', message: translate(input.locale, 'recognize.notJsonAnswer', { why: error instanceof Error ? error.message : String(error) }) }
  }
  const text = textOf(payload)
  if (text === undefined) {
    // Two answers look alike from here and are not: an answer whose budget went
    // on reasoning (the caller gives it more room and asks again), and one that
    // came back empty for some other reason (the caller is told what arrived).
    const said = (payload as Record<string, unknown>)['stop_reason']
    const blocks = (payload as Record<string, unknown>)['content']
    const kinds = Array.isArray(blocks)
      ? blocks.map(block => (typeof block === 'object' && block !== null
        ? String((block as Record<string, unknown>)['type'])
        : typeof block)).join('、')
      : translate(input.locale, 'recognize.answerNotAnArray')
    if (said === 'max_tokens') {
      return {
        ok: false,
        code: 'budget-spent',
        message: translate(input.locale, 'recognize.budgetSpentAnswer', { tokens: input.maxTokens }),
      }
    }
    return {
      ok: false,
      code: 'empty-answer',
      message: translate(input.locale, 'recognize.emptyAnswer', { reason: String(said), kinds }),
    }
  }
  const parsed = jsonIn(text)
  if (parsed === undefined) {
    return { ok: false, code: 'bad-answer', message: translate(input.locale, 'recognize.badJsonAnswer', { text: text.slice(0, 300) }) }
  }
  return {
    ok: true,
    result: {
      suggestions: suggestionsOf(parsed),
      model: body.model,
      masked: false,
    },
  }
}

export { DEEPSEEK_BASE_URL }
