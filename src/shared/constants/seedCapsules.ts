/**
 * The capsule tree written on first run, or put back by a reset.
 *
 * Three examples, and nothing of whoever built the plugin: the row is the
 * reader's own list of wordings, so what ships is only enough to show the
 * shapes at once — a capsule standing on its own at the first level, and a fold
 * holding the other two. They are initial data: a fold can be renamed,
 * emptied, reordered or deleted like any other, and a capsule can be edited
 * into anything.
 *
 * The names and bodies are message-table entries rather than literals, so a
 * reader who resets the tree in English gets English examples. The ids are not
 * translated: the usage ledger refers to capsules by id, and an id is not copy.
 */

import type { Locale } from '../enums/index.ts'
import { translate } from '../locales/index.ts'
import type { PillTree } from '../types/index.ts'

/**
 * The default tree, in display order, in one language.
 * @param locale - the language the examples are written in.
 * @returns a fresh tree; every call builds its own nodes.
 */
export function seedTreeFor(locale: Locale): PillTree {
  const word = (key: string): string => translate(locale, key)
  return [
    {
      kind: 'pill',
      id: 'continue',
      name: word('seed.continue.name'),
      body: word('seed.continue.body'),
      skill: null,
      quick: true,
      scope: [],
    },
    {
      kind: 'group',
      scope: [],
      id: 'common',
      name: word('seed.common.name'),
      children: [
        {
          kind: 'pill',
          id: 'explain',
          name: word('seed.explain.name'),
          body: word('seed.explain.body'),
          skill: null,
          quick: false,
          scope: [],
        },
        {
          kind: 'pill',
          id: 'summary',
          name: word('seed.summary.name'),
          body: word('seed.summary.body'),
          skill: null,
          quick: true,
          scope: [],
        },
      ],
    },
  ]
}

/** The tree this plugin's own language writes, which is what a reset starts from by default. */
export const SEED_TREE: PillTree = seedTreeFor('zh')
