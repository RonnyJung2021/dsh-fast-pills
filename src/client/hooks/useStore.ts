/**
 * One way for a panel to watch the page's tree source.
 *
 * The subscription is what starts the source's first read, so every panel that
 * shows the tree or the ledger subscribes through this hook rather than reading
 * the snapshot once. `useState` only holds the snapshot; putting the subscribe
 * call inside its initialiser would run it twice under StrictMode and drop the
 * unsubscribe function.
 */

import { useEffect, useState } from 'react'
import type { PillStore, PillStoreState } from '../services/pillStore.ts'

/**
 * Subscribe a component to the tree source.
 * @param store - the page's tree source.
 * @returns the latest state.
 */
export function useStore(store: PillStore): PillStoreState {
  const [state, setState] = useState(() => store.getSnapshot())
  useEffect(() => store.subscribe(() => { setState(store.getSnapshot()) }), [store])
  return state
}
