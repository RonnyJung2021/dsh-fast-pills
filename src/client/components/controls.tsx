/**
 * The panel's own controls, drawn in the paper-and-ink grammar the whole panel
 * uses: square corners, one-pixel rules, inverted hover, monospaced figures.
 *
 * They are the plugin's own elements rather than the product's primitives on
 * purpose. The product's controls carry rounded corners and a translucent fill
 * that belong to the composer, and a plugin loaded from `lib/client.js` has no
 * reliable way to outrank their stylesheet; drawing them here is what keeps one
 * panel one piece of paper wherever it is mounted. The product's `useModalLayer`
 * is still what gives a dialog its Escape key and Tab ownership — behaviour is
 * borrowed, appearance is not.
 */

import {
  useContext, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type JSX, type ReactNode, type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useModalLayer } from '@deepseek-ai/dsh-client-ui-primitives'
import { ThemeContext } from '../services/preferences.ts'

/** How heavy a button reads. */
export type ActionVariant = 'primary' | 'outline' | 'ghost'

/** One tab of {@link TabBar}. */
export interface TabItem<Value extends string> {
  readonly value: Value
  readonly label: string
  readonly id: string
  readonly panelId: string
}

/** One option of {@link Choice}. */
export interface ChoiceOption<Value extends string> {
  readonly value: Value
  readonly label: string
  readonly disabled?: boolean
}

/**
 * The banner one tab opens with: a drifting watermark strip, an eyebrow, the
 * tab's own name, one sentence saying what it is for, and the single figure the
 * tab leads with, ruled off in its own cell on the right.
 *
 * It is the page head the reference panel gives each of its screens, and it is
 * what makes a tab read as a place rather than as a list of cards.
 * @param props.pattern - the words that drift across the top strip.
 * @param props.eyebrow - the small monospaced line above the title.
 * @param props.title - the tab's name.
 * @param props.description - what this tab is for.
 * @param props.figure - the one figure this tab leads with.
 * @returns the banner.
 */
export function Hero({ pattern, eyebrow, title, description, figure }: {
  readonly pattern: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly figure: { readonly key: string; readonly value: string; readonly state: string }
}): JSX.Element {
  // Two identical halves: the strip drifts by exactly half its width, so the
  // loop joins without a seam.
  const half = `${pattern} · `.repeat(3)
  return (
    <section className="dfp-hero">
      <div className="dfp-hero-pattern" aria-hidden="true"><span>{half}{half}</span></div>
      <div className="dfp-hero-top">
        <div className="dfp-hero-lead">
          <p className="dfp-eyebrow">{eyebrow}</p>
          <h2 className="dfp-hero-title">{title}</h2>
          <p className="dfp-hero-desc">{description}</p>
        </div>
        <div className="dfp-hero-figure">
          <span className="dfp-figure-key">{figure.key}</span>
          <span className="dfp-figure-value">{figure.value}</span>
          <span className="dfp-figure-state">{figure.state}</span>
        </div>
      </div>
    </section>
  )
}

/**
 * One numbered section: the index in the margin, the title beside it, the body
 * below. Adjacent sections share an edge, so a screen reads as one column of
 * rules rather than a stack of boxes.
 * @param props.index - the two-digit marker in the margin, when the screen numbers its sections.
 * @param props.title - what this section is.
 * @param props.children - the body.
 * @returns the section.
 */
export function Section({ index, title, children }: {
  readonly index?: string
  readonly title: string
  readonly children: ReactNode
}): JSX.Element {
  return (
    <section className="dfp-section">
      <div className="dfp-section-head">
        {index !== undefined && <span className="dfp-section-index">{index}</span>}
        <h3 className="dfp-section-title">{title}</h3>
      </div>
      <div className="dfp-section-body">{children}</div>
    </section>
  )
}

/**
 * A button: square, hard-edged, inverting under the pointer.
 * @param props.variant - how heavy it reads; `outline` unless said otherwise.
 * @param props.children - the label.
 * @returns the button.
 */
export function Action({ variant = 'outline', ...rest }: {
  readonly variant?: ActionVariant
} & ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return <button type="button" className="dfp-btn" data-variant={variant} {...rest} />
}

/**
 * A single-line text field.
 * @param props - input attributes, passed through.
 * @returns the field.
 */
export function TextField(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return <input className="dfp-input" {...props} />
}

/**
 * A square checkbox beside its label; the whole block inverts when it is on.
 * @param props.checked - whether it is on.
 * @param props.label - the words beside the box.
 * @param props.onChange - called with the next value.
 * @returns the check.
 */
export function Check({ checked, label, onChange, disabled = false }: {
  readonly checked: boolean
  readonly label: string
  readonly onChange: (next: boolean) => void
  readonly disabled?: boolean
}): JSX.Element {
  return (
    <label className="dfp-check" data-on={checked ? 'true' : 'false'}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => { onChange(event.currentTarget.checked) }}
      />
      <span>{label}</span>
    </label>
  )
}

/**
 * A square switch: a track with a sliding cell, and the words beside it.
 *
 * The plugin card's one control. It is a switch rather than a checkbox because
 * what it turns on is a whole surface of the page, not one option among many.
 * @param props.checked - whether it is on.
 * @param props.label - the words beside the track.
 * @param props.note - one line under the label, or nothing.
 * @param props.onChange - called with the next value.
 * @returns the switch.
 */
export function Switch({ checked, label, note, onChange }: {
  readonly checked: boolean
  readonly label: string
  readonly note?: string
  readonly onChange: (next: boolean) => void
}): JSX.Element {
  return (
    <label className="dfp-switch" data-on={checked ? 'true' : 'false'}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={event => { onChange(event.currentTarget.checked) }}
      />
      <span className="dfp-switch-track" aria-hidden="true">
        <span className="dfp-switch-knob" />
      </span>
      <span className="dfp-switch-words">
        <span className="dfp-switch-label">{label}</span>
        {note !== undefined && <span className="dfp-field-note">{note}</span>}
      </span>
    </label>
  )
}

/** What a {@link Tag} reads as. */
export type TagTone = 'quiet' | 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'scope'

/**
 * A read-only mark: square, thin-edged, and coloured only by its tone.
 * @param props.tone - the palette it reads in.
 * @param props.children - the words.
 * @returns the tag.
 */
export function Tag({ tone = 'quiet', children }: {
  readonly tone?: TagTone
  readonly children: ReactNode
}): JSX.Element {
  return <span className="dfp-tag" data-tone={tone}>{children}</span>
}

/**
 * The panel's top-level tabs: equal columns, one shared border, the chosen one
 * inverted.
 * @param props.items - the tabs, in order.
 * @param props.value - the tab being shown.
 * @param props.onChange - called with the picked tab.
 * @param props.label - what the strip is, for assistive technology.
 * @param props.className - an extra class, for the callers' own hooks.
 * @returns the strip.
 */
export function TabBar<Value extends string>({ items, value, onChange, label, className }: {
  readonly items: readonly TabItem<Value>[]
  readonly value: Value
  readonly onChange: (next: Value) => void
  readonly label: string
  readonly className?: string
}): JSX.Element {
  return (
    <div className={className === undefined ? 'dfp-tabbar' : `dfp-tabbar ${className}`} role="tablist" aria-label={label}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          role="tab"
          id={item.id}
          aria-controls={item.panelId}
          aria-selected={item.value === value}
          className="dfp-tab"
          onClick={() => { onChange(item.value) }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * A row of mutually exclusive choices, bordered into one control.
 * @param props.value - the choice being shown.
 * @param props.options - the choices, in order.
 * @param props.onChange - called with the picked choice.
 * @param props.label - what the row picks, for assistive technology.
 * @returns the row.
 */
export function Choice<Value extends string>({ value, options, onChange, label }: {
  readonly value: Value
  readonly options: readonly ChoiceOption<Value>[]
  readonly onChange: (next: Value) => void
  readonly label: string
}): JSX.Element {
  return (
    <div className="dfp-choice" role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className="dfp-choice-item"
          aria-pressed={option.value === value}
          disabled={option.disabled === true}
          onClick={() => { onChange(option.value) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Everything one confirmation asks. */
export interface DialogProps {
  /** Whether it is up; a closed dialog renders nothing. */
  readonly open: boolean
  /** Called by the mask, the close control, or Escape. */
  readonly onClose: () => void
  /** What is being asked. */
  readonly title: string
  /** The consequences, in one sentence; left out when the body says them instead. */
  readonly description?: string
  /** A body of its own, for a dialog that holds a form rather than a question. */
  readonly children?: ReactNode
  /** The answer buttons, in reading order; left out when the body carries its own. */
  readonly footer?: ReactNode
}

/**
 * A confirmation over the panel.
 *
 * It is drawn inside the panel rather than beside it, so it inherits the paper
 * the panel is on; `useModalLayer` is what keeps Escape and Tab meaningful while
 * it is up, exactly as the drawer itself uses it. A dialog whose body is a form
 * passes that form as the children and no footer: the form asks its own
 * questions and carries its own buttons.
 * @param props - what is asked, and what the answers do.
 * @returns the dialog, or nothing while it is closed.
 */
export function Dialog({ open, onClose, title, description, children, footer }: DialogProps): JSX.Element | null {
  const dialog: RefObject<HTMLDivElement | null> = useRef(null)
  const theme = useContext(ThemeContext)
  useModalLayer(dialog, open, onClose)
  if (!open) return null
  return createPortal(
    <div className="dfp-dialog-root" data-dfp-theme={theme}>
      <div className="dfp-dialog-mask" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialog}
        className="dfp-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dfp-dialog-head">
          <h2 className="dfp-dialog-title">{title}</h2>
          <button type="button" className="dfp-dialog-close" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        {description !== undefined && <p className="dfp-dialog-note">{description}</p>}
        {children}
        {footer !== undefined && <div className="dfp-dialog-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
