/**
 * The statistics' clock: local days, the Monday-first week, the calendar month
 * and the day buckets every chart in 胶囊使用统计 is drawn from.
 *
 * Every case is built from local dates, so the suite passes on any machine's
 * time zone rather than only on the one it was written on.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  countByDay, dayKeyOf, daysInRange, formatDay, formatTime, periodLabel, periodRange,
  startOfLocalWeek, stepLocalMonth, stepPeriod,
} from '../src/shared/utils/localTime.ts'

/** One ledger row at an instant. */
function row(at) {
  return { at: at.toISOString(), pillId: 'p', workspace: '', session: 's' }
}

describe('dayKeyOf', () => {
  it('keys a day by the reader’s own local date', () => {
    assert.equal(dayKeyOf(new Date(2026, 0, 5, 0, 0)), '2026-01-05')
    assert.equal(dayKeyOf(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31')
  })
})

describe('startOfLocalWeek', () => {
  it('starts a week on Monday, whatever day it is asked about', () => {
    // 2026-10-05 is a Monday; the Sunday before it belongs to the week before.
    assert.equal(dayKeyOf(startOfLocalWeek(new Date(2026, 9, 5))), '2026-10-05')
    assert.equal(dayKeyOf(startOfLocalWeek(new Date(2026, 9, 11))), '2026-10-05')
    assert.equal(dayKeyOf(startOfLocalWeek(new Date(2026, 9, 12))), '2026-10-12')
    assert.equal(startOfLocalWeek(new Date(2026, 9, 8, 13, 30)).getHours(), 0)
  })
})

describe('stepLocalMonth', () => {
  it('does not roll the end of a month into the month after next', () => {
    assert.equal(dayKeyOf(stepLocalMonth(new Date(2026, 0, 31), 1)), '2026-02-28')
    assert.equal(dayKeyOf(stepLocalMonth(new Date(2026, 2, 31), -1)), '2026-02-28')
    assert.equal(dayKeyOf(stepLocalMonth(new Date(2027, 0, 31), 1)), '2027-02-28')
  })
})

describe('periodRange', () => {
  it('cuts a day at the local zeros around it', () => {
    const { start, end } = periodRange(new Date(2026, 9, 10, 13, 0), 'day')
    assert.deepEqual([start.getHours(), start.getMinutes()], [0, 0])
    assert.equal(dayKeyOf(start), '2026-10-10')
    assert.equal(dayKeyOf(end), '2026-10-10')
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000 - 1)
  })

  it('cuts a week from Monday to Sunday', () => {
    const { start, end } = periodRange(new Date(2026, 9, 10), 'week')
    assert.equal(dayKeyOf(start), '2026-10-05')
    assert.equal(dayKeyOf(end), '2026-10-11')
  })

  it('cuts a month at its own first and last day', () => {
    const october = periodRange(new Date(2026, 9, 10), 'month')
    assert.equal(dayKeyOf(october.start), '2026-10-01')
    assert.equal(dayKeyOf(october.end), '2026-10-31')
    const february = periodRange(new Date(2026, 1, 10), 'month')
    assert.equal(dayKeyOf(february.end), '2026-02-28')
    const leap = periodRange(new Date(2028, 1, 10), 'month')
    assert.equal(dayKeyOf(leap.end), '2028-02-29')
  })
})

describe('daysInRange', () => {
  it('gives one entry per local day, ends included', () => {
    const days = daysInRange(new Date(2026, 9, 5), new Date(2026, 9, 11))
    assert.deepEqual(days.map(dayKeyOf), [
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
      '2026-10-09', '2026-10-10', '2026-10-11',
    ])
  })

  it('gives one entry for a range inside a single day', () => {
    assert.equal(daysInRange(new Date(2026, 9, 10, 1), new Date(2026, 9, 10, 23)).length, 1)
  })
})

describe('stepPeriod', () => {
  it('moves a day, a whole week and a calendar month', () => {
    assert.equal(dayKeyOf(stepPeriod(new Date(2026, 9, 10), 'day', -1)), '2026-10-09')
    assert.equal(dayKeyOf(stepPeriod(new Date(2026, 9, 10), 'week', 1)), '2026-10-17')
    assert.equal(dayKeyOf(stepPeriod(new Date(2026, 11, 31), 'month', 1)), '2027-01-31')
  })
})

describe('countByDay', () => {
  it('counts each row into its own local day and skips an unreadable instant', () => {
    const days = daysInRange(new Date(2026, 9, 9), new Date(2026, 9, 11))
    const rows = [
      row(new Date(2026, 9, 9, 0, 0)),
      row(new Date(2026, 9, 10, 9, 30)),
      row(new Date(2026, 9, 10, 23, 59)),
      row(new Date(2026, 9, 12, 9, 0)),
      { at: 'nope', pillId: 'p', workspace: '', session: 's' },
    ]
    assert.deepEqual(countByDay(rows, days), [1, 2, 0])
  })

  it('answers with one zero per asked day when the ledger is empty', () => {
    const days = daysInRange(new Date(2026, 9, 9), new Date(2026, 9, 11))
    assert.deepEqual(countByDay([], days), [0, 0, 0])
  })
})

describe('labels', () => {
  it('names a day, a time, a week and a month as the panel draws them', () => {
    assert.equal(formatDay(new Date(2026, 9, 5)), '2026-10-05')
    assert.equal(formatTime(new Date(2026, 9, 5, 9, 4)), '09:04')
    assert.equal(periodLabel(new Date(2026, 9, 5), 'day'), '2026-10-05')
    assert.equal(periodLabel(new Date(2026, 9, 7), 'week'), '10-05 – 10-11')
    assert.equal(periodLabel(new Date(2026, 11, 30), 'week'), '12-28 – 2027-01-03')
    assert.equal(periodLabel(new Date(2026, 9, 7), 'month'), '2026-10')
  })
})
