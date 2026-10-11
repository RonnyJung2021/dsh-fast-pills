/**
 * Host half: the storage routes, the credential holder and the one model call.
 *
 * The interface lives in the browser half; what the host owns is the files —
 * the capsule tree, the usage ledger, the session transcript and this plugin's
 * own DeepSeek key — plus the prefix route the page reaches them through. The
 * key never leaves this process, and it is this checkout's own, so the
 * half that talks to DeepSeek depends on no other part of the harness.
 * Activation registers that route and does no I/O: the first read creates the
 * data directory and writes the seed.
 */

import { PLUGIN_ID, ROUTE_PREFIX } from '../shared/constants/index.ts'
import type { HostContext } from './types/index.ts'
import { createCredentialHandler } from './services/credentialStore.ts'
import { dataDirectory, resolveDshHome } from './utils/homeDirectory.ts'
import { previewRecognize, runRecognize } from './llm/recognition.ts'
import { createRouteHandler } from './routes/index.ts'
import { createSettingsStore } from './services/settingsStore.ts'
import { createStore } from './services/pillStore.ts'
import { seedTreeFor } from '../shared/constants/seedCapsules.ts'
import type { PillTree } from '../shared/types/index.ts'
import { createTranscriptStore } from './services/transcriptStore.ts'

/** Stable loader row id; matches the package name. */
export const name = PLUGIN_ID

/** The route carrier is the one engine service this plugin reads. */
export const inject: string[] = ['webServer']

/**
 * Register the plugin's prefix route.
 * @param ctx - the engine context handed to this plugin.
 */
export function apply(ctx: HostContext): void {
  const dir = dataDirectory()
  const settings = createSettingsStore(dir)
  // 种子按读者当下的语言给：设置先建，树与记录都从它读语言。
  const seedTree = async (): Promise<PillTree> => seedTreeFor((await settings.read()).locale)
  const store = createStore(dir, seedTree)
  const transcripts = createTranscriptStore(dir)
  const credentials = createCredentialHandler(dir, resolveDshHome())
  // One context for both verbs, so a preview and the send it precedes are
  // assembled from the same stores the same way.
  const recognizeContext = {
    transcripts,
    settings,
    credentials,
    tree: async () => (await store.readPills()).tree,
  }
  const handler = createRouteHandler({
    store,
    transcripts,
    settings,
    credentials,
    recognize: request => runRecognize(recognizeContext, request),
    preview: request => previewRecognize(recognizeContext, request),
  })
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler }),
    `${PLUGIN_ID}: ${ROUTE_PREFIX}`,
  )
}
