/**
 * The engine seams the browser half touches.
 *
 * They are declared here instead of imported from the engine so the repository
 * type-checks on its own: the page hands `apply` the shell's own Cordis
 * context, and this is the slice of it the plugin reads — the slot registry,
 * the composer's public input actions, the two list hooks the row binds, and
 * the shapes of the session and workspace rows it reads them from.
 */

/** Identity of one session; opaque to this plugin. */
export type SessionId = string

/**
 * A selector hook over one observable source.
 *
 * The engine's own alias is generic over the snapshot type and `use<Name>` is
 * synthesized for every declared source, so the row's two seats are the same
 * shape with different snapshots.
 */
export type SnapshotSelectorHook<T> = <S>(select: (snapshot: T) => S) => S

/**
 * The composer's public action face.
 *
 * `captureInsertion` and `insertText` are the only way text reaches the draft
 * without taking focus; `submit` is the same enter path the send button uses.
 * The captured selection is opaque here — the row hands back the value it was
 * given, and the engine's own revision guard rejects a stale one.
 */
export interface InputActions {
  /** A revision-guarded copy of the current editor selection. */
  captureInsertion(): unknown
  /** Insert text at a captured selection; false when the draft moved or the editor locked. */
  insertText(text: string, span: unknown): boolean
  /** Submit the whole draft. */
  submit(): void
}

/** One workspace row, as far as the row reads it. */
export interface WorkspaceView {
  /** Canonical absolute directory of the workspace. */
  readonly path: string
  /** Sessions accounted to this workspace. */
  readonly sessionIds: readonly SessionId[]
}

/** The workspace list state the row reads. */
export interface WorkspaceSnapshot {
  readonly items: readonly WorkspaceView[]
}

/** The `usePills` selector hook a slot inject `hooks` compartment becomes. */
export type SnapshotHook<T> = <S>(select: (snapshot: T) => S) => S

/** One entry contributed to a list slot, with the registrant's own data face. */
export interface SlotEntry<I = unknown> {
  readonly name: string
  /**
   * Identity within a list slot; two entries with one id at one priority throw.
   * A keyed slot's entry carries {@link SlotEntry.key} instead.
   */
  readonly id?: string
  /**
   * Key of a keyed slot: the owner renders the entry for one subject by this
   * value instead of rendering every entry, which is how a bundle's
   * configuration reaches its own card.
   */
  readonly key?: string
  /** Ascending render order within the slot. */
  readonly order?: number
  /**
   * Build this entry's component values for one session.
   *
   * The renderer calls it with the current session identity for a session-scoped
   * slot, and caches the result per binding. The reserved `hooks` compartment
   * arrives at the component as `use<Name>` selector hooks; every other member
   * passes through verbatim.
   */
  readonly inject?: (sessionId: SessionId) => I
}

/** The slot registry service, narrowed to contributions. */
export interface SlotService {
  /** Wait for the slot's declaration, then contribute; the contribution leaves with the callback. */
  inject(slot: string, contribute: () => void): unknown
  register<I>(entry: SlotEntry<I>, component: unknown): unknown
}

/** The Cordis context slice the browser half needs. */
/**
 * The skill catalog's RPC face, as much of it as the capsule form reads.
 *
 * This is the wire shape, not the wrapped one a plugin that declares the
 * service in `inject` sees: the answer carries its own verdict, and a refused
 * call is a value rather than a throw.
 */
export interface SkillsRemote {
  list(input: { readonly sessionId?: string }, signal?: AbortSignal): Promise<{
    readonly ok: boolean
    readonly value?: { readonly skills?: readonly { readonly name?: unknown; readonly description?: unknown }[] }
  }>
}

export interface ClientContext {
  readonly slots: SlotService
  /**
   * Look a service up without requiring it.
   *
   * Reading `ctx.<name>` for a service this plugin did not inject throws, so
   * the optional ones — the skill catalog the capsule form suggests from — are
   * asked for by name instead: an absent catalog is no catalog, not a plugin
   * that refuses to load.
   * @param name - the service name, as `inject` would spell it.
   * @returns the service, or `undefined` when this deployment has none.
   */
  get(name: string): unknown
}
