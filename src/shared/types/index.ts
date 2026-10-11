/**
 * The shapes this plugin speaks: the capsule tree, the usage ledger and the
 * transcript. Every one of them is the file format, so they live here rather
 * than next to either reader.
 *
 * These shapes are the file format. Both halves speak them — the host half
 * reads and writes the files, the browser half will draw the tree — so the
 * names live here rather than next to either reader.
 */

import type { ReasoningEffort } from '../enums/index.ts'

/** Ask for one message by key, filling its `{placeholders}`. */
export type Text = (key: string, values?: Readonly<Record<string, string | number>>) => string

/**
 * One capsule.
 *
 * `skill` carries both halves of 「是否带 Skill」: a skill name means the press
 * writes `/name body `, and `null` means it writes the body alone.
 */
export interface Pill {
  readonly kind: 'pill'
  /** Stable identity; the usage ledger refers to capsules by this. */
  readonly id: string
  /** Display name on the capsule. */
  readonly name: string
  /** Words after the skill token, or the whole insertion for a plain capsule; may be empty. */
  readonly body: string
  /** Skill to lead with as `/name`; `null` for a capsule that writes plain words. */
  readonly skill: string | null
  /** Submit the whole draft about a second after inserting, instead of only inserting. */
  readonly quick: boolean
  /** Workspace directory names this capsule is limited to; empty means everywhere. */
  readonly scope: readonly string[]
}

/**
 * One group capsule: a fold that holds capsules.
 *
 * Groups never nest — a group's children are all {@link Pill} — so the tree is
 * two levels deep at most.
 */
export interface PillGroup {
  readonly kind: 'group'
  /** Stable identity for reordering and for the editor's keys. */
  readonly id: string
  /** Display name; also the group capsule's own text. */
  readonly name: string
  /**
   * Directories this fold is shown in, or empty for everywhere.
   *
   * A group's scope is not pushed down into its capsules: a child keeps the
   * scope it was given, and what the row shows is the union of the two. A fold
   * is therefore only ever a wider way to reach its capsules, never a narrower
   * one — the capsules stay the same capsules if the fold is deleted.
   */
  readonly scope: readonly string[]
  /** The capsules in this fold, in display order. */
  readonly children: readonly Pill[]
}

/** One entry of the capsule tree's first level. */
export type PillNode = Pill | PillGroup

/** The capsule tree: first-level entries in display order. */
export type PillTree = readonly PillNode[]

/**
 * One prompt the user sent, as the transcript keeps it.
 *
 * Only the user's own words are recorded; assistant turns never reach this
 * file. `text` has been through the heuristic mask once already, so what sits
 * on disk is never the raw prompt.
 */
export interface TranscriptEntry {
  /** Instant the submission began, ISO 8601. */
  readonly at: string
  /** The prompt text, with every masked span replaced by its placeholder. */
  readonly text: string
  /** The directory the session sat in, or an empty string when unknown. */
  readonly workspace: string
}

/** One session's prompts, in submission order. */
export interface SessionTranscript {
  readonly sessionId: string
  readonly entries: readonly TranscriptEntry[]
}

/** The whole transcript file: sessions in the order they were first written. */
export type Transcript = readonly SessionTranscript[]

/**
 * One capsule the model proposes.
 *
 * `group` is the name the model suggested, which may name no existing group;
 * the browser half decides where it lands when it merges the suggestion in.
 */
export interface PillSuggestion {
  readonly name: string
  readonly body: string
  /** Whether the model thinks this should send itself about a second after inserting. */
  readonly quick: boolean
  /** Suggested group name, or `null` for a top-level capsule. */
  readonly group: string | null
  /** Workspace directories the model thinks this belongs to; empty means everywhere. */
  readonly scope: readonly string[]
  /** One line of reasoning the model offered, shown under the suggestion. */
  readonly note: string
}

/** Which piece of an assembled request one block of the preview is. */
export type RecognitionPreviewPart = 'bundled' | 'custom' | 'transcript' | 'pills'

/**
 * One block of an assembled request, kept apart from its neighbours so the
 * panel can rule it off and name it instead of showing one long run of text.
 */
export interface RecognitionPreviewBlock {
  /** Which piece this is, so the panel can name it in the reader's language. */
  readonly part: RecognitionPreviewPart
  /** The heading this block carries inside the message, or an empty string. */
  readonly heading: string
  /** The block's text, after the outbound masking pass. */
  readonly text: string
}

/**
 * What one recognition request would carry, assembled and masked but not sent.
 * The panel shows this before it sends anything.
 */
export interface RecognitionPreview {
  /** The system prompt as it would be sent: the bundled one, then the reader's own. */
  readonly system: string
  /** The user message as it would be sent: the session's records, then the capsules. */
  readonly user: string
  /**
   * The same two, split into the blocks they were joined from, in order.
   *
   * The strings above are what goes on the wire; these are the same text with
   * its seams still visible, which is what the reader is actually checking.
   */
  readonly blocks: readonly RecognitionPreviewBlock[]
  /** Model the request would name. */
  readonly model: string
  /** Reasoning level the request would ask for. */
  readonly reasoningEffort: ReasoningEffort
  /** Endpoint the request would go to. */
  readonly apiBase: string
  /** Sampling temperature the request would be sent with. */
  readonly temperature: number
  /** Nucleus sampling the request would be sent with. */
  readonly topP: number
  /** Longest answer the request would ask for, in tokens. */
  readonly maxTokens: number
  /** Whether the outbound pass replaced at least one span. */
  readonly masked: boolean
}

/** What one recognition run answers with. */
export interface RecognitionResult {
  readonly suggestions: readonly PillSuggestion[]
  /** Model the answer came from, for the panel's one-line provenance. */
  readonly model: string
  /** True when the outbound pass replaced at least one span. */
  readonly masked: boolean
}

/**
 * One usage row: one press of a capsule that inserted text.
 *
 * `at` is an ISO 8601 instant; which local day it belongs to is decided when
 * the ledger is read, never when it is written.
 */
export interface UsageRecord {
  /** Instant of the press, ISO 8601. */
  readonly at: string
  /** The capsule that was pressed. */
  readonly pillId: string
  /** The workspace directory the session sat in, or an empty string when unknown. */
  readonly workspace: string
  /** The session the press happened in, or an empty string when unknown. */
  readonly session: string
}
