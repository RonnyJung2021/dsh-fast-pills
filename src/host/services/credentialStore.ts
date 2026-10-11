/**
 * The DeepSeek API key, kept by this plugin and nothing else.
 *
 * The key is this plugin's own: it lives in a mode-0600 file in the plugin's
 * data directory, so a checkout carries its own DeepSeek account and does not
 * read — or need — whatever credential store the surrounding harness happens to
 * have. Nothing else this plugin writes contains it, and the browser half can
 * only ask whether one is configured and offer to replace it.
 * Reading it back out is the host half's private business: the route never
 * returns a value.
 *
 * The file is a JSON object rather than a bare line so a later field can be
 * added without a migration, and it is written through a sibling temporary file
 * the way every other file here is.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { SECRET_FILE } from '../../shared/constants/index.ts'
import { CREDENTIALS_FILE } from '../utils/homeDirectory.ts'
import { HttpError } from '../utils/http.ts'

/** Presence and writability facts about the stored key, safe to show a page. */
export interface CredentialFacts {
  /** Whether a key would resolve right now. */
  readonly configured: boolean
  /** Where the key is kept; this build always answers `file`. */
  readonly source?: string
  /** Whether this plugin could replace it; a file it owns always can. */
  readonly writable: boolean
  /**
   * Whether the surrounding harness holds a DeepSeek key this plugin may copy.
   *
   * The page shows its 「用 DSH 的 key」 button on this fact alone; the value
   * itself never crosses the route.
   */
  readonly syncable: boolean
  /**
   * A short fingerprint of the stored key — the first eight hex digits of its
   * SHA-256 — or nothing when no key is stored.
   *
   * The page can never have the value, but it must still be able to say *which*
   * key is in place: without this, a reader who syncs twice has no way to tell
   * whether the second press changed anything. A hash prefix answers that and
   * gives away nothing usable.
   */
  readonly hint?: string
}

/** The key holder the routes talk to. */
export interface CredentialHandler {
  /** @returns the current key, or `undefined` when none is stored. */
  resolve(): Promise<string | undefined>
  /** @returns presence and writability, never the value. */
  facts(): Promise<CredentialFacts>
  /**
   * Store a key, replacing whatever was there.
   * @param value - the non-blank key.
   * @throws {Error} when the key is blank.
   */
  store(value: string): Promise<void>
  /**
   * Copy the harness's own DeepSeek key into this plugin's store.
   *
   * The value **never leaves the host**: it is read from the harness's
   * credentials and written straight to this plugin's file, and the answer is
   * the facts alone. That is the whole point of the call — the page may replace
   * the key but can never read one, so no route anywhere returns the value.
   * The reader still decides: the button, and the confirmation in front
   * of it, are theirs to press.
   * @returns the facts as they stand after the copy.
   * @throws {HttpError} 409 when the harness holds no DeepSeek key.
   */
  sync(): Promise<CredentialFacts>
  /**
   * Drop the stored key, so nothing would resolve until one is stored again.
   * @returns facts after the removal; clearing a key that was never there is
   *   the same answer, not a failure.
   */
  clear(): Promise<CredentialFacts>
}

/** Largest key the store accepts; a DeepSeek key is far shorter than this. */
const MAX_KEY_CHARS = 512

/**
 * Read the key out of one parsed file.
 * @param value - the parsed JSON, or anything else.
 * @returns the key, or an empty string when the file holds none.
 */
function keyOf(value: unknown): string {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const key = record['apiKey']
  if (typeof key !== 'string') return ''
  const trimmed = key.trim()
  return trimmed.length > MAX_KEY_CHARS ? '' : trimmed
}

/**
 * Read the harness's own DeepSeek key out of its credential store.
 *
 * The harness keeps named secrets in `.credentials.yaml` under `refs`, one
 * `NAME: value` per line, so the value is read without a YAML parser: this is
 * one plugin reading one known key out of a file it does not own, and a parser
 * would be a dependency for a line that is always shaped the same way. A value
 * that is quoted, escaped or written as a nested block is not recognised — and
 * not guessed at either.
 * @param home - the harness home (`$DSH_HOME`).
 * @returns the key, or `undefined` when the file holds none.
 */
export async function harnessDeepSeekKey(home: string): Promise<string | undefined> {
  let text: string
  try {
    text = await readFile(join(home, CREDENTIALS_FILE), 'utf8')
  } catch {
    return undefined
  }
  const hit = /^\s*DEEPSEEK_API_KEY\s*:\s*(\S+)\s*$/mu.exec(text)
  const value = hit?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
  if (value.length === 0 || value.length > MAX_KEY_CHARS) return undefined
  return value
}

/**
 * Build the key holder over one directory.
 * @param dir - the plugin's data directory.
 * @param home - the harness home, where its own credentials live.
 * @returns the holder the routes use.
 */
export function createCredentialHandler(dir: string, home: string): CredentialHandler {
  const path = join(dir, SECRET_FILE)
  let queue: Promise<unknown> = Promise.resolve()

  /** Run one operation after the previous one settled, whatever its outcome. */
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation)
    queue = next.catch(() => undefined)
    return next
  }

  /**
   * Read the file as it stands.
   *
   * An absent, unreadable or unparseable file is simply "no key configured":
   * the panel then says so and no request leaves the machine, which is
   * the same answer a file this plugin has never written deserves.
   * @returns the key, or an empty string.
   */
  async function current(): Promise<string> {
    try {
      return keyOf(JSON.parse(await readFile(path, 'utf8')))
    } catch {
      return ''
    }
  }

  /** Write one key through a sibling temporary file, mode 0600. */
  async function put(value: string): Promise<void> {
    const trimmed = value.trim()
    if (trimmed.length === 0) throw new Error('key 不能为空')
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${String(process.pid)}.tmp`
    await writeFile(temporary, `${JSON.stringify({ apiKey: trimmed }, undefined, 2)}\n`, { mode: 0o600 })
    await rename(temporary, path)
  }

  /**
   * The fingerprint shown for one key.
   * @param key - the stored key.
   * @returns the first eight hex digits of its SHA-256, or nothing for no key.
   */
  function fingerprintOf(key: string): string | undefined {
    if (key.length === 0) return undefined
    return createHash('sha256').update(key).digest('hex').slice(0, 8)
  }

  /** The facts as they stand: presence, writability, what could be copied, and which key it is. */
  async function thisFacts(): Promise<CredentialFacts> {
    const key = await current()
    return {
      configured: key.length > 0,
      source: 'file',
      writable: true,
      syncable: (await harnessDeepSeekKey(home)) !== undefined,
      ...(fingerprintOf(key) === undefined ? {} : { hint: fingerprintOf(key) as string }),
    }
  }

  return {
    resolve: async () => {
      const key = await current()
      return key.length === 0 ? undefined : key
    },

    facts: thisFacts,

    clear: () => serialize(async () => {
      // The file goes away rather than being written empty: "no key" is the
      // absence this store reads, and a blank value would be one more state to
      // explain.
      await rm(path, { force: true })
      return thisFacts()
    }),

    sync: () => serialize(async () => {
      const key = await harnessDeepSeekKey(home)
      // 两种失败要分开说：宿主那边没有这把钥匙（409，页面按「没得同步」显示），与
      // 钥匙拿到了但**写不进去**（异常照旧抛，路由映射成 5xx）。以前两者都进 409，
      // 页面会把「盘写不进去」误报成「DSH 里没有 key」。
      if (key === undefined) {
        throw new HttpError(409, 'no-harness-credential', 'DSH 自身的凭据中没有 DEEPSEEK_API_KEY')
      }
      await put(key)
      return thisFacts()
    }),

    store: value => serialize(() => put(value)),
  }
}
