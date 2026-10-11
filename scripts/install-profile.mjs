/**
 * Install (or remove) this plugin as a bundle of one DSH profile.
 *
 * A bundle, not a `file://` row in the profile patch: the Plugins page manages
 * bundles, and its list is the only place the host renders its own on/off
 * switch on a card. Installing this way writes the two things the profile needs
 * for a local checkout —
 *
 * 1. `package.json`: a `link:` dependency plus the name in `dsh.profile.bundles`;
 * 2. `node_modules/<name>`: the symlink that resolves the bundle's module name.
 *
 * Both point at this checkout, so `npm run build` is the only thing that has to
 * run between an edit and the engine seeing it.
 *
 * Usage:
 *   node scripts/install-profile.mjs [--home <dir>] [--profile <name>]
 *                                    [--uninstall] [--dry-run]
 *
 * Defaults: home `$DSH_HOME` or `~/.dsh`, profile `web`. Every path is printed
 * before it is touched, and the edited manifest is backed up first. The profile
 * has to exist: run `dsh web` once for that home, or install through
 * `dsh plugin --profile web add link:<this checkout>` instead.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, lstatSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** Bundle package name; also the loader row id. */
const PACKAGE_NAME = 'dsh-fast-pills'

/** What every backup of the edited manifest ends in. */
const BACKUP_SUFFIX = `.bak-${PACKAGE_NAME}`

/**
 * Read one `--flag value` option.
 * @param name - flag name without dashes.
 * @param fallback - value when the flag is absent.
 * @returns the flag value.
 */
function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}

const home = resolve(option('home', process.env.DSH_HOME ?? join(homedir(), '.dsh')))
const profile = option('profile', 'web')
const uninstall = process.argv.includes('--uninstall')
const dryRun = process.argv.includes('--dry-run')

const profileDir = join(home, 'profiles', profile)
const manifestPath = join(profileDir, 'package.json')
const linkPath = join(profileDir, 'node_modules', PACKAGE_NAME)
const specifier = `link:${root}`

if (!existsSync(manifestPath)) {
  process.stderr.write(
    `install-profile: no profile at ${manifestPath}\n`
    + `Start the engine once for this home (DSH_HOME=${home} dsh web), or install with\n`
    + `dsh plugin --profile ${profile} add ${specifier}\n`,
  )
  process.exit(1)
}

const before = readFileSync(manifestPath, 'utf8')
const manifest = JSON.parse(before)
manifest.dependencies ??= {}
manifest.dsh ??= {}
manifest.dsh.profile ??= {}
manifest.dsh.profile.bundles ??= []

if (uninstall) {
  delete manifest.dependencies[PACKAGE_NAME]
  manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter(name => name !== PACKAGE_NAME)
} else {
  manifest.dependencies[PACKAGE_NAME] = specifier
  if (!manifest.dsh.profile.bundles.includes(PACKAGE_NAME)) manifest.dsh.profile.bundles.push(PACKAGE_NAME)
}

const after = `${JSON.stringify(manifest, undefined, 2)}\n`

if (after === before) process.stdout.write(`${manifestPath}: already ${uninstall ? 'absent' : 'installed'}\n`)
else if (dryRun) process.stdout.write(`would write ${manifestPath}\n`)
else {
  copyFileSync(manifestPath, `${manifestPath}${BACKUP_SUFFIX}`)
  writeFileSync(manifestPath, after)
  process.stdout.write(`wrote ${manifestPath} (backup: ${manifestPath}${BACKUP_SUFFIX})\n`)
}

const linked = lstatSync(linkPath, { throwIfNoEntry: false }) !== undefined
if (uninstall) {
  if (linked && !dryRun) unlinkSync(linkPath)
  if (linked) process.stdout.write(`${dryRun ? 'would remove' : 'removed'} ${linkPath}\n`)
} else if (dryRun) {
  process.stdout.write(`would link ${linkPath} -> ${root}\n`)
} else {
  mkdirSync(dirname(linkPath), { recursive: true })
  if (linked) unlinkSync(linkPath)
  symlinkSync(root, linkPath, 'dir')
  process.stdout.write(`linked ${linkPath} -> ${root}\n`)
}
