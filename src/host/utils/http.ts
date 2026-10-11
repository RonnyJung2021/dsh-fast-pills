/**
 * The little HTTP vocabulary the routes share.
 *
 * The engine's web server hands a route the raw Node request and response, so
 * reading a JSON body and answering with one are this plugin's own business.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** A failure that is the caller's, answered as-is instead of reaching the engine's guard. */
export class HttpError extends Error {
  /**
   * @param status - the response status for this failure.
   * @param code - the machine-readable code in the body.
   * @param message - what was wrong with the request.
   */
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Answer with JSON.
 * @param res - the response to own.
 * @param status - status code.
 * @param payload - value to serialize.
 */
export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/**
 * Answer 405 with the methods this path does accept.
 * @param res - the response to own.
 * @param methods - the accepted methods, in table order.
 */
export function sendMethodNotAllowed(res: ServerResponse, methods: readonly string[]): void {
  res.statusCode = 405
  res.setHeader('allow', methods.join(', '))
  res.end()
}

/**
 * Read a request body as JSON.
 * @param req - the incoming request.
 * @param maxBytes - largest body to accept.
 * @returns the parsed body.
 * @throws {HttpError} 413 when the body is larger, 400 when it is missing or not JSON.
 */
export async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  let oversized = false
  // An oversized body is drained rather than abandoned: the request has to
  // finish before the 413 can be written back, or the client sees a reset.
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    size += buffer.length
    if (size > maxBytes) {
      oversized = true
      chunks.length = 0
      continue
    }
    chunks.push(buffer)
  }
  if (oversized) throw new HttpError(413, 'payload-too-large', `the body is larger than ${String(maxBytes)} bytes`)
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim().length === 0) throw new HttpError(400, 'invalid-json', 'the request needs a JSON body')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'invalid-json', 'the request body is not JSON')
  }
}
