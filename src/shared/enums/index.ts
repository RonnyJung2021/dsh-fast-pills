/**
 * The choices both halves name.
 *
 * They are `as const` arrays rather than TypeScript `enum`s: the value is what
 * the settings file stores and what a control offers, so the list and the type
 * have to be the same object, and a reader of the file can see every choice.
 */

/** Which paper the panel is drawn on. */
export const THEME_CHOICES = ['light', 'dark', 'system'] as const

/**
 * The paper the panel is drawn on.
 *
 * `system` follows whatever the page itself is set to; the other two are the
 * reader's own choice, and the choice is a setting rather than a page state —
 * it lives beside the prompt in this plugin's settings file.
 */
export type ThemeChoice = typeof THEME_CHOICES[number]

/**
 * How hard the model is asked to think before it answers.
 *
 * The names are the endpoint's own: the Anthropic-format field is
 * `output_config.effort`, and `none` is the value that turns thinking off
 * (`thinking: { type: 'disabled' }`). `minimal`, `medium`, `xhigh` and `ultra`
 * are aliases the endpoint folds into these four, so only the folded names are
 * offered — a reader should not have to learn the aliases to pick a level.
 */
export const REASONING_EFFORTS = ['none', 'low', 'high', 'max'] as const

/** One reasoning level, as the endpoint names it. */
export type ReasoningEffort = typeof REASONING_EFFORTS[number]

/**
 * Which language the panel speaks.
 *
 * `zh` is the wording the plugin is written in and the table that never falls
 * back; `en` is the translation, and a key it has not reached yet answers in
 * Chinese rather than as a missing-key marker.
 */
export const LOCALES = ['zh', 'en'] as const

/** Every language a reader may pick, in the order the control offers them. */
export type Locale = typeof LOCALES[number]

/** Which half of the panel's three tabs is showing. */
export const PANEL_TABS = ['ledger', 'trend', 'settings'] as const

/** The panel's three tabs. */
export type PanelTab = typeof PANEL_TABS[number]

/** The settings page's own rail. */
export const SETTINGS_SECTIONS = ['capsules', 'appearance', 'general', 'ai'] as const

/** One section of the settings page. */
export type SettingsSection = typeof SETTINGS_SECTIONS[number]

/** The four colours a reader may move, as the settings file names them. */
export const COLOR_IDS = ['plain', 'quick', 'style', 'scope'] as const

/** One colour family. */
export type ColorId = typeof COLOR_IDS[number]
