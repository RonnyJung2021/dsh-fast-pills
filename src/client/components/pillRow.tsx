/**
 * The pill row above the composer.
 *
 * It renders the stored tree as two levels — top-level capsules and group
 * capsules that fold their children open — filtered by the directory the
 * session sits in. A press splices one capsule's text into the draft at the
 * caret and records it; a quick capsule also submits the whole draft about a
 * second later. Fold state lives here and nowhere else, so a reload starts
 * fully folded — and an open fold is a moment rather than a mode: it closes
 * again as soon as the reader presses anywhere outside it, or presses one of
 * the capsules inside it.
 *
 * The row opens with the round entry: today's press count, and the
 * drawer that holds the statistics, this same tree as an editor, and the
 * recognition tab. Beside it stands the quick-add button, which writes a new
 * capsule into the row without the drawer being opened at all.
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type JSX, type RefObject,
} from 'react'
import type {
  InputActions, SessionId, SnapshotHook, SnapshotSelectorHook, ComposerInputState, WorkspaceSnapshot,
} from '../types/index.ts'
import {
  CIRCLE_ATTRIBUTE, GROUP_ATTRIBUTE, PILL_ATTRIBUTE, ROW_ATTRIBUTE,
} from '../../shared/constants/index.ts'
import { useCapture, type UseSession } from '../services/transcriptCapture.ts'
import { PillDrawer } from './drawer.tsx'
import type { WorkspaceChoice } from './pillForm.tsx'
import { QuickAdd } from './quickAdd.tsx'
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

/** The composer's state standard seat, narrowed to the field the quick add borrows. */
export type UseInput = SnapshotSelectorHook<ComposerInputState>

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
  /** What the composer is holding now, for the quick-add button to carry into the form. */
  readonly useInput: UseInput
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
 * Where one fold sits, and how far it may grow.
 *
 * The open fold is centred on its own group capsule and capped at the row's own
 * width, so it grows to the left and to the right together until the row is
 * full and only then wraps inside. Two offsets are measured for it: the group's
 * centre within the row, and the nudge that keeps a fold centred near an edge
 * from hanging off that edge. It is measured when the fold opens (and again if
 * the page is resized under it), never while it is closed: a closed fold draws
 * nothing, and a row that reflows does not need measuring.
 *
 * The measurement does not depend on where the fold currently sits — the fold's
 * own width is already capped by the row through the sheet, and the wanted
 * position is computed from that width and the group's centre — so one pass is
 * enough. It runs in a layout effect, before the browser paints, which is why a
 * fold never appears in the wrong place first.
 * @param open - whether this entry's fold is showing.
 * @returns the entry's ref, the fold's ref, and the two offsets as style.
 */
function useFoldPlacement(open: boolean): {
  readonly ref: RefObject<HTMLSpanElement | null>
  readonly bodyRef: RefObject<HTMLDivElement | null>
  readonly style: CSSProperties
} {
  const ref: RefObject<HTMLSpanElement | null> = useRef(null)
  const bodyRef: RefObject<HTMLDivElement | null> = useRef(null)
  const [placed, setPlaced] = useState({ center: 0, shift: 0 })
  useLayoutEffect(() => {
    if (!open) return undefined
    const node = ref.current
    const body = bodyRef.current
    const row = node?.parentElement
    if (node == null || body == null || row == null) return undefined
    const measure = (): void => {
      const rowBox = row.getBoundingClientRect()
      const nodeBox = node.getBoundingClientRect()
      const bodyBox = body.getBoundingClientRect()
      const center = Math.round(nodeBox.left - rowBox.left + nodeBox.width / 2)
      // 这一层想摆的左边缘，与它在这一排里真正能待的范围：想摆的位置超出去了，就整体推回来。
      const wanted = center - bodyBox.width / 2
      const room = Math.max(0, rowBox.width - bodyBox.width)
      const shift = Math.round(Math.min(Math.max(wanted, 0), room) - wanted)
      setPlaced(current => (current.center === center && current.shift === shift ? current : { center, shift }))
    }
    measure()
    // 量的是这一排，不是窗口：窗口一变、这一排自己换了行、胶囊多一颗少一颗，宽度都会变，
    // 而窗口那一侧的尺寸要等外壳自己算完才落到这一排上——所以盯这一排自己。
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => { observer.disconnect() }
  }, [open])
  return {
    ref,
    bodyRef,
    style: {
      '--dfp-fold-center': `${String(placed.center)}px`,
      '--dfp-fold-shift': `${String(placed.shift)}px`,
    } as CSSProperties,
  }
}

/** One first-level entry: a capsule, or a group capsule with its fold. */
function RowEntry({ node, open, directory, onToggle, onPress }: {
  readonly node: PillNode
  readonly open: boolean
  readonly directory: string | undefined
  readonly onToggle: (groupId: string) => void
  readonly onPress: (pill: Pill) => void
}): JSX.Element {
  const anchor = useFoldPlacement(node.kind === 'group' && open)
  if (node.kind === 'pill') return <PillButton pill={node} onPress={onPress} />
  const group: PillGroup = node
  const children = visibleChildren(group, directory)
  return (
    /* 展开的那一层以**这一排**为参照摆放（只借用这一格量出的中线），摆位由这里量出来，
       CSS 只读那两个数（见 `useFoldPlacement`）。 */
    <span
      className="dfp-group-wrap"
      ref={anchor.ref}
      style={anchor.style}
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
        <div className="dfp-group-body" ref={anchor.bodyRef} {...{ [`${ROW_ATTRIBUTE}-body`]: group.id }}>
          <div className="dfp-group-body-inner">
            {/* 按下一颗就把这一折收起来：这一折的用处就是让人挑一颗，挑完就该让位。 */}
            {children.map(child => (
              <PillButton
                key={child.id}
                pill={child}
                onPress={(pill) => { onPress(pill); onToggle(group.id) }}
              />
            ))}
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
  sessionId, useSessions, useWorkspaces, useSession, inputActions, useInput, usePills, pills,
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

  // 展开的那一折在别处一按就收：它是一次「挑一颗」的动作，挑完就该把这一排还给胶囊。
  // 按在这一折自己那一格上（分组胶囊或它展开的那一层）不算别处，那颗胶囊按完由它自己收。
  useEffect(() => {
    if (openGroups.size === 0) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      const entry = target instanceof Element ? target.closest('.dfp-group-wrap') : null
      const pressed = entry?.querySelector(`[${GROUP_ATTRIBUTE}]`)?.getAttribute(GROUP_ATTRIBUTE) ?? null
      setOpenGroups((open) => {
        const next = new Set([...open].filter(id => id === pressed))
        // 没有变化就把原来那个集合还回去：页面上每一次按下都不该让这一排重画一次。
        return next.size === open.size ? open : next
      })
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [openGroups.size])

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
        <QuickAdd
          store={pills}
          workspaces={workspaces}
          sessionId={sessionId}
          useInput={useInput}
          current={directory}
        />
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
