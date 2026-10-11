/**
 * The pill row above the composer.
 *
 * It renders the stored tree as two levels — top-level capsules and group
 * capsules that fold their children open — filtered by the directory the
 * session sits in. A press splices one capsule's text into the draft at the
 * caret and records it; a quick capsule also submits the whole draft about a
 * second later. Fold state lives here and nowhere else, so a reload starts
 * fully folded.
 *
 * The row opens with the round entry: today's press count, and the
 * drawer that holds the statistics, this same tree as an editor, and the
 * recognition tab.
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type JSX, type RefObject,
} from 'react'
import type {
  InputActions, SessionId, SnapshotHook, SnapshotSelectorHook, WorkspaceSnapshot,
} from '../types/index.ts'
import {
  CIRCLE_ATTRIBUTE, GROUP_ATTRIBUTE, PILL_ATTRIBUTE, ROW_ATTRIBUTE,
} from '../../shared/constants/index.ts'
import { useCapture, type UseSession } from '../services/transcriptCapture.ts'
import { PillDrawer } from './drawer.tsx'
import type { WorkspaceChoice } from './pillForm.tsx'
import { textFor } from '../../shared/locales/index.ts'
import { TextContext } from '../contexts/textContext.ts'
import { colorStyle, usePrefs } from '../services/preferences.ts'
import { pillInsertion, visibleChildren, visibleTree, workspaceName } from '../../shared/utils/pillRules.ts'
import type { PillStore, PillStoreState } from '../services/pillStore.ts'
import type { Pill, PillGroup, PillNode } from '../../shared/types/index.ts'

/** The Session list standard seat, narrowed to the one column the row reads. */
export type UseSessions = SnapshotSelectorHook<{ readonly byId: Readonly<Record<string, { readonly cwd?: string }>> }>

/** The Workspace list standard seat, narrowed to the two columns the row reads. */
export type UseWorkspaces = SnapshotSelectorHook<WorkspaceSnapshot>

/** The registrant's data face: the tree source, bound to `usePills` by the renderer. */
export type PillRowInjected = {
  readonly hooks: { readonly pills: { getSnapshot: () => PillStoreState; subscribe: (listener: () => void) => () => void } }
  /** The same source, for the writes only a component may start. */
  readonly pills: PillStore
}

/** Everything the row receives besides the slot kit. */
export interface PillRowProps {
  /** Identity of the session this row belongs to, for the usage row and the transcript. */
  readonly sessionId: SessionId
  /** The Session list, where the host reports each session's directory. */
  readonly useSessions: UseSessions
  /** The Workspace list, the directory fallback for a session the catalog has not caught up with. */
  readonly useWorkspaces: UseWorkspaces
  /** This session's own snapshot, where a submitted prompt appears first. */
  readonly useSession: UseSession
  /** The composer's insert and submit verbs. */
  readonly inputActions: InputActions
  /** The tree the row renders: the injected source, bound as a selector hook. */
  readonly usePills: SnapshotHook<PillStoreState>
  /** The tree source itself, for the press ledger and the drawer. */
  readonly pills: PillStore
}

/**
 * Resolve the session's directory.
 *
 * The Session list is the authority; a session the catalog has not described
 * yet falls back to its Workspace's path. An unresolved directory stays
 * `undefined` and hides every scoped capsule.
 * @param useSessions - Session list hook.
 * @param useWorkspaces - Workspace list hook.
 * @param sessionId - the current session.
 * @returns the absolute directory, when one is known.
 */
function useDirectory(useSessions: UseSessions, useWorkspaces: UseWorkspaces, sessionId: SessionId): string | undefined {
  const cwd = useSessions(list => list.byId[sessionId]?.cwd)
  const workspacePath = useWorkspaces(state => state.items.find(item => item.sessionIds.includes(sessionId))?.path)
  return cwd ?? workspacePath
}

/**
 * The workspaces this project knows, as scope entries.
 *
 * A scope entry matches a directory by its own name, so that is what is offered
 * first; the absolute path rides along as the tooltip for when two projects
 * share a name.
 * @param useWorkspaces - the page's Workspace list.
 * @returns the choices, in the order the page holds them.
 */
function useWorkspaceChoices(useWorkspaces: UseWorkspaces): WorkspaceChoice[] {
  const items = useWorkspaces(state => state.items)
  return useMemo(
    () => items.map(item => ({ name: workspaceName(item.path), path: item.path })),
    [items],
  )
}

/** One pressable capsule. */
function PillButton({ pill, onPress }: { readonly pill: Pill; readonly onPress: (pill: Pill) => void }): JSX.Element {
  const hint = pill.skill === null ? pill.body : `/${pill.skill} ${pill.body}`
  return (
    <button
      type="button"
      className="dfp-pill"
      title={hint.slice(0, 200)}
      data-quick={pill.quick ? 'true' : 'false'}
      {...{ [PILL_ATTRIBUTE]: pill.id }}
      onClick={() => { onPress(pill) }}
    >
      {pill.name}
    </button>
  )
}

/**
 * Today's count, as a little board that rolls.
 *
 * Each digit is its own cell and each change remounts it under a fresh key, so
 * the same `dfp-roll` animation plays on every change — one digit turning over
 * the way a split-flap board does. The digits are read as one number; the
 * spaces between the cells are the cells' own padding, not characters.
 * @param props.value - how many capsules were pressed today.
 * @returns the count.
 */
function CircleCount({ value }: { readonly value: number }): JSX.Element {
  return (
    <span className="dfp-count" aria-label={String(value)}>
      {String(value).split('').map((digit, position) => (
        <span className="dfp-count-cell" key={`${String(position)}-${digit}`} aria-hidden="true">{digit}</span>
      ))}
    </span>
  )
}

/**
 * How far this fold's own entry sits from the row's left edge.
 *
 * The open fold is anchored to the row rather than to its own group — it should
 * start where the row starts, not where the button happens to sit — and it is
 * positioned relative to that button, so the offset is measured here and handed
 * to the stylesheet as `--dfp-fold-inset`. It is measured when the fold opens
 * (and again if the page is resized under it), never while it is closed: a
 * closed fold draws nothing, and a row that reflows does not need measuring.
 * @param open - whether this entry's fold is showing.
 * @returns the entry's ref and the offset in pixels.
 */
function useFoldInset(open: boolean): { readonly ref: RefObject<HTMLSpanElement | null>; readonly inset: number } {
  const ref: RefObject<HTMLSpanElement | null> = useRef(null)
  const [inset, setInset] = useState(0)
  useLayoutEffect(() => {
    if (!open) return
    const measure = (): void => {
      const node = ref.current
      const row = node?.parentElement
      if (node == null || row == null) return
      setInset(Math.max(0, Math.round(node.getBoundingClientRect().left - row.getBoundingClientRect().left)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => { window.removeEventListener('resize', measure) }
  }, [open])
  return { ref, inset }
}

/** One first-level entry: a capsule, or a group capsule with its fold. */
function RowEntry({ node, open, directory, onToggle, onPress }: {
  readonly node: PillNode
  readonly open: boolean
  readonly directory: string | undefined
  readonly onToggle: (groupId: string) => void
  readonly onPress: (pill: Pill) => void
}): JSX.Element {
  const anchor = useFoldInset(node.kind === 'group' && open)
  if (node.kind === 'pill') return <PillButton pill={node} onPress={onPress} />
  const group: PillGroup = node
  const children = visibleChildren(group, directory)
  return (
    /* 展开的那一层是绝对定位的，要从这一排的左边缘开始，就得知道这一格离那一排的左边缘多远：
       这个负的偏移由这里量出来（见 `useFoldInset`），CSS 只需要读它。 */
    <span
      className="dfp-group-wrap"
      ref={anchor.ref}
      style={{ '--dfp-fold-inset': `${String(anchor.inset)}px` } as CSSProperties}
    >
      <button
        type="button"
        className="dfp-group"
        aria-expanded={open}
        title={group.name}
        data-children={children.length}
        {...{ [GROUP_ATTRIBUTE]: group.id }}
        onClick={() => { onToggle(group.id) }}
      >
        {group.name}
      </button>
      {/* 展开是往上长的：这一排排在分组按钮上面，按钮自己不会因为多出来的内容被顶走。 */}
      {open && (
        <div className="dfp-group-body" {...{ [`${ROW_ATTRIBUTE}-body`]: group.id }}>
          <div className="dfp-group-body-inner">
            {children.map(child => <PillButton key={child.id} pill={child} onPress={onPress} />)}
          </div>
        </div>
      )}
    </span>
  )
}

/**
 * The dock entry.
 * @param props - the slot kit, the session, the three hooks and the two verbs.
 * @returns the row.
 */
export function PillRow({
  sessionId, useSessions, useWorkspaces, useSession, inputActions, usePills, pills,
}: PillRowProps): JSX.Element | null {
  const state = usePills(snapshot => snapshot)
  const prefs = usePrefs(pills)
  const t = textFor(prefs.locale)
  const directory = useDirectory(useSessions, useWorkspaces, sessionId)
  const workspaces = useWorkspaceChoices(useWorkspaces)
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set())
  const [drawer, setDrawer] = useState(false)
  const quickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Every prompt this session submits lands in the transcript,
  // masked before it leaves the page.
  useCapture(useSession, pills, sessionId, workspaceName(directory), prefs.locale)

  // The timer belongs to the row, not to the click: an unmount drops it, or a
  // remounted row would submit a draft it never touched.
  useEffect(() => () => {
    if (quickTimer.current !== undefined) clearTimeout(quickTimer.current)
  }, [])

  const shown = useMemo(() => visibleTree(state.tree, directory), [state.tree, directory])

  const onToggle = useCallback((groupId: string) => {
    // Opening and closing a group is not a use, and writes nothing.
    setOpenGroups((open) => {
      const next = new Set(open)
      if (!next.delete(groupId)) next.add(groupId)
      return next
    })
  }, [])

  const onPress = useCallback((pill: Pill) => {
    const insertion = pillInsertion(pill)
    // Capture now and insert on the same gesture: text must not reach a
    // re-locked editor, and the press must not take the keyboard.
    const span = insertion.text.length === 0 ? undefined : inputActions.captureInsertion()
    const inserted = span === undefined ? true : inputActions.insertText(insertion.text, span)
    if (!inserted) return
    // One inserting press is one row; the submit below is not
    // recorded again, and a group press never reaches here.
    pills.notePress({
      pillId: pill.id,
      workspace: workspaceName(directory),
      session: sessionId,
    })
    if (!insertion.quick) return
    quickTimer.current = setTimeout(() => { inputActions.submit() }, prefs.quickDelayMs)
  }, [directory, inputActions, pills, prefs.quickDelayMs, sessionId])

  // The plugin card's one switch. Off means the row draws nothing at all — the
  // panel's only entry is on this row, so the page that carries the switch is
  // also the page that hands the row back.
  if (!prefs.showRow) return null

  return (
    <TextContext.Provider value={t}>
      {/* 读者在「主题与外观」里挑的那几支颜色写在**这一排自己**的根上：这一排在输入框上方，
          不在面板里，面板根上的变量传不到这里。 */}
      <div style={colorStyle(prefs)} {...{ [ROW_ATTRIBUTE]: 'row' }}>
        <button
          type="button"
          className="dfp-circle"
          aria-expanded={drawer}
          aria-haspopup="dialog"
          title={t('row.capsuleLedgerSettings')}
          {...{ [CIRCLE_ATTRIBUTE]: 'circle' }}
          onClick={() => { setDrawer(open => !open) }}
        >
          <CircleCount value={state.today} />
        </button>
        {state.status === 'error' && (
          <span className="dfp-note">{t('row.capsulesCouldReadWhy', { why: state.error ?? t('row.unknownError') })}</span>
        )}
        {state.degraded !== undefined && (
          <span className="dfp-note">{t('row.damagedNotice', { file: state.degraded })}</span>
        )}
        {shown.map(node => (
          <RowEntry
            key={node.id}
            node={node}
            open={openGroups.has(node.id)}
            directory={directory}
            onToggle={onToggle}
            onPress={onPress}
          />
        ))}
        <PillDrawer
          open={drawer}
          onClose={() => { setDrawer(false) }}
          store={pills}
          workspaces={workspaces}
          sessionId={sessionId}
        />
      </div>
    </TextContext.Provider>
  )
}
