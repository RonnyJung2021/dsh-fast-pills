/**
 * Where this plugin's data lives.
 *
 * The harness resolves its home as `$DSH_HOME`, then `~/.dsh`, and keeps every
 * user file below it; this plugin follows the same rule rather than inventing
 * one, so a workspace started with its own `DSH_HOME` keeps its capsules and
 * its ledger to itself.
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DATA_DIR } from '../../shared/constants/index.ts'

/** Environment variable that overrides the harness home. */
const DSH_HOME_ENV = 'DSH_HOME'

/** The harness's own credential store, relative to its home. */
export const CREDENTIALS_FILE = '.credentials.yaml'

/**
 * Resolve the harness home.
 * @param env - environment to read `DSH_HOME` from.
 * @returns the absolute home path; an empty or blank override falls back to `~/.dsh`.
 */
export function resolveDshHome(env: Record<string, string | undefined> = process.env): string {
  const configured = env[DSH_HOME_ENV]?.trim()
  return resolve(configured !== undefined && configured.length > 0 ? configured : join(homedir(), '.dsh'))
}

/**
 * Resolve this plugin's data directory.
 * @param env - environment to read `DSH_HOME` from.
 * @returns `<home>/storages/dsh-fast-pills`.
 */
export function dataDirectory(env: Record<string, string | undefined> = process.env): string {
  return join(resolveDshHome(env), DATA_DIR)
}
