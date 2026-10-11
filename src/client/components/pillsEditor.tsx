/**
 * The settings tab: the one editable capsule tree.
 *
 * It shows the stored tree itself, in stored order and unfiltered — the
 * page's row hides what the current directory may not see, this tree does not —
 * so what is edited here is what the row draws. Every edit is
 * published by the store at once, which is why the page changes while the
 * panel is still open.
 *
 * Two habits run through the whole panel. Names are edited where they are:
 * a double press on a name turns it into the input it was always going to
 * become, and looking away saves. And a drag says where it will land before
 * the hand lets go — a heavy line in the gap between two rows, or the fold the
 * capsule is about to join lit up around its name. Both are spelt out once, in
 * the block of tips under the tree, rather than under every fold.
 *
 * The questions this panel asks before it destroys something are worth naming:
 * which halves of a deleted group go, and what each clean-up action costs. A
 * fold with nothing in it is not one of them — deleting an empty fold
 * destroys nothing.
 */

import {
  useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type JSX, type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { NODE_ATTRIBUTE } from '../../shared/constants/index.ts'
import type { Pill, PillGroup, PillNode } from '../../shared/types/index.ts'
import { Action, Dialog, Tag } from './controls.tsx'
import { useText } from '../contexts/textContext.ts'
import {
  EMPTY_DRAFT, PillForm, ScopeChips, draftOf, pillOf, type PillDraft, type WorkspaceChoice,
} from './pillForm.tsx'
import type { PillStore } from '../services/pillStore.ts'
import {
  addGroup, addPill, countEntries, editGroup, moveEntry, movePill, newId, removeGroup, removePill,
  renameNode, updatePill, type GroupRemoval, type PillTarget,
} from '../../shared/utils/pillTree.ts'
import { useStore } from '../hooks/useStore.ts'

/** What the panel is asking before it does something irreversible. */
type Question =
  | { readonly kind: 'group'; readonly group: PillGroup }
  | { readonly kind: 'clear-usage'; readonly rows: number }
  | { readonly kind: 'reset'; readonly pills: number; readonly groups: number }

/** What the inline form is open on. */
type Editing =
  | { readonly kind: 'new-pill'; readonly target: PillTarget }
  | { readonly kind: 'pill'; readonly id: string }

/** A name being edited where it stands. */
interface Renaming {
  readonly id: string
  readonly text: string
}

/** A drag in progress: what is being carried, and where it came from. */
interface Dragged {
  readonly kind: 'pill' | 'group'
  readonly id: string
  /** The fold it is inside now; `null` for the first level. */
  readonly groupId: string | null
}

/**
 * Where a drop would land, drawn before the hand lets go.
 *
 * `before` and `after` name a gap between two entries of the first level, and
 * `into` names a fold the capsule would join at its top. They are one shape
 * because only one of them is ever set.
 */
type DropTarget =
  | { readonly kind: 'before' | 'after'; readonly groupId: string | null; readonly index: number }
  | { readonly kind: 'into'; readonly groupId: string }

/**
 * Where a drag over a fold's own row would land.
 *
 * A fold's row is two places at once: its upper and lower edges are the
 * first-level gaps beside it, and its middle is the fold itself — which is the
 * only way into a fold that is closed. Only a capsule goes in: folds never nest.
 * @param event - the drag event over the row.
 * @param held - what is being carried.
 * @param groupId - the fold the row belongs to.
 * @param index - the row's own index at the first level.
 * @returns the target the drop would use.
 */
function placeOnFold(
  event: DragEvent<HTMLElement>,
  held: Dragged,
  groupId: string,
  index: number,
): DropTarget {
  const box = event.currentTarget.getBoundingClientRect()
  const share = (event.clientY - box.top) / box.height
  if (held.kind === 'pill' && share > 0.25 && share < 0.75) return { kind: 'into', groupId }
  return share < 0.5
    ? { kind: 'before', groupId: null, index }
    : { kind: 'after', groupId: null, index }
}

/**
 * The index a carried entry lands on once it has left where it sat.
 *
 * Dragging down a list is the one case where the gap the hand pointed at moves
 * up by one when the entry is taken out of the list first, so the target is
 * corrected here rather than in every caller.
 * @param carried - what is being dragged.
 * @param to - the index the gap was read at.
 * @param from - the index it sat at, and `null` when it came from elsewhere.
 * @returns the index to insert at.
 */
function landingIndex(carried: Dragged, from: number | null, to: number): number {
  return from !== null && carried.kind !== 'group' && from < to ? to - 1 : to
}

/**
 * Which side of a row the pointer sits on.
 *
 * The upper half of a row means the entry goes above it and the lower half
 * means below, so the line lands in the gap the hand is pointing at.
 * @param event - the drag event over the row.
 * @returns `before` when the pointer is in the row's upper half.
 */
function halfOf(event: DragEvent<HTMLElement>): 'before' | 'after' {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? 'before' : 'after'
}

/**
 * The editable tree.
 * @param props.store - the page's tree source.
 * @param props.workspaces - the directories this project knows, offered as scopes.
 * @param props.sessionId - the session whose skill catalog the form suggests from.
 * @returns the panel body.
 */
export function PillsEditor({ store, workspaces, sessionId }: {
  readonly store: PillStore
  readonly workspaces: readonly WorkspaceChoice[]
  readonly sessionId: string
}): JSX.Element {
  const t = useText()
  const state = useStore(store)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [editing, setEditing] = useState<Editing | undefined>(undefined)
  const [draft, setDraft] = useState<PillDraft>(EMPTY_DRAFT)
  const [renaming, setRenaming] = useState<Renaming | undefined>(undefined)
  const [openScope, setOpenScope] = useState('')
  const [question, setQuestion] = useState<Question | undefined>(undefined)
  const [drop, setDrop] = useState<DropTarget | undefined>(undefined)
  const dragged = useRef<Dragged | undefined>(undefined)

  const tree = state.tree
  const totals = useMemo(() => countEntries(tree), [tree])

  /** The tree with `id` renamed as the reader is typing it. */
  const renamed = useMemo(() => {
    if (renaming === undefined) return tree
    return renameNode(tree, renaming.id, renaming.text)
  }, [renaming, tree])

  const openPillForm = useCallback((where: Editing, next: PillDraft) => {
    setDraft(next)
    setEditing(where)
    setRenaming(undefined)
  }, [])

  const savePill = useCallback(() => {
    if (editing === undefined) return
    if (editing.kind === 'new-pill') void store.save(addPill(tree, editing.target, pillOf(draft, newId('pill'), t)))
    else if (editing.kind === 'pill') void store.save(updatePill(tree, pillOf(draft, editing.id, t)))
    setEditing(undefined)
  }, [draft, editing, store, t, tree])

  const toggleGroup = useCallback((groupId: string) => {
    setExpanded((open) => {
      const next = new Set(open)
      if (!next.delete(groupId)) next.add(groupId)
      return next
    })
  }, [])

  /**
   * A press on a row's own space.
   *
   * A row is mostly blank — the margins, the count, the gap before the buttons
   * — and a press there means the one thing that row can do: a fold opens or
   * closes, a capsule shows or hides its editor. Anything with a meaning of its
   * own (a button, the name being renamed, the drag handle, the caret in a
   * field) keeps that meaning: those presses are left alone.
   */
  const pressOnRow = (event: ReactMouseEvent<HTMLElement>, act: () => void): void => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button, input, textarea, select, a, label, .dfp-row-grip') != null) return
    act()
  }

  /** Save the name being edited, if it is still open. */
  const commitRename = useCallback(() => {
    setRenaming((current) => {
      if (current !== undefined) void store.save(renameNode(tree, current.id, current.text.trim()))
      return undefined
    })
  }, [store, tree])

  /** Carry one entry to the position the drop indicator is showing. */
  const dropHere = useCallback((target: DropTarget) => {
    const carried = dragged.current
    dragged.current = undefined
    setDrop(undefined)
    if (carried === undefined) return
    if (carried.kind === 'group') {
      const from = tree.findIndex(node => node.id === carried.id)
      // The last gap in the tree is after the last entry, which no index names;
      // `move` clamps it back to the end.
      const to = target.kind === 'before' ? target.index : target.kind === 'after' ? target.index + 1 : from
      if (from >= 0 && to !== from) void store.save(moveEntry(tree, carried.id, to))
      return
    }
    if (target.kind === 'into') {
      // Dropping a capsule on a fold puts it at the top of that fold.
      void store.save(movePill(tree, carried.id, { kind: 'group', groupId: target.groupId }, 0))
      return
    }
    const index = target.kind === 'after' ? target.index + 1 : target.index
    if (target.groupId === null) {
      const from = carried.groupId === null ? tree.findIndex(node => node.id === carried.id) : null
      const to = landingIndex(carried, from, index)
      if (from === to) return
      void store.save(movePill(tree, carried.id, { kind: 'top' }, to))
      return
    }
    // 折内重排：从同一折里取出来的那颗会让目标位置前移一格，`landingIndex` 修的就是这一格。
    const fold = tree.find(node => node.kind === 'group' && node.id === target.groupId)
    const siblings = fold?.kind === 'group' ? fold.children : []
    const from = carried.groupId === target.groupId
      ? siblings.findIndex(child => child.id === carried.id)
      : null
    const to = landingIndex(carried, from, index)
    if (from === to) return
    void store.save(movePill(tree, carried.id, { kind: 'group', groupId: target.groupId }, to))
  }, [store, tree])

  /** The handlers that make one entry draggable, and say what it carries. */
  const dragSource = (carry: Dragged) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      dragged.current = carry
      event.dataTransfer.effectAllowed = 'move'
      // A drag with no payload is ignored by some browsers, so one goes along.
      event.dataTransfer.setData('text/plain', carry.id)
    },
    onDragEnd: () => { dragged.current = undefined; setDrop(undefined) },
  })

  /** The handlers that make one first-level entry a place a drag can land. */
  const topDrop = (index: number) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const held = dragged.current
      if (held === undefined) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      const half = halfOf(event)
      setDrop(half === 'before'
        ? { kind: 'before', groupId: null, index }
        : { kind: 'after', groupId: null, index })
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const half = halfOf(event)
      dropHere(half === 'before'
        ? { kind: 'before', groupId: null, index }
        : { kind: 'after', groupId: null, index })
    },
  })

  /** The handlers for a fold's own row: its edges are first-level gaps, its middle is the fold. */
  const foldDrop = (groupId: string, index: number) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const held = dragged.current
      if (held === undefined) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      setDrop(placeOnFold(event, held, groupId, index))
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const held = dragged.current
      if (held === undefined) return
      dropHere(placeOnFold(event, held, groupId, index))
    },
  })

  /**
   * The handlers that make one capsule inside a fold a place a drag can land.
   *
   * The upper half of the row means above it and the lower half below it, the
   * same rule the first level uses: a capsule can be put between two others, not
   * only at the top of the fold. A capsule coming from outside the fold lands in
   * the gap the hand pointed at, which is where it would have landed anyway.
   */
  const childDrop = (groupId: string, index: number) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const held = dragged.current
      if (held === undefined || held.kind !== 'pill') return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      const half = halfOf(event)
      setDrop(half === 'before' ? { kind: 'before', groupId, index } : { kind: 'after', groupId, index })
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const half = halfOf(event)
      dropHere(half === 'before' ? { kind: 'before', groupId, index } : { kind: 'after', groupId, index })
    },
  })

  /** Ask the two clean-up questions with the numbers this tree and ledger hold. */
  const askClearUsage = useCallback(() => {
    void Promise.resolve(store.usageTotal()).then((rows) => {
      setQuestion({ kind: 'clear-usage', rows: rows ?? 0 })
    })
  }, [store])

  const askReset = useCallback(() => {
    setQuestion({ kind: 'reset', pills: totals.pills, groups: totals.groups })
  }, [totals.groups, totals.pills])

  /** Answer the delete-group question: the capsules go, or they outlive the group. */
  const answerGroup = useCallback((removal: GroupRemoval) => {
    if (question?.kind === 'group') void store.save(removeGroup(tree, question.group.id, removal))
    setQuestion(undefined)
  }, [question, store, tree])

  /** One name, as text until it is double-pressed and an input afterwards. */
  const nameCell = (id: string, name: string, className: string): JSX.Element => (
    renaming?.id === id
      ? (
        <input
          className={`dfp-input dfp-name-input ${className}`}
          autoFocus
          value={renaming.text}
          onChange={event => { setRenaming({ id, text: event.currentTarget.value }) }}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename()
            if (event.key === 'Escape') {
              // Escape belongs to the name being edited, not to the drawer:
              // letting it through would take the whole panel away.
              event.stopPropagation()
              setRenaming(undefined)
            }
          }}
        />
      )
      : (
        <span
          className={`${className} dfp-name`}
          title={t('editor.doublePressRename')}
          onDoubleClick={() => { setRenaming({ id, text: name }) }}
        >
          {name}
        </span>
      )
  )

  /** One gap's own line, drawn while a drag is over it. */
  const gapLine = (groupId: string | null, index: number, side: 'before' | 'after'): JSX.Element | null => (
    (drop?.kind === 'before' || drop?.kind === 'after')
      && drop.groupId === groupId && drop.index === index && drop.kind === side
      ? <div className="dfp-dropline" aria-hidden="true" />
      : null
  )

  /** One capsule's row. */
  const pillRow = (pill: Pill, groupId: string | null, index: number): JSX.Element => (
    <div className="dfp-row-wrap" key={pill.id}>
      {gapLine(groupId, index, 'before')}
      {/* 折内「落到最上面」那一处：画在第一颗的前面，和旁边的折名一行对得上。 */}
      {index === 0 && drop?.kind === 'into' && drop.groupId === groupId
        && <div className="dfp-dropline" aria-hidden="true" />}
      <div
        className="dfp-row dfp-row-pill"
        {...{ [NODE_ATTRIBUTE]: pill.id }}
        {...dragSource({ kind: 'pill', id: pill.id, groupId })}
        {...(groupId === null
          ? topDrop(index)
          : childDrop(groupId, index))}
        onClick={(event) => {
          pressOnRow(event, () => {
            // The same press opens the editor and closes it again; the 编辑
            // button beside it stays for anyone who looks for a button.
            if (editing?.kind === 'pill' && editing.id === pill.id) setEditing(undefined)
            else openPillForm({ kind: 'pill', id: pill.id }, draftOf(pill))
          })
        }}
      >
        <span className="dfp-row-grip" aria-hidden="true">⠿</span>
        {nameCell(pill.id, pill.name, 'dfp-row-name')}
        <span className="dfp-row-kind" data-quick={pill.quick ? 'true' : 'false'}>
          {t(pill.quick ? 'editor.quick' : 'editor.normal')}
        </span>
        {pill.scope.length > 0 && (
          <button
            type="button"
            className="dfp-scope-tag"
            title={t('editor.capsuleScopeLabel')}
            onClick={() => { openPillForm({ kind: 'pill', id: pill.id }, draftOf(pill)) }}
          >
            {t('editor.onlyList', { list: pill.scope.join('、') })}
          </button>
        )}
        <span className="dfp-row-quiet">{pill.skill === null ? pill.body : `/${pill.skill} ${pill.body}`}</span>
        <span className="dfp-row-actions">
          <Action variant="ghost" onClick={() => { openPillForm({ kind: 'pill', id: pill.id }, draftOf(pill)) }}>
            {t('editor.edit')}
          </Action>
          <Action variant="ghost" onClick={() => { void store.save(removePill(tree, pill.id)) }}>
            {t('editor.delete')}
          </Action>
        </span>
      </div>
      {editing?.kind === 'pill' && editing.id === pill.id && (
        <PillForm
          key={pill.id}
          draft={draft}
          editing
          workspaces={workspaces}
          sessionId={sessionId}
          onDraft={setDraft}
          onSave={savePill}
          onCancel={() => { setEditing(undefined) }}
        />
      )}
      {gapLine(groupId, index, 'after')}
    </div>
  )

  /** One group's row, plus its children when it is open. */
  const groupRow = (group: PillGroup, index: number): JSX.Element => {
    const open = expanded.has(group.id)
    const into: DropTarget = { kind: 'into', groupId: group.id }
    return (
      <div
        className="dfp-group-wrap"
        key={group.id}
        data-drop-into={drop?.kind === 'into' && drop.groupId === group.id ? 'true' : 'false'}
      >
        {gapLine(null, index, 'before')}
        <div
          className="dfp-row dfp-row-group"
          data-drop-into={drop?.kind === 'into' && drop.groupId === group.id ? 'true' : 'false'}
          {...{ [NODE_ATTRIBUTE]: group.id }}
          {...dragSource({ kind: 'group', id: group.id, groupId: null })}
          {...foldDrop(group.id, index)}
          onClick={(event) => { pressOnRow(event, () => { toggleGroup(group.id) }) }}
        >
          <span className="dfp-row-grip" aria-hidden="true">⠿</span>
          <button
            type="button"
            className="dfp-row-toggle"
            aria-expanded={open}
            onClick={() => { toggleGroup(group.id) }}
          >
            {open ? '▾' : '▸'}
          </button>
          {nameCell(group.id, group.name, 'dfp-row-name')}
          {/* 几颗就说几颗，不加标签：它是名字后面的一小段字，不是另一个控件。 */}
          <span className="dfp-row-count">{t('（{n}）', { n: group.children.length })}</span>
          {group.scope.length > 0 && (
            <button
              type="button"
              className="dfp-scope-tag"
              title={t('editor.changeFoldSWorkspaces')}
              onClick={() => { setOpenScope(current => (current === group.id ? '' : group.id)) }}
            >
              {t('editor.onlyList', { list: group.scope.join('、') })}
            </button>
          )}
          <span className="dfp-row-actions">
            <Action
              variant="ghost"
              onClick={() => { openPillForm({ kind: 'new-pill', target: { kind: 'group', groupId: group.id } }, EMPTY_DRAFT) }}
            >
              {t('editor.newInside')}
            </Action>
            <Action
              variant="ghost"
              onClick={() => { setOpenScope(current => (current === group.id ? '' : group.id)) }}
            >
              {t('editor.scope')}
            </Action>
            <Action
              variant="ghost"
              onClick={() => {
                // An empty fold destroys nothing when it goes, so it just goes.
                if (group.children.length === 0) void store.save(removeGroup(tree, group.id, 'children'))
                else setQuestion({ kind: 'group', group })
              }}
            >
              {t('editor.delete')}
            </Action>
          </span>
        </div>

        {openScope === group.id && (
          <div className="dfp-group-scope">
            <span className="dfp-field-label">{t('editor.foldScopeLabel')}</span>
            <ScopeChips
              scope={group.scope}
              workspaces={workspaces}
              onChange={(next) => { void store.save(editGroup(tree, group.id, { scope: next })) }}
            />
            <p className="dfp-field-note">
              {t('editor.foldScopeNote')}
            </p>
          </div>
        )}

        {editing?.kind === 'new-pill' && editing.target.kind === 'group' && editing.target.groupId === group.id && (
          <PillForm
            draft={draft}
            editing={false}
            workspaces={workspaces}
            sessionId={sessionId}
            onDraft={setDraft}
            onSave={savePill}
            onCancel={() => { setEditing(undefined) }}
          />
        )}

        {open && (
          <div
            className="dfp-group-children"
            onDragOver={(event) => {
              const held = dragged.current
              if (held === undefined || held.kind !== 'pill') return
              event.preventDefault()
              // The empty space inside a fold is the fold itself: a capsule
              // dropped there joins it at the top.
              setDrop(into)
            }}
            onDrop={(event) => { event.preventDefault(); dropHere(into) }}
          >
            {group.children.length === 0 && (
              <p className="dfp-quiet">{t('editor.foldEmpty')}</p>
            )}
            {group.children.map((child, childIndex) => pillRow(child, group.id, childIndex))}
          </div>
        )}
      </div>
    )
  }

  /** The row shape an entry gets, whichever kind it is. */
  const entryRow = (node: PillNode, index: number): JSX.Element => (
    node.kind === 'group' ? groupRow(node, index) : pillRow(node, null, index)
  )

  // A drag that ends anywhere else still has to put the indicator away.
  useEffect(() => {
    const clear = (): void => { dragged.current = undefined; setDrop(undefined) }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  return (
    <div className="dfp-editor">
      <div className="dfp-editor-bar">
        <Action
          variant="primary"
          onClick={() => { openPillForm({ kind: 'new-pill', target: { kind: 'top' } }, EMPTY_DRAFT) }}
        >
          {t('editor.addCapsule')}
        </Action>
        <Action
          onClick={() => {
            const made = addGroup(tree, t('editor.newGroupHeading'))
            setExpanded((open) => new Set(open).add(made.group.id))
            // The name it was given is a placeholder; it opens ready to be
            // replaced, which is the only thing anybody wants next.
            setRenaming({ id: made.group.id, text: made.group.name })
            setEditing(undefined)
            void store.save(made.tree)
          }}
        >
          {t('editor.newGroupAction')}
        </Action>
        <span className="dfp-quiet">{t('editor.totals', { pills: totals.pills, groups: totals.groups })}</span>
      </div>

      {state.status === 'error' && (
        <p className="dfp-quiet">{t('row.capsulesCouldReadWhy', { why: state.error ?? t('row.unknownError') })}</p>
      )}
      {state.degraded !== undefined && (
        <p className="dfp-quiet">
          <Tag tone="warning">{t('editor.capsuleFileDamaged')}</Tag>
          {t('editor.degradedNotice', { file: state.degraded })}
        </p>
      )}

      {editing?.kind === 'new-pill' && editing.target.kind === 'top' && (
        <PillForm
          draft={draft}
          editing={false}
          workspaces={workspaces}
          sessionId={sessionId}
          onDraft={setDraft}
          onSave={savePill}
          onCancel={() => { setEditing(undefined) }}
        />
      )}

      <div className="dfp-tree">
        {renamed.map(entryRow)}
        {/* 最后一个条目下面那一条缝：也算一个能落下的位置。 */}
        <div
          className="dfp-row-wrap"
          onDragOver={(event) => {
            if (dragged.current === undefined) return
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = 'move'
            setDrop({ kind: 'after', groupId: null, index: tree.length - 1 })
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            dropHere({ kind: 'after', groupId: null, index: tree.length - 1 })
          }}
        >
          {drop?.kind === 'after' && drop.groupId === null && drop.index === tree.length - 1
            && <div className="dfp-dropline" aria-hidden="true" />}
        </div>
      </div>

      {/* 整棵树的手势都在这一个小区块里说一次，不再挂在每一个分组下面。 */}      <div className="dfp-tips">
        <span className="dfp-tips-title">{t('Tips：')}</span>
        <ol className="dfp-tips-list">
          <li>{t('editor.tipsAdd')}</li>
          <li>{t('editor.tipsEdit')}</li>
          <li>{t('editor.tipsDrag')}</li>
        </ol>
      </div>

      <div className="dfp-cleanup">
        <Action onClick={askClearUsage}>{t('editor.clearUsage')}</Action>
        <Action onClick={askReset}>{t('editor.resetCapsules')}</Action>
      </div>

      <Dialog
        open={question?.kind === 'clear-usage'}
        onClose={() => { setQuestion(undefined) }}
        title={t('editor.clearUsage')}
        description={question?.kind === 'clear-usage'
          ? t('editor.clearUsageConfirm', { n: question.rows })
          : ''}
        footer={(
          <>
            <Action onClick={() => { setQuestion(undefined) }}>{t('form.cancel')}</Action>
            <Action
              variant="primary"
              onClick={() => {
                void store.clearUsage()
                setQuestion(undefined)
              }}
            >
              {t('editor.clear')}
            </Action>
          </>
        )}
      />

      <Dialog
        open={question?.kind === 'reset'}
        onClose={() => { setQuestion(undefined) }}
        title={t('editor.resetCapsules')}
        description={question?.kind === 'reset'
          ? t('editor.resetConfirm', { pills: question.pills, groups: question.groups })
          : ''}
        footer={(
          <>
            <Action onClick={() => { setQuestion(undefined) }}>{t('form.cancel')}</Action>
            <Action
              variant="primary"
              onClick={() => {
                void store.reset()
                setQuestion(undefined)
              }}
            >
              {t('editor.reset')}
            </Action>
          </>
        )}
      />

      <Dialog
        open={question?.kind === 'group'}
        onClose={() => { setQuestion(undefined) }}
        title={t('editor.deleteGroup')}
        description={question?.kind === 'group'
          ? t('editor.deleteGroupQuestion', { name: question.group.name, n: question.group.children.length })
          : ''}
        footer={(
          <>
            <Action onClick={() => { setQuestion(undefined) }}>{t('form.cancel')}</Action>
            <Action
              variant="ghost"
              onClick={() => { answerGroup('children') }}
            >
              {t('editor.deleteBoth')}
            </Action>
            <Action
              variant="primary"
              onClick={() => { answerGroup('promote') }}
            >
              {t('editor.liftThem')}
            </Action>
          </>
        )}
      />

    </div>
  )
}
