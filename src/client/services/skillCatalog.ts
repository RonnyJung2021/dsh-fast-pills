/**
 * The engine's skill catalog, as far as the capsule form needs it.
 *
 * The body box is one free field: what a capsule writes is either plain words
 * or `/skill` followed by them, and which of the two is decided by what the
 * reader typed rather than by a switch they have to set first. To offer the
 * names while they type, the form needs the catalog the page already knows —
 * `remote.skills`, the same list the composer's own `/` menu reads.
 *
 * The source is installed once, from the plugin's `apply`, and is optional: a
 * deployment without the skill service, or a mount with no session to ask
 * about, simply offers no names. The box still takes `/name` typed by hand.
 */

import { useEffect, useState } from 'react'

/** One skill, as much of it as the picker shows. */
export interface SkillName {
  /** Kebab-case identifier, the token a capsule writes after the slash. */
  readonly name: string
  /** One line of routing copy, shown beside the name. */
  readonly description: string
}

/** How the browser half asks for the catalog. */
export type SkillSource = (sessionId: string) => Promise<readonly SkillName[]>

/** The installed source, or nothing when this deployment has no skill service. */
let source: SkillSource | undefined

/**
 * Install the catalog source.
 * @param next - the reader, or `undefined` to take the catalog away.
 */
export function setSkillSource(next: SkillSource | undefined): void {
  source = next
}

/** The catalog, cached per session so the picker opens without a wait. */
const catalogs = new Map<string, readonly SkillName[]>()

/**
 * Read one session's skills.
 * @param sessionId - the session to ask about; an empty string answers nothing.
 * @returns the catalog, or nothing when there is no source.
 */
export async function listSkills(sessionId: string): Promise<readonly SkillName[]> {
  if (source === undefined || sessionId.length === 0) return []
  const hit = catalogs.get(sessionId)
  if (hit !== undefined) return hit
  try {
    const skills = await source(sessionId)
    // An empty answer is not remembered: the service that supplies it may not
    // have been up yet, and a catalog that arrives later is still the answer.
    if (skills.length > 0) catalogs.set(sessionId, skills)
    return skills
  } catch {
    // A catalog that cannot be read is no catalog: the box still takes a name
    // typed by hand, and nothing else about the form depends on this.
    return []
  }
}

/**
 * The skill catalog for one session, read once.
 * @param sessionId - the session to ask about.
 * @returns the catalog, empty until it arrives and empty when there is none.
 */
export function useSkills(sessionId: string): readonly SkillName[] {
  const [skills, setSkills] = useState<readonly SkillName[]>(() => catalogs.get(sessionId) ?? [])
  useEffect(() => {
    let live = true
    setSkills(catalogs.get(sessionId) ?? [])
    void listSkills(sessionId).then((next) => { if (live) setSkills(next) })
    return () => { live = false }
  }, [sessionId])
  return skills
}
