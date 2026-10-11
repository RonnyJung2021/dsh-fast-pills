/**
 * Heuristic masking for anything that leaves the machine.
 *
 * Two calls run this: the host half masks a prompt before it is written to the
 * transcript file, and the browser half masks the whole request body before it
 * is sent. The rules lean strict on purpose: shapes that often carry a
 * secret are replaced whether or not they do, because a placeholder costs the
 * model some context while a leaked key cannot be taken back. Nothing here
 * throws or blocks — masking more never stops a send.
 *
 * This file is the browser half's copy of the same rules; the two are kept
 * byte-identical where it matters and a unit case compares them on a corpus.
 */

/** One replaced span, named by the rule that matched. */
export interface MaskToken {
  /** The kind of secret that was replaced. */
  readonly rule: MaskKind
  /** Start offset in the text as it arrived. */
  readonly start: number
  /** End offset in the text as it arrived. */
  readonly end: number
}

/** What one masking pass produced. */
export interface MaskOutcome {
  readonly text: string
  readonly tokens: readonly MaskToken[]
}

/**
 * What one masked span was judged to be.
 *
 * The rules name a kind rather than a marker, so the text a reader ends up
 * seeing comes from the message table in their own language and a stored
 * transcript keeps whatever it was masked with at the time.
 */
export type MaskKind = 'key' | 'connection' | 'token' | 'email' | 'phone' | 'time' | 'date' | 'value'

/** The marker one language writes for each kind. */
export type MaskLabels = Readonly<Record<MaskKind, string>>

/**
 * One rule: a global expression, the kind of secret it claims, and how
 * many leading characters of the match are the name rather than the secret.
 *
 * `keep: 0` means the whole match is the secret. A rule that keeps a name
 * declares its own name shape around the separator, so the replacement never
 * has to trust a capture group's offsets, which do not agree with the match
 * for text outside the ASCII range.
 */
interface Rule {
  readonly expression: RegExp
  readonly kind: MaskKind
  readonly keep?: number
}

/** Rules whose whole match is the secret. */
const WHOLE_RULES: readonly Rule[] = [
  { expression: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, kind: 'key' },
  { expression: /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|ftp):\/\/\S*@\S*/gi, kind: 'connection' },
  { expression: /\b(?:sk|pk|rk|ghp|gho|ghs|ghu|glpat|xox[abpsr])[-_ ]?[A-Za-z0-9_\-.]{4,}/g, kind: 'token' },
  { expression: /\bAKIA[0-9A-Z]{16}\b/g, kind: 'token' },
  { expression: /\bAIza[0-9A-Za-z_-]{35}\b/g, kind: 'token' },
  { expression: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, kind: 'token' },
  { expression: /\b0x[0-9a-fA-F]{40}\b|\b[0-9a-fA-F]{64}\b/g, kind: 'token' },
  { expression: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, kind: 'email' },
  { expression: /(?:\+?86[- ]?)?1[3-9]\d{9}\b/g, kind: 'phone' },
  // A whole ISO instant first: the bare-date rule below would otherwise eat
  // only its date and leave a dangling `T11:00:50.990Z` behind, which is what a
  // transcript line's own timestamp looks like.
  { expression: /\b(?:19|20)\d{2}[-/年]?(?:0[1-9]|1[0-2])[-/月]?(?:0[1-9]|[12]\d|3[01])日?T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g, kind: 'time' },
  { expression: /\b(?:19|20)\d{2}[-/年]?(?:0[1-9]|1[0-2])[-/月]?(?:0[1-9]|[12]\d|3[01])日?/g, kind: 'date' },
]

/**
 * Rules whose first characters are a name and whose remainder is the secret.
 *
 * The last rules are the deliberately broad net: a name joined to a
 * value by `:` or `=` reads as an assignment and its value goes. The name's own
 * shape bounds the net, and an ASCII name never contains a separator, so the
 * net cannot eat the name half of a `NAME: value` pair on its own.
 */
const KEEP_RULES: readonly Rule[] = [
  { expression: /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|APIKEY|API_KEY)[A-Z0-9_]*\s*[:=]\s*\S+/gi, kind: 'token', keep: -1 },
  { expression: /\b(?:[A-Za-z]{1,4}[ _-])?(?:password|passwd|secret|token)\s*[:：=]\s*\S+/gi, kind: 'token', keep: -1 },
  { expression: /(Bearer\s+)\S+/gi, kind: 'token', keep: 7 },
  { expression: /(?<![0-9])\b[A-Za-z_][A-Za-z0-9_]{5,}[:：]\s*(?![^\s]*@)[^\s:：]+|(?<![0-9])\b[A-Za-z_][A-Za-z0-9_]{5,}\s*=\s*[^\s=]+/g, kind: 'value', keep: -1 },
  // A name outside ASCII: a short word, an assignment separator, then an
  // alphanumeric run. It keeps the name and loses the value. It deliberately
  // stops at the separator, so a Chinese sentence with a colon and no value is
  // left alone — over-masking prose costs the model more than it protects.
  { expression: /(?<![0-9.])(?:[A-Za-z][A-Za-z0-9_.+-]*|[^\s:：=0-9.]{1,8})[:：=]\s*[A-Za-z0-9_.+-]{2,64}/gu, kind: 'value', keep: -1 },
]

/** Every rule, in the order a pass applies them. */
const RULES: readonly Rule[] = [...WHOLE_RULES, ...KEEP_RULES]

/** One rule applied to a text, whatever it matched. */
interface Span {
  readonly start: number
  readonly end: number
  readonly text: string
  readonly rule: MaskKind
  /** Rule order, broken so a named shape beats the broad assignment net. */
  readonly rank: number
}

/**
 * Apply one rule and report every span it matched.
 * @param rule - the rule to run.
 * @param text - the text as it arrived.
 * @param rank - the rule's position, so a named shape can outrank the broad net.
 * @returns the spans this rule claims.
 */
function spansOf(rule: Rule, text: string, rank: number, labels: MaskLabels): Span[] {
  const spans: Span[] = []
  rule.expression.lastIndex = 0
  let match = rule.expression.exec(text)
  while (match !== null) {
    const whole = match[0]
    // `keep: -1` is "everything before the separator is the name"; a fixed
    // count is for a rule whose name has no separator at all.
    const kept = rule.keep === undefined
      ? 0
      : rule.keep >= 0
        ? rule.keep
        : Math.max(whole.search(/[:：=]/u) + 1, 0)
    if (whole.length > kept) {
      spans.push({
        start: match.index + kept,
        end: match.index + whole.length,
        text: labels[rule.kind],
        rule: rule.kind,
        rank,
      })
    }
    if (whole.length === 0) rule.expression.lastIndex += 1
    match = rule.expression.exec(text)
  }
  return spans
}

/**
 * Keep the earliest spans only, so two rules cannot both rewrite one offset.
 *
 * At one offset the earlier rule wins, and the longer span breaks that tie: a
 * named shape such as a token assignment beats the broad net that also covers
 * it, and then a rule that swallowed a whole construct beats one that caught
 * only its head. Whichever survives, the offset is claimed once.
 * @param spans - spans from every rule, with the rule order on each.
 * @returns the surviving spans, left to right.
 */
function earliest(spans: readonly Span[]): Span[] {
  const kept: Span[] = []
  const sorted = [...spans].sort((left, right) => left.start - right.start
    || left.rank - right.rank
    || right.end - left.end)
  for (const span of sorted) {
    if (kept.some(other => span.start < other.end)) continue
    kept.push(span)
  }
  return kept
}

/**
 * Mask one text.
 *
 * The tokens are described against the text as it arrived, so a caller
 * reporting what it replaced does not have to reverse the rewrite.
 * @param text - the text to mask.
 * @param labels - the markers to write, in the reader's language.
 * @returns the masked text and one token per replaced span.
 */
export function maskText(text: string, labels: MaskLabels): MaskOutcome {
  if (text.length === 0) return { text, tokens: [] }
  const kept = earliest(RULES.flatMap((rule, rank) => spansOf(rule, text, rank, labels)))
  if (kept.length === 0) return { text, tokens: [] }
  let masked = ''
  let cursor = 0
  for (const span of kept) {
    masked += text.slice(cursor, span.start) + span.text
    cursor = span.end
  }
  masked += text.slice(cursor)
  return {
    text: masked,
    tokens: kept.map(span => ({ rule: span.rule, start: span.start, end: span.end })),
  }
}

/**
 * Mask one text and hand back only the result.
 * @param text - the text to mask.
 * @param labels - the markers to write, in the reader's language.
 * @returns the masked text.
 */
export function mask(text: string, labels: MaskLabels): string {
  return maskText(text, labels).text
}

/**
 * Mask every string anywhere inside a JSON value, the outbound pass.
 *
 * Both halves send a JSON body, so masking the *whole body* is the rule that
 * matters: a secret hiding in a capsule body or in a nested field is covered
 * exactly like one in the transcript.
 * @param value - any JSON value.
 * @param labels - the markers to write, in the reader's language.
 * @returns the same shape with every string masked, and how many spans were replaced.
 */
export function maskDeep(value: unknown, labels: MaskLabels): { readonly value: unknown; readonly masked: number } {
  let masked = 0
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const outcome = maskText(node, labels)
      masked += outcome.tokens.length
      return outcome.text
    }
    if (Array.isArray(node)) return node.map(walk)
    if (typeof node === 'object' && node !== null) {
      const out: Record<string, unknown> = {}
      for (const [key, entry] of Object.entries(node)) out[key] = walk(entry)
      return out
    }
    return node
  }
  return { value: walk(value), masked }
}
