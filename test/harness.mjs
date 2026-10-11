/**
 * The little engine stand-in the tests drive the plugin through.
 *
 * `apply` only ever registers a prefix route, so a fake context that records
 * the registration gives a test the real handler; a fake request and response
 * then give it a real HTTP exchange without a socket.
 */

import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Load the built host half with this plugin's data directory pointed at a scratch home.
 * @returns the plugin module, the registered route, and the scratch home.
 */
export async function loadPlugin() {
  const home = await mkdtemp(join(tmpdir(), 'dsh-fast-pills-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  // The build has to exist: `npm test` builds first through its pretest step.
  const module = await import('../lib/index.js')
  const routes = []
  const context = {
    effect: execute => {
      execute()
      return () => {}
    },
    webServer: {
      register: route => {
        routes.push(route)
        return () => {}
      },
    },
  }
  module.apply(context)
  if (previous === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previous
  const route = routes[0]
  if (route === undefined) throw new Error('the host half registered no route')
  return {
    module,
    route,
    dataDir: join(home, 'storages', 'dsh-fast-pills'),
    async cleanup() {
      await rm(home, { recursive: true, force: true })
    },
  }
}

/**
 * Start a real HTTP server on the plugin's route.
 * @param route - the registered host route.
 * @returns the base URL and a stop function.
 */
export async function serveRoute(route) {
  const server = createServer((req, res) => {
    void route.handler(req, res).catch(() => {
      res.statusCode = 500
      res.end()
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('the test server did not bind a port')
  return {
    url: `http://127.0.0.1:${String(address.port)}/dsh-fast-pills`,
    async stop() {
      await new Promise(resolve => server.close(resolve))
    },
  }
}

/**
 * Make one request against a running test server.
 * @param base - the base URL from {@link serveRoute}.
 * @param path - path below the prefix, e.g. `/pills`.
 * @param options - method and JSON body.
 * @returns the status, the headers, and the parsed JSON body.
 */
export async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    ...(options.body === undefined ? {} : { body: options.body }),
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    text,
    body: text.length === 0 ? undefined : JSON.parse(text),
  }
}
