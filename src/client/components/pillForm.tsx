/**
 * The one form that creates and edits a capsule.
 *
 * A capsule's features are picked here and nowhere else. The
 * form owns no tree: it renders the draft it is handed and answers the draft
 * after every keystroke, so the caller decides when the change reaches the page.
 *
 * Two things are worth saying about how it is laid out. The body is one box,
 * not a switch plus a box: what a capsule writes is `/skill` followed by words
 * or words alone, and which one it is falls out of what the reader typed — the
 * same reading the composer itself uses. And the scope is a list of paths: this
 * project's own workspaces, plus the page's directory chooser for any other
 * directory, so what is stored is the path the row matches against.
 */

import { useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import type { Pill } from '../../shared/types/index.ts'
import { Action, Check, Tag } from './controls.tsx'
import type { Text } from '../../shared/types/index.ts'
import { useSkills, type SkillName } from '../services/skillCatalog.ts'
import { useText } from '../contexts/textContext.ts'

/** A capsule as the form holds it: the scope list is already split. */
export interface PillDraft {
  readonly name: string
  readonly body: string
  /** Skill name, or `null` for a capsule that writes plain words. */
  readonly skill: string | null
  readonly quick: boolean
  /** Directory paths this capsule is limited to; empty means everywhere. */
  readonly scope: readonly string[]
}

/** The draft a brand-new capsule starts from. */
export const EMPTY_DRAFT: PillDraft = { name: '', body: '', skill: null, quick: false, scope: [] }

/** What the workspace list hands the form, as much of it as it reads. */
export interface WorkspaceChoice {
  /** The directory's own name, shown as the chip's label and as the path's tooltip. */
  readonly name: string
  /** The absolute directory; this is what a scope entry stores. */
  readonly path: string
}


/**
 * Read a capsule into the form's shape.
 * @param pill - the stored capsule.
 * @returns the draft the form edits.
 */
export function draftOf(pill: Pill): PillDraft {
  return {
    name: pill.name,
    body: pill.body,
    skill: pill.skill,
    quick: pill.quick,
    scope: [...pill.scope],
  }
}

/**
 * Turn the form's draft into a capsule.
 * @param draft - what the form holds.
 * @param id - the capsule's identity; kept for an edit, minted for a new one.
 * @returns the capsule to store.
 */
export function pillOf(draft: PillDraft, id: string, t: Text): Pill {
  const skill = draft.skill === null || draft.skill.trim().length === 0 ? null : draft.skill.trim()
  return {
    kind: 'pill',
    id,
    name: draft.name.trim().length === 0 ? t('form.untitled') : draft.name.trim(),
    body: draft.body,
    skill,
    quick: draft.quick,
    scope: draft.scope.map(entry => entry.trim()).filter(entry => entry.length > 0),
  }
}

/**
 * The body as one string, which is how it is first put into the box.
 * @param draft - the capsule as the form holds it.
 * @returns `/skill words`, or the words alone.
 */
export function bodyTextOf(draft: PillDraft): string {
  return draft.skill === null ? draft.body : `/${draft.skill} ${draft.body}`
}

/** The `/token` that opens a body, when it opens one. */
const SKILL_TOKEN = /^\/([A-Za-z0-9_-]+)(?:[ \t]|$)/u

/**
 * Read one box's text back into the two halves a capsule stores.
 *
 * A leading `/name` is a skill token — that is what the composer's own `/`
 * menu writes, and what a capsule's press has to reproduce. Anything else is
 * plain words. The split is only ever made at the very start, so a slash
 * further into the text is just a slash.
 * @param text - what the box holds.
 * @returns the skill (or `null`) and the words that follow it.
 */
export function draftBodyOf(text: string): { readonly skill: string | null; readonly body: string } {
  const hit = SKILL_TOKEN.exec(text)
  if (hit === null) return { skill: null, body: text }
  return { skill: hit[1] ?? null, body: text.slice(hit[0].length) }
}

/** One editable capsule. */
export interface PillFormProps {
  /** The draft being edited; the form is fully controlled. */
  readonly draft: PillDraft
  /** Whether the capsule already exists, which only changes the button labels. */
  readonly editing: boolean
  /** The workspaces this project knows, offered as the scope entries. */
  readonly workspaces: readonly WorkspaceChoice[]
  /** The session whose skill catalog the body box suggests from. */
  readonly sessionId: string
  /** Called with the whole next draft after every edit. */
  readonly onDraft: (draft: PillDraft) => void
  /** Called when the draft should become a capsule. */
  readonly onSave: () => void
  /** Called when the form should close without saving. */
  readonly onCancel: () => void
  /**
   * Whether the scope row is offered.
   *
   * The recognition card turns it off: a suggestion is meant to be something you
   * reach for anywhere, and the model's guessed paths were more noise than help.
   * The draft keeps whatever scope it came with either way.
   */
  readonly showScope?: boolean
}

/**
 * Render the capsule form.
 * @param props - the draft, and what to do with it.
 * @returns the form.
 */
export function PillForm({
  draft, editing, workspaces, sessionId, onDraft, onSave, onCancel, showScope = true,
}: PillFormProps): JSX.Element {
  const t = useText()
  const skills = useSkills(sessionId)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  /** How much of the `/word` at the caret the reader has typed, or `null` for none. */
  const [slash, setSlash] = useState<string | null>(null)
  /**
   * The body box's own text.
   *
   * It is held here rather than read back off the draft: a capsule stores a
   * skill and its words apart, and joining them again on every keystroke would
   * put a space after the skill name the moment `/d` was typed — the reader
   * would then be typing into the arguments of a skill called `d`. The box
   * keeps exactly what was typed; the draft keeps the reading of it. The form
   * is keyed by the capsule it is editing, so opening another one starts over.
   */
  const [bodyText, setBodyText] = useState(() => bodyTextOf(draft))

  /** The catalog narrowed to what has been typed after the slash, capped. */
  const suggestions = useMemo(() => {
    if (slash === null) return []
    const needle = slash.toLowerCase()
    return skills
      .filter(skill => skill.name.toLowerCase().includes(needle))
      .slice(0, 6)
  }, [skills, slash])

  /**
   * Follow the caret: a `/` at the start of a word opens the list.
   * @param text - the box's text after the keystroke.
   * @param caret - where the caret sits in it.
   */
  const trackSlash = (text: string, caret: number): void => {
    const before = text.slice(0, caret)
    const hit = /(?:^|\s)\/([A-Za-z0-9_-]*)$/u.exec(before)
    setSlash(hit === null ? null : (hit[1] ?? ''))
  }

  /**
   * Put one skill into the box, replacing the `/word` being typed.
   * @param skill - the skill that was picked.
   */
  const takeSkill = (skill: SkillName): void => {
    const caret = bodyRef.current?.selectionStart ?? bodyText.length
    const before = bodyText.slice(0, caret)
    const hit = /(?:^|\s)\/([A-Za-z0-9_-]*)$/u.exec(before)
    if (hit === null) return
    const start = caret - hit[0].length + (hit[0].startsWith('/') ? 0 : 1)
    const next = `${bodyText.slice(0, start)}/${skill.name} ${bodyText.slice(caret)}`
    setSlash(null)
    setBodyText(next)
    onDraft({ ...draft, ...draftBodyOf(next) })
    // The caret belongs after the name and its space, ready for the arguments.
    const at = start + skill.name.length + 2
    void Promise.resolve().then(() => {
      const box = bodyRef.current
      if (box === null) return
      box.focus()
      box.setSelectionRange(at, at)
    })
  }

  /** Enter takes the highlighted suggestion; Escape puts the list away. */
  const onBodyKey = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (slash === null) return
    if (event.key === 'Escape') {
      event.preventDefault()
      // The list is what Escape closes here; the drawer is not.
      event.stopPropagation()
      setSlash(null)
      return
    }
    if (event.key === 'Enter' && suggestions[0] !== undefined) {
      event.preventDefault()
      takeSkill(suggestions[0])
    }
  }

  return (
    <div className="dfp-form dfp-form-compact">
      {/* 三行问完一颗胶囊：第一行名字 + 快速自发送，第二行写入什么（正文要能一眼看几行），
          第三行限定工作区。标签各占左边一栏，和设置页其他字段同一套排法。 */}
      <div className="dfp-form-row dfp-form-first">
        <span className="dfp-field-label">{t('form.name')}</span>
        <input
          className="dfp-input dfp-input-name"
          value={draft.name}
          placeholder={t('form.nameCapsule')}
          onChange={event => { onDraft({ ...draft, name: event.currentTarget.value }) }}
        />
        <Check
          checked={draft.quick}
          label={t('form.quickSend')}
          onChange={next => { onDraft({ ...draft, quick: next }) }}
        />
      </div>

      <div className="dfp-form-row">
        <span className="dfp-field-label">{t('form.writes')}</span>
        <span className="dfp-slash-box">
          <textarea
            ref={bodyRef}
            className="dfp-body-input"
            rows={4}
            value={bodyText}
            placeholder={t('form.bodyNote')}
            onChange={(event) => {
              const text = event.currentTarget.value
              setBodyText(text)
              onDraft({ ...draft, ...draftBodyOf(text) })
              trackSlash(text, event.currentTarget.selectionStart ?? text.length)
            }}
            onKeyUp={(event) => {
              trackSlash(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
            }}
            onKeyDown={onBodyKey}
            onBlur={() => { setSlash(null) }}
          />
          {slash !== null && suggestions.length > 0 && (
            <ul className="dfp-slash-list" role="listbox" aria-label={t('form.pickSkill')}>
              {suggestions.map(skill => (
                <li key={skill.name}>
                  <button
                    type="button"
                    className="dfp-slash-item"
                    role="option"
                    aria-selected={false}
                    onMouseDown={event => { event.preventDefault() }}
                    onClick={() => { takeSkill(skill) }}
                  >
                    <span className="dfp-slash-name">{`/${skill.name}`}</span>
                    <span className="dfp-slash-note">{skill.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draft.skill !== null && (
            <span className="dfp-field-note">{t('form.skillNote', { name: draft.skill })}</span>
          )}
        </span>
      </div>

      {showScope && (
        <div className="dfp-form-row">
          <span className="dfp-field-label">{t('form.limitWorkspaces')}</span>
          <span className="dfp-form-scope-body">
            <ScopeChips
              scope={draft.scope}
              workspaces={workspaces}
              onChange={(next) => { onDraft({ ...draft, scope: next }) }}
            />
            <span className="dfp-field-note">
              {t('form.scopeNote')}
            </span>
          </span>
        </div>
      )}

      <div className="dfp-form-actions">
        <Action variant="primary" onClick={onSave}>{t(editing ? 'form.save' : 'form.create')}</Action>
        <Action onClick={onCancel}>{t('form.cancel')}</Action>
        <span className="dfp-field-note">{t('form.saveNote')}</span>
      </div>
    </div>
  )
}

/**
 * The scope chooser: the workspaces this project has, one chip each.
 *
 * It is the same control the capsule form and the group form both use, because
 * a fold's scope and a capsule's own are the same kind of list and are read the
 * same way by the row. Only the workspaces the page already knows are offered:
 * limiting a capsule is something the reader opts into, so it is a pick from a
 * list rather than a path anyone has to spell — and a chip that is picked is
 * picked again to drop it, which is what leaves the list empty and the capsule
 * everywhere.
 * @param props.scope - the workspace paths picked now.
 * @param props.workspaces - the workspaces the page knows.
 * @param props.onChange - called with the whole next list.
 * @returns the chips.
 */
export function ScopeChips({ scope, workspaces, onChange }: {
  readonly scope: readonly string[]
  readonly workspaces: readonly WorkspaceChoice[]
  readonly onChange: (next: readonly string[]) => void
}): JSX.Element {
  const toggle = (entry: string): void => {
    onChange(scope.includes(entry) ? scope.filter(item => item !== entry) : [...scope, entry])
  }
  return (
    <div className="dfp-scope">
      {workspaces.map(workspace => (
        <button
          key={workspace.path}
          type="button"
          className="dfp-scope-chip"
          data-entry={workspace.name}
          aria-pressed={scope.includes(workspace.path)}
          title={workspace.path}
          onClick={() => { toggle(workspace.path) }}
        >
          {workspace.name}
        </button>
      ))}
    </div>
  )
}
