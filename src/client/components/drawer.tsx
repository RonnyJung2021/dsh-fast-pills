/**
 * The drawer the round entry opens: a wide panel down the right edge.
 *
 * It is one of the panel's two mounts. The mask behind it, the panel
 * itself and the Escape key all close it, and `useModalLayer` is what keeps
 * Escape and Tab meaningful while a confirmation dialog is open on top of it.
 */

import { useRef, type CSSProperties, type JSX, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useModalLayer } from '@deepseek-ai/dsh-client-ui-primitives'
import { DRAWER_ATTRIBUTE } from '../../shared/constants/index.ts'
import { FastPillsPanel, type PanelTab } from './panel.tsx'
import type { WorkspaceChoice } from './pillForm.tsx'
import type { PillStore } from '../services/pillStore.ts'
import { colorStyle, usePrefs } from '../services/preferences.ts'

/** Everything the drawer receives. */
export interface PillDrawerProps {
  /** Whether the drawer is showing; a closed drawer renders nothing. */
  readonly open: boolean
  /** Called by the mask, the close control, Escape, or the round entry again. */
  readonly onClose: () => void
  /** The page's tree source. */
  readonly store: PillStore
  /** Which tab to show; the statistics by default. */
  readonly tab?: PanelTab
  /** The workspaces this project knows, for the capsule editor's scope list. */
  readonly workspaces?: readonly WorkspaceChoice[]
  /** The session whose skill catalog the capsule form suggests from. */
  readonly sessionId?: string
}

/**
 * Render the right-hand drawer.
 * @param props - the open state, the close command and the tree source.
 * @returns the overlay, or nothing while closed.
 */
export function PillDrawer({
  open, onClose, store, tab, workspaces = [], sessionId = '',
}: PillDrawerProps): JSX.Element | null {
  const panel: RefObject<HTMLDivElement | null> = useRef(null)
  const prefs = usePrefs(store)
  useModalLayer(panel, open, onClose)
  if (!open) return null
  /* The drawer's width is one of the reader's settings, so it rides in as a
     custom property rather than being written into the sheet. */
  const style: CSSProperties & Record<string, string> = {
    '--dfp-drawer-width': `${String(prefs.drawerWidth)}vw`,
    // 主题与外观里那三支颜色：抽屉外那层也要带上，遮罩与抽屉才是一套色。
    ...colorStyle(prefs),
  }
  return createPortal(
    /* The paper rides on the overlay rather than on the drawer itself, so the
       mask behind it is drawn from the same tokens. */
    <div className="dfp-drawer-root" data-dfp-theme={prefs.resolved} style={style}>
      <div className="dfp-drawer-mask" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        className="dfp-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="胶囊面板"
        tabIndex={-1}
        {...{ [DRAWER_ATTRIBUTE]: 'drawer' }}
      >
        {/* No title bar: the panel's own top row is the tab strip, with the one
            square close cell at its right end. */}
        <FastPillsPanel
          store={store}
          onClose={onClose}
          workspaces={workspaces}
          sessionId={sessionId}
          {...(tab === undefined ? {} : { tab })}
        />
      </div>
    </div>,
    document.body,
  )
}
