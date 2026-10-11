/**
 * The one signal the transcript hangs off.
 *
 * The Session controller publishes a local echo the instant a prompt is
 * submitted — `pendingSubmissions`, one entry per send, carrying the text
 * exactly as it goes out. Watching that list for a request id the row has not
 * seen yet is the closest thing to a "user message submitted" event the page
 * exposes to a slot entry, and it fires before the composer clears the draft.
 *
 * The echo retires as soon as the durable message lands, so what was already
 * seen is remembered per session: a row that remounts must not record its
 * prompts a second time. A session change resets that memory, because no echo
 * can precede its own session's mount.
 *
 * Masking happens here as well as in the host half: the text leaves the browser
 * already masked, and the host masks again before it writes.
 */

import { useEffect, useRef } from 'react'
import type { Locale } from '../../shared/enums/index.ts'
import { maskLabels } from '../../shared/locales/index.ts'
import { mask } from '../../shared/utils/mask.ts'
import type { PillStore } from './pillStore.ts'

/** One session echo, as far as this plugin reads it. */
export interface PendingSubmission {
  readonly requestId: string
  readonly text: string
}

/** The Session seat, narrowed to the one column the transcript reads. */
export type UseSession = <S>(select: (snapshot: { readonly pendingSubmissions: readonly PendingSubmission[] }) => S) => S

/** Request ids already recorded, per session, for the page's lifetime. */
const recorded = new Map<string, Set<string>>()

/**
 * Record every prompt this session submits.
 * @param useSession - the Session seat the dock entry receives.
 * @param pills - the page's one store, which owns the write.
 * @param sessionId - the session this row belongs to.
 * @param workspace - the directory the session sits in, for the transcript line.
 * @param locale - the language whose markers the recorded line is masked with.
 */
export function useCapture(
  useSession: UseSession,
  pills: PillStore,
  sessionId: string,
  workspace: string,
  locale: Locale,
): void {
  const pending = useSession(snapshot => snapshot.pendingSubmissions)
  // The effect re-runs on every publication; the set is what makes it once.
  const seen = useRef<Set<string>>(recorded.get(sessionId) ?? new Set())
  useEffect(() => {
    const seenHere = seen.current
    for (const echo of pending) {
      if (echo.requestId.length === 0 || seenHere.has(echo.requestId)) continue
      seenHere.add(echo.requestId)
      // Only user input is recorded; an empty send has nothing to keep.
      if (echo.text.trim().length === 0) continue
      pills.notePrompt({ sessionId, text: mask(echo.text, maskLabels(locale)), workspace })
    }
    recorded.set(sessionId, seenHere)
  }, [pending, pills, sessionId, workspace])
}
