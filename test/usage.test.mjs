/**
 * How the ledger's rows become "today".
 *
 * The day boundary is the reader's own local midnight and nothing else,
 * so the tests build their rows from local dates rather than from fixed UTC
 * instants — otherwise they would pass or fail with the machine's time zone.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { startOfLocalDay } from '../src/shared/utils/localTime.ts'
import { countToday, pickerRows } from '../src/shared/utils/usageStats.ts'

/** One ledger row at an instant. */
function row(at) {
  return { at: at.toISOString(), pillId: 'p', workspace: '', session: 's' }
}

/** An instant on the local day the given day offset names. */
function localDay(offset, hours = 12) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hours, 30)
}

describe('startOfLocalDay', () => {
  it('cuts the day at the local zero of the instant it is given', () => {
    const start = startOfLocalDay(new Date(2026, 9, 10, 23, 59, 59))
    assert.deepEqual(
      [start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()],
      [2026, 9, 10, 0, 0],
    )
  })
})

describe('countToday', () => {
  it('counts this local day and neither the day before nor the day after', () => {
    const rows = [row(localDay(0, 0)), row(localDay(0, 23)), row(localDay(-1)), row(localDay(1))]
    assert.equal(countToday(rows, new Date()), 2)
  })

  it('counts an empty ledger as nothing and skips an unreadable instant', () => {
    assert.equal(countToday([], new Date()), 0)
    assert.equal(countToday([{ at: 'nope', pillId: 'p', workspace: '', session: '' }], new Date()), 0)
  })
})

describe('pickerRows', () => {
  /** A capsule as the stored tree holds it. */
  const pill = (id, quick = false) => ({ kind: 'pill', id, name: id, body: '', skill: null, quick, scope: [] })

  /** A fold as the stored tree holds it. */
  const group = (id, children) => ({ kind: 'group', id, name: id, scope: [], children })

  /** A ledger row for one capsule. */
  const press = pillId => ({ at: new Date().toISOString(), pillId, workspace: '', session: '' })

  it('leads with one row holding the capsules that stand on their own, then a row per fold', () => {
    const rows = pickerRows([pill('a'), group('g1', [pill('b'), pill('c')]), pill('d')], [])
    assert.deepEqual(rows.map(row => [row.kind, row.label, row.pills.map(entry => entry.id)]), [
      ['top', '', ['a', 'd']],
      ['group', 'g1', ['b', 'c']],
    ])
  })

  it('offers a capsule inside a fold once, on that fold’s row', () => {
    const rows = pickerRows([group('g1', [pill('b')])], [])
    assert.deepEqual(rows.map(row => row.pills.map(entry => entry.id)), [[], ['b']])
  })

  it('gives a capsule standing on its own no row of its own', () => {
    const rows = pickerRows([pill('a'), pill('d')], [])
    assert.deepEqual(rows.map(row => row.kind), ['top'])
  })

  it('keeps a row for a capsule the tree no longer holds, busiest first', () => {
    const rows = pickerRows([pill('a')], [press('gone-1'), press('gone-2'), press('gone-2')])
    assert.deepEqual(rows.at(-1), {
      kind: 'gone',
      label: '',
      id: '',
      pills: [
        { id: 'gone-2', name: 'gone-2', quick: false },
        { id: 'gone-1', name: 'gone-1', quick: false },
      ],
    })
  })

  it('leaves out a fold with nothing in it, and always keeps the head row', () => {
    const rows = pickerRows([group('empty', [])], [])
    assert.deepEqual(rows.map(row => row.kind), ['top'])
  })

  it('keeps stored order inside a row rather than the busiest first', () => {
    const rows = pickerRows([group('g', [pill('c'), pill('b')])], [press('b'), press('b'), press('c')])
    assert.deepEqual(rows[1].pills.map(entry => entry.id), ['c', 'b'])
  })
})
