/**
 * The host entry: the surface the engine's Loader imports.
 *
 * The two halves of the package are what the Loader and the page each load, so
 * their entries stay where the manifest says they are — `src/index.ts` here and
 * `src/client/index.ts` for the browser. This file only picks what a loader row
 * may see; the implementation sits in `host/`.
 *
 * The stores, the masking rules and the recognition run are exported beside the
 * plugin because the acceptance tests drive them directly: `POST /recognize`
 * cannot be exercised over HTTP without a real DeepSeek key, so its body is
 * called with an injected `fetch` instead.
 */

export { PLUGIN_ID } from './shared/constants/index.ts'
export { apply, inject, name } from './host/index.ts'
export { SEED_TREE } from './shared/constants/seedCapsules.ts'
export { mask, maskText, maskDeep } from './shared/utils/mask.ts'
export { createCredentialHandler } from './host/services/credentialStore.ts'
export { previewRecognize } from './host/llm/recognition.ts'
export { runRecognize, pillsTextOf, transcriptTextOf, recognizeBodyOf } from './host/llm/recognition.ts'
export { createSettingsStore, DEFAULT_SETTINGS, settingsOf } from './host/services/settingsStore.ts'
export { createTranscriptStore, transcriptOf } from './host/services/transcriptStore.ts'
export { systemPromptFor, jsonIn, suggestionsOf } from './host/llm/deepseekClient.ts'
export type { Pill, PillGroup, PillNode, PillSuggestion, PillTree, RecognitionResult, SessionTranscript, TranscriptEntry, UsageRecord } from './shared/types/index.ts'
