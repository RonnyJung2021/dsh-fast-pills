/**
 * The React seat for the panel's language.
 *
 * The dictionary itself lives in `client/i18n.ts`, which holds no framework at
 * all: a component asks for the current asker through here, and anything that
 * is not a component — a pure rule, a test — takes one as an argument instead.
 */

import { createContext, useContext } from 'react'
import { textFor } from '../../shared/locales/index.ts'
import type { Text } from '../../shared/types/index.ts'

/** The asker the panel hands down; without a provider everything stays Chinese. */
export const TextContext = createContext<Text>(textFor('zh'))

/**
 * Ask for one sentence in the language the panel is set to.
 * @returns the asker.
 */
export function useText(): Text {
  return useContext(TextContext)
}
