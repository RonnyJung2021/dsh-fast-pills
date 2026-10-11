/**
 * How the panel looks, speaks and behaves — and how a reader changes it.
 *
 * Every one of these is a setting, not page state: they are read once from this
 * plugin's settings file and written back through the same route, so the drawer
 * and the plugin card always agree and a reload keeps what the reader picked.
 *
 * The store is module-level because both mounts live in one page: one read, one
 * value, one set of listeners, however many panels are open. `theme` is the odd
 * one out in that what it resolves to also depends on the product's own
 * light/dark preference, which is why the module listens for that too.
 */

import { createContext, useCallback, useEffect, useSyncExternalStore } from 'react'
import { DRAWER_WIDTH_PERCENT, QUICK_SUBMIT_DELAY_MS } from '../../shared/constants/index.ts'
import { LOCALES, THEME_CHOICES, type Locale, type ThemeChoice } from '../../shared/enums/index.ts'
import { familyTokens, isAccent, type ColorFamilyId } from '../utils/accent.ts'
import type { PillStore } from './pillStore.ts'

/** The paper actually drawn, once `system` has been resolved. */
export type ResolvedTheme = 'light' | 'dark'

/**
 * The panel's settings, as the components read them.
 *
 * Every field is named the way the settings file names it, so a patch a control
 * hands to {@link Prefs.set} is both what the state is updated with and what is
 * written back — one name, one meaning, no mapping in between.
 */
export interface Prefs {
  readonly theme: ThemeChoice
  readonly resolved: ResolvedTheme
  readonly locale: Locale
  readonly quickDelayMs: number
  readonly drawerWidth: number
  /** Whether the row above the composer is drawn at all (the plugin card's one switch). */
  readonly showRow: boolean
  /** The colour family the panel paints each of its three accents with; empty means the shipped one. */
  readonly colors: Readonly<Record<ColorFamilyId, string>>
}

/** What a caller may change; anything left out keeps its stored value. */
export type PrefsPatch = Partial<{
  readonly theme: ThemeChoice
  readonly locale: Locale
  readonly quickDelayMs: number
  readonly drawerWidth: number
  readonly showRow: boolean
  readonly colors: Readonly<Record<ColorFamilyId, string>>
}>

/** The three theme labels, in the order the control offers them. */
export const THEME_LABELS: Readonly<Record<ThemeChoice, string>> = {
  light: 'common.light',
  dark: 'common.dark',
  system: 'common.followApp',
}

/** The two language labels, in the order the control offers them. */
export const LOCALE_LABELS: Readonly<Record<Locale, string>> = { zh: '中文', en: 'English' }

/**
 * The resolved paper, for the few nodes that leave the panel's own subtree.
 *
 * A confirmation is portalled to the body so no ancestor can clip it, which
 * also means it inherits no custom property from the panel; React context
 * crosses a portal where CSS inheritance does not, so the dialog reads the
 * paper from here and carries it back onto its own root.
 */
export const ThemeContext = createContext<ResolvedTheme>('light')

/** The product's own light/dark preference, when the page has one. */
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined

let value: Prefs = {
  theme: 'system',
  resolved: 'light',
  locale: 'zh',
  quickDelayMs: QUICK_SUBMIT_DELAY_MS,
  drawerWidth: DRAWER_WIDTH_PERCENT,
  showRow: true,
  colors: { plain: '', quick: '', style: '', scope: '' },
}
let snapshot: Prefs = value
let reading = false
const listeners = new Set<() => void>()

/** Recompute what the stored settings resolve to; identity only changes when it must. */
function refresh(): void {
  const resolved: ResolvedTheme = value.theme === 'system'
    ? (media?.matches === true ? 'dark' : 'light')
    : value.theme
  // Every field has to be compared, not just the paper: a snapshot that keeps
  // its identity when the language changes never reaches a subscriber, and the
  // panel would go on speaking the old one.
  const same = snapshot.theme === value.theme
    && snapshot.resolved === resolved
    && snapshot.locale === value.locale
    && snapshot.quickDelayMs === value.quickDelayMs
    && snapshot.drawerWidth === value.drawerWidth
    && snapshot.showRow === value.showRow
    && snapshot.colors === value.colors
  if (same) return
  snapshot = { ...value, resolved }
}

/** Tell every mounted panel that the settings changed. */
function emit(): void {
  refresh()
  for (const listener of [...listeners]) listener()
}

/** Read one settings answer, ignoring anything this build cannot draw. */
function accept(settings: {
  readonly theme: ThemeChoice
  readonly locale: Locale
  readonly quickDelayMs: number
  readonly drawerWidth: number
  readonly showRow?: boolean
  readonly colors?: Partial<Record<ColorFamilyId, string>>
}): boolean {
  let changed = false
  if (THEME_CHOICES.includes(settings.theme) && settings.theme !== value.theme) {
    value = { ...value, theme: settings.theme }
    changed = true
  }
  if (LOCALES.includes(settings.locale) && settings.locale !== value.locale) {
    value = { ...value, locale: settings.locale }
    changed = true
  }
  if (Number.isFinite(settings.quickDelayMs) && settings.quickDelayMs !== value.quickDelayMs) {
    value = { ...value, quickDelayMs: settings.quickDelayMs }
    changed = true
  }
  if (Number.isFinite(settings.drawerWidth) && settings.drawerWidth !== value.drawerWidth) {
    value = { ...value, drawerWidth: settings.drawerWidth }
    changed = true
  }
  // A missing field is a host half older than this build, which means the row
  // it never knew about is the row it drew: absent stays on.
  if (typeof settings.showRow === 'boolean' && settings.showRow !== value.showRow) {
    value = { ...value, showRow: settings.showRow }
    changed = true
  }
  // A colour this build cannot paint — a hand-edited file, or a host half that
  // never heard of the field — is no colour rather than a broken one.
  const colors = { ...value.colors }
  for (const id of ['plain', 'quick', 'style', 'scope'] as const) {
    const raw = settings.colors?.[id]
    const next = typeof raw === 'string' && (raw === '' || isAccent(raw)) ? raw.toLowerCase() : ''
    if (next === colors[id]) continue
    colors[id] = next
    changed = true
  }
  if (changed) value = { ...value, colors }
  return changed
}

/**
 * Read the stored settings once, on whichever mount asks first.
 *
 * Called from `apply` as well as from the hook, so the first paint already has
 * the reader's paper and language rather than flashing the defaults.
 * @param store - the page's one tree and settings source.
 */
export function watchPrefs(store: PillStore): void {
  if (reading) return
  reading = true
  media?.addEventListener('change', emit)
  void store.readSettings().then((settings) => {
    // A host half older than this build answers without some of these fields,
    // and a hand-edited file can say anything: only values this build can honour
    // are taken, so the panel falls back rather than resolving to nothing.
    if (settings === undefined) return
    if (accept(settings)) emit()
  }, () => undefined)
}

/**
 * The three colour families, as the custom properties a mount writes on its root.
 *
 * The paper is the stylesheet's business and the colours are the reader's: the
 * sheet keeps its shipped values, and each family that was chosen overrides the
 * few variables the panel spends it on. A family left empty writes nothing, and
 * the sheet then draws what it shipped with.
 * @param prefs - the panel's settings.
 * @returns the properties to write, possibly none at all.
 */
export function colorStyle(prefs: Pick<Prefs, 'colors' | 'resolved'>): Record<string, string> {
  const style: Record<string, string> = {}
  for (const id of ['plain', 'quick', 'style', 'scope'] as const) {
    const chosen = prefs.colors[id]
    if (chosen.length === 0) continue
    for (const [name, value] of familyTokens(id, chosen, prefs.resolved)) style[name] = value
  }
  return style
}

/**
 * The panel's settings, and the way to change them.
 * @param store - the page's one tree and settings source.
 * @returns the settings and the setter.
 */
export function usePrefs(store: PillStore): Prefs & { readonly set: (patch: PrefsPatch) => void } {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    () => snapshot,
  )
  useEffect(() => { watchPrefs(store) }, [store])
  const set = useCallback((patch: PrefsPatch) => {
    // Published before the write lands, the way a tree edit is: this is the
    // reader's own screen, and a lost settings file must not keep it wrong.
    value = { ...value, ...patch }
    emit()
    void store.writeSettings(patch)
  }, [store])
  return { ...state, set }
}
