/**
 * Browser half of the fast pills.
 *
 * The plugin contributes two entries. The composer's dock row is the plugin's
 * working half, and the bundle's card in 侧栏「插件」 is where the row is
 * switched off and where a reader is shown how to use it. Both read and write
 * the host half's one route, so this half holds no durable copy of anything.
 */

import { DOCK_ENTRY_ID, DOCK_ENTRY_ORDER, DOCK_SLOT, PLUGIN_ID } from '../shared/constants/index.ts'
import type { ClientContext, SkillsRemote } from './types/index.ts'
import { FastPillsCard } from './components/card.tsx'
import { PillRow, type PillRowInjected } from './components/pillRow.tsx'
import { createPillStore } from './services/pillStore.ts'
import { installStyles } from './constants/styles.ts'
import { watchPrefs } from './services/preferences.ts'
import { setSkillSource } from './services/skillCatalog.ts'

/** Stable entry name; matches the package name the host serves this bundle under. */
export const name = PLUGIN_ID

/** This half reads one engine service: the slot registry. */
export const inject: string[] = ['slots']

/** The plugin card's own section, keyed by the bundle's package name. */
const CARD_SLOT = 'plugins.bundle.config'

/**
 * Contribute the row and the card.
 * @param ctx - this plugin's client context.
 */
export function apply(ctx: ClientContext): void {
  installStyles(document)
  // The capsule form suggests skill names while the reader types a `/`; the
  // catalog is the page's own, so it is read from the same service the
  // composer's menu reads instead of being copied anywhere.
  //
  // The service is looked up on every call rather than here: this plugin may
  // well activate before the one that provides it, and a lookup at this point
  // would find nothing and never look again. It is optional either way — a
  // deployment without it still takes a skill name typed by hand.
  setSkillSource(async (sessionId) => {
    const skills = ctx.get('remote.skills') as SkillsRemote | undefined
    if (skills === undefined || typeof skills.list !== 'function') return []
    const answer = await skills.list({ sessionId })
    if (answer?.ok !== true) return []
    const list = answer.value?.skills
    if (!Array.isArray(list)) return []
    return list
      .filter(skill => typeof skill.name === 'string' && skill.name.length > 0)
      .map(skill => ({
        name: skill.name as string,
        description: typeof skill.description === 'string' ? skill.description : '',
      }))
  })
  // One tree source for every mount on the page: the data belongs to the page,
  // not to one mount, and each mount subscribes to it.
  const pills = createPillStore(fetch)
  // The stored settings are read before the first mount, so the panel opens on the
  // reader's own paper instead of flashing the default one and swapping.
  watchPrefs(pills)
  ctx.slots.inject(DOCK_SLOT, () => {
    ctx.slots.register<PillRowInjected>({
      name: DOCK_SLOT,
      id: DOCK_ENTRY_ID,
      order: DOCK_ENTRY_ORDER,
      // The two hooks: the plugin's own tree source, and the Session seat the
      // transcript reads a submitted prompt from.
      inject: () => ({ hooks: { pills }, pills }),
    }, PillRow)
  })
  ctx.slots.inject(CARD_SLOT, () => {
    ctx.slots.register({ name: CARD_SLOT, key: PLUGIN_ID, inject: () => ({ store: pills }) }, FastPillsCard)
  })
}
