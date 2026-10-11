/**
 * The two message tables, and the one way to read them.
 *
 * `zh.json` is the wording the plugin is written in and `en.json` is its
 * translation; nothing else in the package carries copy, and the host half
 * reads the same files for the prompts it sends. A key is namespaced by the
 * area it belongs to — `panel.tabLedger`, `recognize.previewLead` — so a call
 * site reads as what it asks for rather than as an index into a list.
 *
 * Chinese is the fallback table: a key the English file has not reached yet
 * answers in Chinese rather than as a missing-key marker. The tests hold the two
 * files to the same key set and the same `{placeholders}` in both.
 */

import type { Locale } from '../enums/index.ts'
import type { Text } from '../types/index.ts'
import type { MaskLabels } from '../utils/mask.ts'
import en from './en.json' with { type: 'json' }
import zh from './zh.json' with { type: 'json' }

/** One language's messages, keyed the same way in both files. */
export type Messages = Readonly<Record<string, string>>

/** Every table, by locale. */
export const TABLES: Readonly<Record<Locale, Messages>> = { zh, en }

/** Fill one template's `{placeholders}`; an unknown name is left standing. */
function fill(template: string, values?: Readonly<Record<string, string | number>>): string {
  if (values === undefined) return template
  return template.replace(/\{(\w+)\}/gu, (whole, name: string) =>
    (name in values ? String(values[name]) : whole))
}

/**
 * Read one key in one language.
 * @param locale - the language to answer in.
 * @param key - the entry to read.
 * @param values - what to fill its placeholders with.
 * @returns the sentence; the key itself when neither table has it.
 */
export function translate(
  locale: Locale,
  key: string,
  values?: Readonly<Record<string, string | number>>,
): string {
  const table = TABLES[locale]
  return fill(table[key] ?? TABLES.zh[key] ?? key, values)
}

/**
 * The asker one mount hands around.
 * @param locale - the language that mount speaks.
 * @returns a function that fills one entry.
 */
export function textFor(locale: Locale): Text {
  return (key, values) => translate(locale, key, values)
}

/**
 * The markers one language writes into a masked transcript.
 * @param locale - the language the reader is reading in.
 * @returns one marker per kind of secret.
 */
export function maskLabels(locale: Locale): MaskLabels {
  return {
    key: translate(locale, 'mask.key'),
    connection: translate(locale, 'mask.connection'),
    token: translate(locale, 'mask.token'),
    email: translate(locale, 'mask.email'),
    phone: translate(locale, 'mask.phone'),
    time: translate(locale, 'mask.time'),
    date: translate(locale, 'mask.date'),
    value: translate(locale, 'mask.value'),
  }
}
