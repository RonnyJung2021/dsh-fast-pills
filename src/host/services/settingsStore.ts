/**
 * This plugin's settings file: the few overrides a reader may want without a
 * rebuild.
 *
 * The DeepSeek API key is deliberately not here — it lives in the harness
 * credentials, and this file only ever names the credential reference.
 * The custom prompt is user text, so it is not a secret by contract and is
 * stored as written.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEEPSEEK_BASE_URL, DEFAULT_MAX_TOKENS, DEFAULT_MODEL, DEFAULT_REASONING_EFFORT, DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P, DRAWER_WIDTH_MAX, DRAWER_WIDTH_MIN, DRAWER_WIDTH_PERCENT, MAX_CUSTOM_PROMPT_CHARS,
  MAX_TOKENS_MAX, MAX_TOKENS_MIN, QUICK_DELAY_MAX_MS, QUICK_DELAY_MIN_MS, QUICK_SUBMIT_DELAY_MS,
  RETIRED_CUSTOM_PROMPTS, SETTINGS_FILE, TEMPERATURE_MAX, TEMPERATURE_MIN, TOP_P_MAX, TOP_P_MIN,
} from '../../shared/constants/index.ts'
import {
  LOCALES, REASONING_EFFORTS, THEME_CHOICES, type Locale, type ReasoningEffort, type ThemeChoice,
} from '../../shared/enums/index.ts'
import { translate } from '../../shared/locales/index.ts'

/** The settings this plugin honours. */
export interface PluginSettings {
  /** Seconds-long system prompt appended to the bundled one. */
  readonly customPrompt: string
  /** Provider route name, for the panel's provenance line. */
  readonly provider: string
  /** DeepSeek model id. */
  readonly model: string
  /** Messages endpoint override; a deployment behind a gateway sets it here. */
  readonly apiBase: string
  /** Which paper the panel is drawn on, changed from the settings tab. */
  readonly theme: ThemeChoice
  /** Which language the panel speaks. */
  readonly locale: Locale
  /** How long a quick capsule waits before sending the draft, in milliseconds. */
  readonly quickDelayMs: number
  /** The drawer's width as a share of the page. */
  readonly drawerWidth: number
  /**
   * Whether the capsule row is drawn above the composer.
   *
   * The one switch the plugin card carries, and the only way to turn this
   * plugin's visible half off without disabling the bundle: with the row gone
   * the drawer has no entry, so the card is where it is turned back on.
   */
  readonly showRow: boolean
  /** The three colour families the panel paints with, as `#rrggbb` literals; empty means the shipped one. */
  readonly colors: Readonly<Record<'plain' | 'quick' | 'style' | 'scope', string>>
  /** Sampling temperature for the recognition call; low keeps the answer close to the records. */
  readonly temperature: number
  /** Nucleus sampling for the recognition call. */
  readonly topP: number
  /** Longest answer the model may write, in tokens. */
  readonly maxTokens: number
  /**
   * How hard the model is asked to think, as the endpoint names it.
   *
   * `none` turns thinking off; the other three turn it on and pick the effort.
   * Thinking is on by default at `low`: recognition reads a transcript rather
   * than solving a puzzle, so the cheapest level is the one that pays.
   */
  readonly reasoningEffort: ReasoningEffort
}

/** What one caller may change; everything else keeps its stored or default value. */
export type SettingsPatch = Partial<PluginSettings>

/** The values a file that says nothing falls back to. */
/**
 * The seeded preference text, in every language it ships in.
 *
 * A stored prompt equal to one of these is the seed, not a customisation: a
 * reader who never touched the box follows the language they read the panel in,
 * and only a prompt they wrote themselves is left alone.
 */
const SEEDED_PROMPTS: readonly string[] = LOCALES.map(locale => translate(locale, 'prompts.customDefault'))

export const DEFAULT_SETTINGS: PluginSettings = {
  // The custom prompt starts from a written preference rather than a blank
  // box; a reader who wants none can clear the field.
  customPrompt: translate('zh', 'prompts.customDefault'),
  provider: 'deepseek-official',
  model: DEFAULT_MODEL,
  apiBase: DEEPSEEK_BASE_URL,
  // A file that says nothing keeps following the page in the language this
  // plugin is written in, which is what a reader who never opened 通用 expects.
  theme: 'system',
  locale: 'zh',
  quickDelayMs: QUICK_SUBMIT_DELAY_MS,
  drawerWidth: DRAWER_WIDTH_PERCENT,
  showRow: true,
  colors: { plain: '', quick: '', style: '', scope: '' },
  temperature: DEFAULT_TEMPERATURE,
  topP: DEFAULT_TOP_P,
  maxTokens: DEFAULT_MAX_TOKENS,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
}

/** This plugin's settings file. */
export interface SettingsStore {
  /**
   * Read the settings, writing the defaults when the file is absent.
   * @returns the effective settings.
   */
  read(): Promise<PluginSettings>
  /**
   * Merge one patch into the stored settings.
   * @param patch - the fields to change.
   * @returns the settings after the write.
   */
  write(patch: SettingsPatch): Promise<PluginSettings>
}

/** Accept a string field only when it is a non-empty string inside its bound. */
function textField(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) return fallback
  return trimmed
}

/** Accept one of the three themes; a hand-edited file falls back to following the page. */
function themeField(value: unknown): ThemeChoice {
  return THEME_CHOICES.includes(value as ThemeChoice) ? value as ThemeChoice : DEFAULT_SETTINGS.theme
}

/** Accept one of the reasoning levels; anything else falls back to the default. */
function reasoningField(value: unknown): ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort)
    ? value as ReasoningEffort
    : DEFAULT_SETTINGS.reasoningEffort
}

/** Accept one of the two languages; anything else falls back to this plugin's own. */
function localeField(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? value as Locale : DEFAULT_SETTINGS.locale
}

/** The three families, as the settings file names them. */
const COLOR_IDS = ['plain', 'quick', 'style', 'scope'] as const

/**
 * Accept one colour literal; anything this build cannot paint falls back to none.
 *
 * The rule lives here as well as in the page because the settings file is also
 * written by hand: a host half that stored whatever it was handed would put an
 * unpaintable value in the file and the panel would have to invent a fallback
 * for it anyway.
 */
export function colorLiteral(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) return ''
  return /^#[0-9a-f]{6}$/u.test(trimmed) ? trimmed : fallback
}

/** Read the three colour families out of a settings object. */
function colorsField(value: unknown): Readonly<Record<typeof COLOR_IDS[number], string>> {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  return {
    plain: colorLiteral(record['plain'], DEFAULT_SETTINGS.colors.plain),
    quick: colorLiteral(record['quick'], DEFAULT_SETTINGS.colors.quick),
    style: colorLiteral(record['style'], DEFAULT_SETTINGS.colors.style),
    scope: colorLiteral(record['scope'], DEFAULT_SETTINGS.colors.scope),
  }
}

/** Accept a whole number inside its bounds; anything else falls back to the default. */
function boundedField(value: unknown, fallback: number, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  return rounded < low || rounded > high ? fallback : rounded
}

/** Accept a fraction inside its bounds, to two decimals; anything else falls back. */
function sampledField(value: unknown, fallback: number, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value * 100) / 100
  return rounded < low || rounded > high ? fallback : rounded
}

/** Accept a boolean; anything else falls back to the default. */
function booleanField(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Read one settings value against its field rules.
 * @param value - parsed JSON, or anything else.
 * @returns the settings, with unreadable fields falling back to their default.
 */
export function settingsOf(value: unknown): PluginSettings {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const locale = localeField(record['locale'])
  const custom = typeof record['customPrompt'] === 'string' ? record['customPrompt'] : undefined
  // 存着的正是某一版自带的预置（没人改过）时，让它跟着新预置走；改过的原样留着。
  const seeded = custom !== undefined
    && (RETIRED_CUSTOM_PROMPTS.includes(custom) || SEEDED_PROMPTS.includes(custom))
  const stored = seeded ? translate(locale, 'prompts.customDefault') : custom
  return {
    customPrompt: stored !== undefined && stored.length <= MAX_CUSTOM_PROMPT_CHARS
      ? stored
      : DEFAULT_SETTINGS.customPrompt,
    provider: textField(record['provider'], DEFAULT_SETTINGS.provider, 64),
    model: textField(record['model'], DEFAULT_SETTINGS.model, 128),
    apiBase: textField(record['apiBase'], DEFAULT_SETTINGS.apiBase, 512),
    theme: themeField(record['theme']),
    locale,
    quickDelayMs: boundedField(record['quickDelayMs'], DEFAULT_SETTINGS.quickDelayMs, QUICK_DELAY_MIN_MS, QUICK_DELAY_MAX_MS),
    drawerWidth: boundedField(record['drawerWidth'], DEFAULT_SETTINGS.drawerWidth, DRAWER_WIDTH_MIN, DRAWER_WIDTH_MAX),
    showRow: booleanField(record['showRow'], DEFAULT_SETTINGS.showRow),
    colors: colorsField(record['colors']),
    temperature: sampledField(record['temperature'], DEFAULT_SETTINGS.temperature, TEMPERATURE_MIN, TEMPERATURE_MAX),
    topP: sampledField(record['topP'], DEFAULT_SETTINGS.topP, TOP_P_MIN, TOP_P_MAX),
    maxTokens: boundedField(record['maxTokens'], DEFAULT_SETTINGS.maxTokens, MAX_TOKENS_MIN, MAX_TOKENS_MAX),
    reasoningEffort: reasoningField(record['reasoningEffort']),
  }
}

/** The file text of one settings object: pretty-printed, newline-terminated. */
function render(settings: PluginSettings): string {
  return `${JSON.stringify(settings, undefined, 2)}\n`
}

/**
 * Build this plugin's settings layer over one directory.
 * @param dir - the plugin's data directory.
 * @returns the settings store.
 */
export function createSettingsStore(dir: string): SettingsStore {
  const path = join(dir, SETTINGS_FILE)
  let queue: Promise<unknown> = Promise.resolve()

  /** Run one operation after the previous one settled, whatever its outcome. */
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation)
    queue = next.catch(() => undefined)
    return next
  }

  /** Put one settings object on disk through a sibling temporary file. */
  async function writeAtomic(next: PluginSettings): Promise<void> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${String(process.pid)}.tmp`
    await writeFile(temporary, render(next), { mode: 0o600 })
    await rename(temporary, path)
  }

  /**
   * Read the file as it stands.
   *
   * An absent, unreadable or unparseable file is simply "no overrides": the
   * defaults are what the plugin would do anyway, and a hand-edited settings
   * file must never be able to answer a request with a 500.
   * @returns the settings the file describes.
   */
  async function current(): Promise<PluginSettings> {
    try {
      return settingsOf(JSON.parse(await readFile(path, 'utf8')))
    } catch {
      return DEFAULT_SETTINGS
    }
  }

  return {
    read: () => serialize(async () => {
      const settings = await current()
      // The seed is written once, so a reader can see what is overridable
      // without reading the source; an unparseable file is left alone.
      try {
        await readFile(path, 'utf8')
      } catch {
        await writeAtomic(settings)
      }
      return settings
    }),

    write: patch => serialize(async () => {
      const next: PluginSettings = { ...await current(), ...patch }
      await writeAtomic(next)
      return next
    }),
  }
}
