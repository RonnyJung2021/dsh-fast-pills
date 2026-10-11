/**
 * The names this plugin is known by, in one place.
 *
 * The package name is also the loader row id, the data directory name and the
 * id the page registers the browser bundle under, so the three never drift.
 */

import type { ReasoningEffort } from '../enums/index.ts'

/** Package name; also the loader row id and the page's client-bundle id. */
export const PLUGIN_ID = 'dsh-fast-pills'

/** Absolute HTTP path prefix the host half registers. */
export const ROUTE_PREFIX = `/${PLUGIN_ID}`

/** Directory under the harness home that holds this plugin's two data files. */
export const DATA_DIR = `storages/${PLUGIN_ID}`

/** Capsule tree file: read as a whole, written as a whole. */
export const PILLS_FILE = 'pills.json'

/** Usage ledger: one JSON record per line, appended, never rewritten. */
export const USAGE_FILE = 'usage.jsonl'

/** The session transcript the AI tab reads and clears. */
export const TRANSCRIPT_FILE = 'transcripts.json'

/** Settings overrides: the custom prompt and the DeepSeek route. */
export const SETTINGS_FILE = 'settings.json'

/** This plugin's own DeepSeek key, mode 0600; never written into a config file. */
export const SECRET_FILE = 'secret.json'

/** Public Messages endpoint of the DeepSeek route. */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic'

/** Anthropic Messages protocol version the DeepSeek endpoint speaks. */
export const ANTHROPIC_VERSION = '2023-06-01'

/** Model the recognition asks for unless the settings name another. */
export const DEFAULT_MODEL = 'deepseek-flash'

/** Largest prompt count one session's transcript keeps. */
export const MAX_ENTRIES_PER_SESSION = 200

/**
 * Largest suggestion list one recognition run answers with.
 *
 * The prompt asks for three, because a reader confirming capsules wants the
 * best few rather than a list to work through; this is the bound the host half
 * enforces on whatever the model actually sends.
 */
export const MAX_SUGGESTIONS = 3

/** How many workspaces one suggested capsule may be limited to. */
export const MAX_SCOPE_ENTRIES = 6

/** Largest custom prompt the settings accept. */
export const MAX_CUSTOM_PROMPT_CHARS = 8 * 1024

/**
 * How the recognition samples, unless the settings say otherwise.
 *
 * Recognition is a reading job, not a writing one: it is asked to find wordings
 * that are already in the transcript, so the answer should be as close to
 * determined as the model can make it. A low temperature is what keeps it from
 * inventing a need nobody expressed, and 0.2 is low enough to repeat itself on
 * the same records without collapsing into a single phrasing.
 */
export const DEFAULT_TEMPERATURE = 0.2

/** Longest and shortest temperature the settings accept. */
export const TEMPERATURE_MIN = 0
export const TEMPERATURE_MAX = 1

/** Nucleus sampling, as the settings start it: no truncation. */
export const DEFAULT_TOP_P = 1

/** Smallest and largest `top_p` the settings accept. */
export const TOP_P_MIN = 0.05
export const TOP_P_MAX = 1

/**
 * How hard the model is asked to think, unless the settings say otherwise.
 *
 * `low` rather than `none`: picking repeated wordings out of a transcript is not
 * a puzzle, but a little thinking measurably improves which wordings it picks,
 * and the cheapest level is the one that pays for itself here.
 */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'low'

/**
 * Longest answer the model may write, in tokens.
 *
 * This is not the length of the JSON: `deepseek-flash` reasons in the same
 * budget, and one measured run against a real transcript spent 3827 tokens
 * thinking before it wrote 18 characters of answer. A budget that fits the
 * answer alone is therefore a budget that returns no answer at all.
 */
export const DEFAULT_MAX_TOKENS = 4096

/** Fewest and most tokens the settings accept. */
export const MAX_TOKENS_MIN = 256
export const MAX_TOKENS_MAX = 8192

/**
 * Prompts this plugin used to ship as the default.
 *
 * Empty since the prompt that used to sit here was its author's own wording
 * and is no longer shipped at all, so nothing has to be moved off it. The list
 * stays because it is what lets a later change to the default reach installs
 * that never touched the box: a stored prompt equal to one of these is the
 * default, not a customisation, and only exact matches are replaced.
 */
export const RETIRED_CUSTOM_PROMPTS: readonly string[] = []

/** Directory name a damaged `pills.json` is renamed to before the seed is written. */
export const PILLS_BACKUP_PREFIX = `${PILLS_FILE}.bak-`

/** Largest request body the write routes accept. */
export const MAX_BODY_BYTES = 256 * 1024

/**
 * Response header naming the file a damaged capsule tree was moved to.
 *
 * The route's body is the tree and nothing else, so the repair is reported
 * beside it; the settings page reads this header to show its one-line warning.
 */
export const DEGRADED_HEADER = 'x-dsh-fast-pills-degraded'

/** Dock slot the row is contributed to. */
export const DOCK_SLOT = 'conversation.input.dock'

/** Dock entry this plugin contributes to `conversation.input.dock`. */
export const DOCK_ENTRY_ID = 'fast-pills'

/** Dock entry order: after the goal strip, before the queue panel. */
export const DOCK_ENTRY_ORDER = 15

/**
 * How long a quick capsule waits before submitting the draft.
 *
 * About one second: this is the value the settings start from, and the
 * reader may move it (see `QUICK_DELAY_MIN_MS`).
 */
export const QUICK_SUBMIT_DELAY_MS = 1000

/** Shortest and longest wait the settings accept for a quick capsule, in milliseconds. */
export const QUICK_DELAY_MIN_MS = 200
export const QUICK_DELAY_MAX_MS = 5000

/** The drawer's width as a share of the page, unless the settings say otherwise. */
export const DRAWER_WIDTH_PERCENT = 85

/** Narrowest and widest drawer the settings accept, as a share of the page. */
export const DRAWER_WIDTH_MIN = 60
export const DRAWER_WIDTH_MAX = 100

/** Where the row and the capsules carry their marker attributes for the page and the checks. */
export const ROW_ATTRIBUTE = 'data-dsh-fast-pills'
export const PILL_ATTRIBUTE = 'data-dsh-fast-pill'
export const GROUP_ATTRIBUTE = 'data-dsh-fast-pill-group'

/** Markers for the round entry, the drawer it opens, and the panel both mounts share. */
export const CIRCLE_ATTRIBUTE = 'data-dsh-fast-pill-circle'
export const DRAWER_ATTRIBUTE = 'data-dsh-fast-pill-drawer'
export const PANEL_ATTRIBUTE = 'data-dsh-fast-pill-panel'

/** Marker on one row of the settings tree, carrying the entry's id. */
export const NODE_ATTRIBUTE = 'data-dsh-fast-pill-node'
