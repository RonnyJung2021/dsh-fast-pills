/**
 * The one stylesheet, and the promise it keeps across a hot reload.
 *
 * The sheet lives in the bundle as text, so a browser half that is re-applied
 * without a page reload has to be able to replace what the first load installed.
 * Otherwise every class added since renders unstyled — which is a whole panel
 * looking broken, with no error anywhere to explain it.
 *
 * `installStyles` is browser-only, so the test stands in a minimal document and
 * a stand-in for the element class it checks against.
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { installStyles, ROW_CSS, STYLE_ELEMENT_ID } from '../src/client/constants/styles.ts'

/** Stand-in for the class `installStyles` narrows a found element against. */
class FakeStyleElement {
  constructor() {
    this.id = ''
    this.textContent = ''
  }
}

before(() => { globalThis.HTMLStyleElement = FakeStyleElement })
after(() => { delete globalThis.HTMLStyleElement })

/** A page that already holds one sheet, as one that has loaded before would. */
function documentHolding(element) {
  return {
    getElementById: () => element,
    createElement: () => { throw new Error('the second apply must not mint a second sheet') },
    head: { append: () => { throw new Error('the second apply must not append a second sheet') } },
  }
}

/** A page with nothing on it yet. */
function emptyDocument(element) {
  const appended = []
  return {
    getElementById: () => null,
    createElement: () => element,
    head: { append: node => { appended.push(node) } },
    appended,
  }
}

describe('installStyles', () => {
  it('marks and appends one element on a page that has none', () => {
    const element = new FakeStyleElement()
    const document = emptyDocument(element)
    assert.equal(installStyles(document), element)
    assert.equal(element.id, STYLE_ELEMENT_ID)
    assert.equal(element.textContent, ROW_CSS)
    assert.deepEqual(document.appended, [element])
  })

  it('rewrites the sheet an earlier load left behind instead of keeping it', () => {
    const stale = new FakeStyleElement()
    stale.textContent = 'what the first load installed'
    assert.equal(installStyles(documentHolding(stale)), stale)
    assert.equal(stale.textContent, ROW_CSS)
  })
})
