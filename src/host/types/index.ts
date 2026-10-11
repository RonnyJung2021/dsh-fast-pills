/**
 * The engine seams the host half touches.
 *
 * They are declared here instead of imported from the engine so the repository
 * type-checks on its own: the loader hands `apply` the engine's own Cordis
 * context, and this is the slice of it the plugin reads.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** One route the host half registers on the engine's web server. */
export interface HostRoute {
  readonly kind: 'prefix'
  /** Absolute pathname, no trailing slash. */
  readonly path: string
  readonly handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** The web server service, narrowed to registration. */
export interface WebServerService {
  register(route: HostRoute): () => void
}

/** The Cordis context slice the host half needs. */
export interface HostContext {
  readonly webServer: WebServerService
  /** Run a contribution and hand back its disposer when the plugin unloads. */
  effect(execute: () => () => void, label?: string): unknown
}
