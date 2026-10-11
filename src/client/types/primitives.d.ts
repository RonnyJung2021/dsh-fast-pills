/**
 * The product primitives this plugin reads from the page.
 *
 * The plugin does not depend on the engine's packages: the page hands the
 * bundle its own module table, so what is imported here is resolved at run time
 * by the shell (see `build.mjs`). This file is only the slice of that table the
 * plugin touches, declared locally so `npm run typecheck` stays offline — the
 * same habit the engine seams in `context.ts` follow.
 */

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, RefObject } from 'react'

  /** Render a button in one of the product's visual families. */
  export function Button(props: {
    variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
    size?: 'md' | 'sm'
    icon?: ReactNode
    className?: string
  } & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode

  /** Render a text input; input attributes pass through. */
  export function Input(props: { icon?: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>): ReactNode

  /** Render a controlled toggle switch. */
  export function Switch(props: {
    checked: boolean
    onChange: (next: boolean) => void
    label: string
    disabled?: boolean
    title?: string
    className?: string
  }): ReactNode

  /** Render a read-only tag. */
  export function Tag(props: {
    tone?: 'outline' | 'solid' | 'neutral' | 'quiet' | 'success' | 'info' | 'warning' | 'danger'
    className?: string
    children?: ReactNode
  }): ReactNode

  /** One tab of {@link SegmentedTabs}. */
  export interface SegmentedTab<Value extends string> {
    value: Value
    label: ReactNode
    id: string
    panelId: string
  }

  /** Render equal-width, controlled tabs; the panels stay with the caller. */
  export function SegmentedTabs<Value extends string>(props: {
    items: readonly [SegmentedTab<Value>, ...SegmentedTab<Value>[]]
    value: Value
    onChange: (value: Value) => void
    label: string
    className?: string
  }): ReactNode

  /** One segment of {@link SegmentedControl}. */
  export interface SegmentedControlOption<Value extends string> {
    value: Value
    label: string
    disabled?: boolean
    title?: string
  }

  /** Render a segmented control. */
  export function SegmentedControl<Value extends string>(props: {
    id: string
    value: Value
    options: readonly SegmentedControlOption<Value>[]
    onChange: (next: Value) => void
    label: string
    disabled?: boolean
    className?: string
  }): ReactNode

  /** Render a centered dialog over a page mask; Escape and the mask close it. */
  export function Modal(props: {
    open: boolean
    onClose: () => void
    title: string
    closeLabel: string
    description?: string
    children?: ReactNode
    footer?: ReactNode
    className?: string
    contentClassName?: string
  }): ReactNode

  /** Give one mounted dialog Escape and Tab ownership, and restore focus when it leaves. */
  export function useModalLayer(dialog: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void
}
