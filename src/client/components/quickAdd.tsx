/**
 * The row's quick-add entry: the round button that opens the new-capsule form.
 *
 * It stands with the capsules rather than in the drawer, because the moment a
 * wording is worth keeping is the moment it was just typed above the composer.
 * The press opens the one new-capsule form, and what it makes goes to the top of
 * the first level: a capsule just written is the one about to be pressed, and a
 * fold would only hide it.
 *
 * The press carries two things in with it, so that saving a wording costs one
 * name and nothing else: the draft the composer is holding becomes the capsule's
 * body, and the workspace the session sits in is picked as its scope. Both are
 * read where they already live — the composer's own state seat and the page's
 * workspace list — rather than copied anywhere.
 *
 * The button is a circle the height of the capsules beside it, hollow with a
 * solid rim in the style colour's dark shade, and its tooltip is drawn in the
 * sheet rather than lent by the browser (see `.dfp-quick-add-tip`).
 */

import { useState, type JSX } from 'react'
import { QUICK_ADD_ATTRIBUTE } from '../../shared/constants/index.ts'
import { workspaceScope } from '../../shared/utils/pillRules.ts'
import { addPill } from '../../shared/utils/pillTree.ts'
import { Dialog } from './controls.tsx'
import { NewPillForm, draftBodyOf, type PillDraft, type WorkspaceChoice } from './pillForm.tsx'
import { useText } from '../contexts/textContext.ts'
import type { ComposerInputState, SnapshotSelectorHook } from '../types/index.ts'
import type { Pill } from '../../shared/types/index.ts'
import type { PillStore } from '../services/pillStore.ts'

/** Everything the quick-add entry receives. */
export interface QuickAddProps {
  /** The page's tree source; what the form makes is put at the top of it. */
  readonly store: PillStore
  /** The workspaces this project knows, offered as the form's scope entries. */
  readonly workspaces: readonly WorkspaceChoice[]
  /** The session whose skill catalog the body box suggests from. */
  readonly sessionId: string
  /** The composer's own state seat, where the words about to be saved are. */
  readonly useInput: SnapshotSelectorHook<ComposerInputState>
  /** The directory the session sits in: the workspace a new capsule is limited to. */
  readonly current: string | undefined
}

/**
 * Render the round quick-add button and the dialog behind it.
 * @param props - the tree source, the workspaces, the session and the composer's seat.
 * @returns the button, and the dialog while it is open.
 */
export function QuickAdd({ store, workspaces, sessionId, useInput, current }: QuickAddProps): JSX.Element {
  const t = useText()
  const [open, setOpen] = useState(false)
  // The draft is read here rather than in the row: only this button needs it, so
  // only this button is redrawn while the reader types.
  const draft = useInput(state => state.draft)
  /** What the form opens on: the composer's words, and the workspace they belong to. */
  const initial: Partial<PillDraft> = { ...draftBodyOf(draft), scope: workspaceScope(workspaces, current) }

  const add = (pill: Pill): void => {
    // The read is the store's own published tree, which is the list this row is
    // drawing from: an entry made here lands where the reader just looked.
    void store.save(addPill(store.getSnapshot().tree, { kind: 'top' }, pill))
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="dfp-quick-add"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('row.quickAddCapsule')}
        {...{ [QUICK_ADD_ATTRIBUTE]: 'button' }}
        onClick={() => { setOpen(true) }}
      >
        <span aria-hidden="true">⚡</span>
        <span className="dfp-quick-add-tip" aria-hidden="true">{t('row.quickAddCapsule')}</span>
      </button>
      <Dialog open={open} onClose={() => { setOpen(false) }} title={t('row.quickAddCapsule')}>
        <NewPillForm
          workspaces={workspaces}
          sessionId={sessionId}
          initial={initial}
          onAdd={add}
          onCancel={() => { setOpen(false) }}
        />
      </Dialog>
    </>
  )
}
