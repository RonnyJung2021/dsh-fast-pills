/**
 * 胶囊使用趋势统计: one ledger, one view, read either as a whole or one
 * capsule at a time.
 *
 * The tab is a column of numbered cards:
 * 区间与胶囊 picks the stretch and the capsule, 区间概览 rules the
 * figures into one strip, 每日柱状图 draws a day per column, 日历热力格 lays the
 * same days onto a calendar, and 每日明细 lists them one row each.
 *
 * A single day is the day's own ledger, not a one-bar chart: 天 hands the day
 * to the same drawing 「今日胶囊台账」uses, so a reader who has read today's
 * ledger already knows how to read any earlier day, and the two screens differ
 * only in which day they are on.
 *
 * The picker is a table: its head row holds every first-level capsule, then
 * each fold takes a line of its own with its name in the margin and its
 * capsules beside it, then whatever the tree has dropped but the ledger still
 * remembers. Every capsule is drawn in the row's own capsule shape and chosen
 * with a press; picking one narrows every card below to that capsule's presses,
 * so 单颗趋势 and 区间统计 are one reading with two scopes rather than two
 * sub-tabs.
 *
 * Whatever the scope, the bucket is the reader's own local calendar, and
 * a capsule the tree has dropped is still pickable, marked 已删除, so its
 * history stays readable after it is gone.
 */

import { useMemo, useState, type JSX, type ReactNode } from 'react'
import type { PillTree, UsageRecord } from '../../shared/types/index.ts'
import { Action, Choice, Hero, Section } from './controls.tsx'
import type { Text } from '../../shared/types/index.ts'
import { useText } from '../contexts/textContext.ts'
import { DayLedger } from './ledgerPanel.tsx'
import {
  countByDay, dayKeyOf, daysInRange, formatDay, formatDayShort, periodLabel,
  periodRange, stepPeriod, type Period,
} from '../../shared/utils/localTime.ts'
import type { PillStore } from '../services/pillStore.ts'
import { pickerRows, rowsOfDay, type PickerRow, type PillIdentity } from '../../shared/utils/usageStats.ts'
import { useStore } from '../hooks/useStore.ts'

/** Range choices and the sentences they are named by. */
const PERIODS = [
  { value: 'day', label: 'trend.day' },
  { value: 'week', label: 'trend.week' },
  { value: 'month', label: 'trend.month' },
] as const

/** The seven column heads of the calendar, Monday first, as the sentences they are. */
const WEEK_HEADS = ['trend.weekLetterMon', 'trend.weekLetterTue', 'trend.weekLetterWed', 'trend.weekLetterThu', 'trend.weekLetterFri', 'trend.weekLetterSat', 'trend.weekLetterSun'] as const

/** How one local day is spelled in the daily table, as the sentences they are. */
const WEEK_NAMES = ['trend.sun', 'trend.mon', 'trend.tue', 'trend.wed', 'trend.thu', 'trend.fri', 'trend.sat'] as const

/** One day of a chart: the day itself and what its bucket holds. */
interface DayValue {
  readonly day: Date
  readonly value: number
}

/**
 * One day of a chart, with its count.
 * @param days - the days to draw.
 * @param rows - the ledger rows to count.
 * @returns the days and their counts, in order.
 */
function dayValues(days: readonly Date[], rows: readonly UsageRecord[]): DayValue[] {
  const counts = countByDay(rows, days)
  return days.map((day, position) => ({ day, value: counts[position] ?? 0 }))
}

/**
 * How many of each day's presses were quick capsules.
 * @param days - the days to count.
 * @param rows - the ledger rows to count.
 * @param quickIds - the capsules that send themselves.
 * @returns one count per day, same order.
 */
function quickByDay(days: readonly Date[], rows: readonly UsageRecord[], quickIds: ReadonlySet<string>): number[] {
  return countByDay(rows.filter(row => quickIds.has(row.pillId)), days)
}

/**
 * Put a day's count on the five-step scale the cells are coloured by.
 * @param value - the day's count.
 * @param highest - the busiest day in the same range.
 * @returns the step, `1` to `5` for a day that holds anything, `0` for none.
 */
function levelOf(value: number, highest: number): number {
  return value === 0 ? 0 : Math.max(1, Math.ceil((value / highest) * 5))
}

/**
 * The label of one day in the daily table: 今天 for the current day, else the
 * month-day with its weekday, the way the reference ledger's 每日明细 reads.
 * @param day - the day to name.
 * @param today - the reader's own day.
 * @returns the label.
 */
function dayLabel(day: Date, today: string, t: Text): string {
  return dayKeyOf(day) === today
    ? t('trend.today')
    : `${formatDayShort(day)} ${t(WEEK_NAMES[day.getDay()] ?? '')}`
}

/**
 * Round a count up to a number a grid can be divided into equal steps by.
 * @param value - the busiest day's count.
 * @returns the smallest of 1, 2, 5, 10, 20, 25, 50 … that is at least `value`.
 */
function niceStep(value: number): number {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  return steps.find(step => step >= value) ?? Math.ceil(value / 1000) * 1000
}

/**
 * The value axis of a chart: the top of the scale and the whole numbers ticked
 * up it.
 *
 * The bars are drawn against `top` rather than against the busiest day, so the
 * gridlines land on round numbers and a bar's height can be read off them
 * instead of estimated.
 * @param highest - the busiest day's count.
 * @returns the top of the scale and its ticks, highest first.
 */
function valueScale(highest: number): { readonly top: number; readonly ticks: number[] } {
  const busiest = Math.max(1, highest)
  const step = niceStep(Math.ceil(busiest / 4))
  const top = Math.ceil(busiest / step) * step
  const ticks: number[] = []
  for (let value = top; value >= 0; value -= step) ticks.push(value)
  return { top, ticks }
}

/**
 * A bar per day, filling the whole range.
 *
 * A press the capsule sent itself is drawn in the line's amber stacked on top
 * of the rest, the way the day line stacks its two colours. The left gutter
 * carries the counts and the row under the bars carries the dates, each written
 * month-day so a column reads as a day rather than as a number.
 * @param props.values - the days and their counts.
 * @param props.quick - how many of each day's presses were quick capsules.
 * @returns the drawing.
 */
function BarChart({ values, quick }: {
  readonly values: readonly DayValue[]
  readonly quick: readonly number[]
}): JSX.Element {
  const t = useText()
  const [hover, setHover] = useState<number | null>(null)
  const { top, ticks } = valueScale(Math.max(...values.map(value => value.value), 0))
  const today = dayKeyOf(new Date())
  return (
    <div className="dfp-stats-chart">
      <div className="dfp-stats-gutter" aria-hidden="true">
        {ticks.map(value => (
          <span key={value} className="dfp-stats-gutter-tick" style={{ bottom: `${String((value / top) * 100)}%` }}>
            {value}
          </span>
        ))}
      </div>

      <div className="dfp-stats-bars" onMouseLeave={() => { setHover(null) }}>
        {ticks.map(value => (
          <span key={value} className="dfp-stats-gridline" style={{ bottom: `${String((value / top) * 100)}%` }} />
        ))}
        {values.map((value, position) => {
          const quickCount = quick[position] ?? 0
          const normal = value.value - quickCount
          return (
            <div
              key={dayKeyOf(value.day)}
              className="dfp-stats-bar"
              data-count={value.value}
              data-quick={quickCount}
              data-hover={hover === position ? 'true' : undefined}
              title={t('trend.dayCount', { day: formatDay(value.day), n: value.value })}
              onMouseEnter={() => { setHover(position) }}
            >
              <div
                className="dfp-stats-bar-fill dfp-stats-bar-quick"
                style={{ height: `${String(Math.round((quickCount / top) * 100))}%` }}
              />
              <div
                className="dfp-stats-bar-fill dfp-stats-bar-normal"
                style={{ height: `${String(Math.round((normal / top) * 100))}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="dfp-stats-axis">
        {values.map(value => (
          <span
            key={dayKeyOf(value.day)}
            className="dfp-stats-tick"
            data-today={dayKeyOf(value.day) === today ? 'true' : undefined}
          >
            {formatDayShort(value.day)}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The calendar heat grid: one ruled cell per day, deeper the more it holds.
 * Days before the range starts keep their weekday column and stay
 * blank, so a week and a month draw on the same calendar.
 * @param props.values - the days and their counts.
 * @param props.unit - what one cell counts, for the legend and the hover title.
 * @returns the calendar, its scale and its note.
 */
function HeatGrid({ values }: { readonly values: readonly DayValue[] }): JSX.Element {
  const t = useText()
  const highest = Math.max(1, ...values.map(value => value.value))
  const today = dayKeyOf(new Date())
  const first = values[0]?.day
  // A Monday-first week, the same week `startOfLocalWeek` cuts.
  const lead = first === undefined ? 0 : (first.getDay() + 6) % 7
  return (
    <div className="dfp-heat-block">
      <div className="dfp-stats-heat">
        <div className="dfp-stats-heat-head">
          {WEEK_HEADS.map((head, column) => <span key={column}>{t(head)}</span>)}
        </div>
        <div className="dfp-stats-heat-grid">
          {Array.from({ length: lead }, (_, position) => (
            <span key={`blank-${String(position)}`} className="dfp-stats-heat-cell" data-blank="true" />
          ))}
          {values.map(value => (
            <span
              key={dayKeyOf(value.day)}
              className="dfp-stats-heat-cell"
              data-level={levelOf(value.value, highest)}
              data-today={dayKeyOf(value.day) === today ? 'true' : undefined}
              title={t('trend.dayCount', { day: formatDay(value.day), n: value.value })}
            >
              <span className="dfp-stats-heat-day">{t('trend.dayShort', { day: value.day.getDate() })}</span>
              <span className="dfp-stats-heat-value">{t('ledger.pressesCount', { n: value.value })}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="dfp-stats-heat-legend">
        {t('trend.less')}
        <span className="dfp-stats-heat-scale">
          {[1, 2, 3, 4, 5].map(step => (
            <span key={step} className="dfp-stats-heat-cell" data-level={step} />
          ))}
        </span>
        {t('trend.more')}
        <span className="dfp-stats-heat-key">{t('trend.measurePressesPerDay')}</span>
      </p>
      <p className="dfp-quiet">
        {t('trend.heatNote')}
      </p>
    </div>
  )
}

/**
 * One indicator cell of a range overview.
 * @param props.label - what the number counts.
 * @param props.value - the number, already formatted.
 * @param props.tone - how the figure reads: up, down, or neither.
 * @returns the cell.
 */
function Metric({ label, value, tone }: {
  readonly label: string
  readonly value: string
  readonly tone?: 'up' | 'down'
}): JSX.Element {
  return (
    <div className="dfp-stats-metric" data-tone={tone}>
      <span className="dfp-stats-metric-label">{label}</span>
      <span className="dfp-stats-metric-value">{value}</span>
    </div>
  )
}

/**
 * The range reading of one 天 / 周 / 月 stretch: the two pickers that choose it,
 * then the reading itself — one day is the ledger's own drawing, a week or a
 * month is the overview, the daily bars, the calendar and the daily table, with
 * the stretch before it for the comparison.
 *
 * It is the one view the tab has: 全部 hands it the whole ledger, a capsule
 * hands it that capsule's rows, and nothing else changes.
 * @param props.rows - the rows in scope: the ledger, or one capsule's presses.
 * @param props.tree - the stored tree, which names the capsules a row refers to.
 * @param props.lines - the table's rows: one owner each, its capsules beside it.
 * @param props.picker - the capsule picker, drawn in the first card with the range controls.
 * @param props.loading - whether the ledger has not been read back yet.
 * @returns the range view.
 */
function RangeStats({ rows, tree, lines, picker, loading }: {
  readonly rows: readonly UsageRecord[]
  readonly tree: PillTree
  readonly lines: readonly PickerRow[]
  readonly picker: ReactNode
  readonly loading: boolean
}): JSX.Element {
  const t = useText()
  const [period, setPeriod] = useState<Period>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const pills = useMemo(() => lines.flatMap(line => line.pills), [lines])
  const names = useMemo(() => new Map(pills.map(pill => [pill.id, pill.name])), [pills])
  const quickIds = useMemo(() => new Set(pills.filter(pill => pill.quick).map(pill => pill.id)), [pills])

  const { start, end } = periodRange(anchor, period)
  const days = daysInRange(start, end)
  const values = dayValues(days, rows)
  const quick = quickByDay(days, rows, quickIds)
  const total = values.reduce((sum, value) => sum + value.value, 0)
  const active = values.filter(value => value.value > 0).length
  const busiest = values.reduce<DayValue>((best, value) => (value.value > best.value ? value : best), { day: start, value: 0 })
  const earlier = periodRange(stepPeriod(anchor, period, -1), period)
  const previous = rows.filter(row => {
    const at = Date.parse(row.at)
    return at >= earlier.start.getTime() && at <= earlier.end.getTime()
  }).length
  const delta = total - previous
  const canForward = stepPeriod(anchor, period, 1).getTime() <= new Date().getTime()
  const today = dayKeyOf(new Date())
  const range = periodLabel(anchor, period)
  const day = dayKeyOf(start)
  const single = days.length === 1 && dayKeyOf(days[0] ?? start) === day

  return (
    <>
      <Hero
        pattern="CAPSULES · TREND · DAY · WEEK · MONTH"
        eyebrow="TRENDS · DAY / WEEK / MONTH"
        title={t('panel.capsuleTrends')}
        description={t('trend.description')}
        figure={{
          key: t('trend.rangeTotal'),
          value: loading ? '—' : t('ledger.pressesCount', { n: total }),
          state: loading
            ? t('trend.usageLedgerAvailableYet')
            : t('trend.rangeUsedActiveDaysDays', { range, active, days: days.length }),
        }}
      />

      <div className="dfp-stack">
        <Section index="01" title={t('trend.rangeCapsule')}>
          {picker}
          {/* 看哪一段这一行不套格子：三个 Tab 自己占左边，翻页那一串跟在右边。 */}
          <div className="dfp-rangebar">
            <Choice<Period>
              value={period}
              options={PERIODS.map(option => ({ value: option.value, label: t(option.label) }))}
              onChange={setPeriod}
              label={t('trend.range')}
            />
            <div className="dfp-rangebar-pager">
              <Action onClick={() => { setAnchor(stepPeriod(anchor, period, -1)) }}>{t('trend.previous')}</Action>
              <span className="dfp-rangebar-label">{range}</span>
              <Action disabled={!canForward} onClick={() => { setAnchor(stepPeriod(anchor, period, 1)) }}>{t('trend.next')}</Action>
            </div>
            <Action variant="ghost" onClick={() => { setAnchor(new Date()) }}>{t('trend.backToToday')}</Action>
          </div>
        </Section>

        {loading
          ? <Section index="02" title={t('trend.overview')}><p className="dfp-quiet">{t('ledger.usageLedgerAvailableYet')}</p></Section>
          : single
            ? (
              /* 一天就是一天：交给台账那一支画笔，读者认得的形状。 */
              <DayLedger rows={rows} tree={tree} day={day} index="02" hero={false} />
            )
            : (
              <>
                <Section index="02" title={t('trend.overview')}>
                  <div className="dfp-stats-metrics">
                    <Metric label={t('trend.total')} value={t('ledger.pressesCount', { n: total })} />
                    <Metric label={t('trend.dailyAverage')} value={t('ledger.pressesCount', { n: (total / days.length).toFixed(1) })} />
                    <Metric
                      label={t('trend.vsPrevious')}
                      value={delta === 0
                        ? t('trend.level')
                        : t('trend.changeCount', { sign: delta > 0 ? '+' : '−', n: Math.abs(delta) })}
                      {...(delta === 0 ? {} : { tone: delta > 0 ? 'up' as const : 'down' as const })}
                    />
                    <Metric
                      label={t('trend.busiestDay')}
                      value={busiest.value === 0
                        ? '—'
                        : t('trend.dayCount', { day: formatDayShort(busiest.day), n: busiest.value })}
                    />
                    <Metric label={t('trend.daysWithUse')} value={t('trend.activeDaysDays', { active, days: days.length })} />
                  </div>
                </Section>

                <Section index="03" title={t('trend.dailyBars')}>
                  <BarChart values={values} quick={quick} />
                  <p className="dfp-quiet">
                    {t('trend.barsNote')}
                  </p>
                </Section>

                <Section index="04" title={t('trend.calendarHeatGrid')}>
                  <HeatGrid values={values} />
                </Section>

                <Section index="05" title={t('trend.dailyDetail')}>
                  <div className="dfp-stats-table-wrap">
                    <table className="dfp-stats-table">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">{t('trend.date')}</th>
                          <th scope="col">{t('trend.presses')}</th>
                          <th scope="col">{t('trend.mostUsed')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {values.map((value, position) => {
                          const day = rowsOfDay(rows, value.day)
                          const counts = new Map<string, number>()
                          for (const row of day) counts.set(row.pillId, (counts.get(row.pillId) ?? 0) + 1)
                          const busiestPill = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]
                          return (
                            <tr key={dayKeyOf(value.day)} data-dfp-day={dayKeyOf(value.day)}>
                              <td>{String(position + 1).padStart(2, '0')}</td>
                              <td className="dfp-stats-date">{dayLabel(value.day, today, t)}</td>
                              <td className="dfp-stats-count">{value.value}</td>
                              <td>{busiestPill === undefined ? '—' : `${names.get(busiestPill[0]) ?? busiestPill[0]} ×${String(busiestPill[1])}`}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </>
            )}
      </div>
    </>
  )
}

/**
 * The capsule picker: the row's own capsules, laid out by fold.
 *
 * The head row is the margin's own: its first column stays empty and its second
 * holds every first-level capsule, because those capsules have no owner to name
 * them. From the second row on the first column is a fold's name and the second
 * is what is inside it. The block scrolls once it is taller than a few lines,
 * so a long tree never pushes the figures off the screen.
 *
 * Which capsules are offered is not the row's directory filter — this is the
 * whole stored tree plus whatever the ledger still remembers, because the
 * question here is "what did I press", not "what can I press right now".
 * @param props.rows - the table's rows: one owner each, its capsules beside it.
 * @param props.selected - the chosen capsule id, or an empty string for 全部.
 * @param props.onPick - called with the newly picked capsule id.
 * @returns the picker.
 */
function CapsulePicker({ rows, selected, onPick }: {
  readonly rows: readonly PickerRow[]
  readonly selected: string
  readonly onPick: (next: string) => void
}): JSX.Element {
  const t = useText()
  /**
   * One capsule as a chip.
   *
   * The empty id is 全部: the same chip, meaning the whole ledger rather than
   * one capsule's rows.
   */
  const chip = (pill: PillIdentity | undefined): JSX.Element => {
    const id = pill?.id ?? ''
    return (
      <button
        key={id === '' ? 'all' : id}
        type="button"
        className="dfp-pill"
        {...(pill === undefined ? {} : { 'data-quick': pill.quick ? 'true' : 'false' })}
        aria-pressed={selected === id}
        onClick={() => { onPick(id) }}
      >
        {pill === undefined
          ? t('trend.all')
          : (pill.name === pill.id ? t('trend.nameDeleted', { name: pill.name }) : pill.name)}
      </button>
    )
  }
  return (
    <table className="dfp-picker-table" aria-label={t('trend.capsule')}>
      <tbody>
        {rows.map(row => (
          <tr className="dfp-picker-row" key={`${row.kind}-${row.id}`} data-picker-row={row.kind}>
            <th className="dfp-picker-who" scope="row">
              {row.kind === 'top' || row.kind === 'gone' ? null : row.label}
            </th>
            <td className="dfp-picker-what">
              {row.kind === 'top' && (
                <span className="dfp-picker-what-note">{t('trend.firstLevel')}</span>
              )}
              {row.kind === 'gone' && <span className="dfp-picker-what-note">{t('trend.deleted')}</span>}
              {row.kind === 'top' && chip(undefined)}
              {row.pills.map(pill => chip(pill))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * 胶囊使用趋势统计: one ledger, one view, scoped by the picker.
 * @param props.store - the page's tree and ledger source.
 * @returns the tab body.
 */
export function TrendPanel({ store }: { readonly store: PillStore }): JSX.Element {
  const [selected, setSelected] = useState('')
  const state = useStore(store)
  const rows = state.usage
  const lines = useMemo(() => pickerRows(state.tree, rows ?? []), [state.tree, rows])
  // 全部 reads the whole ledger; a capsule reads only its own rows, and every
  // figure below comes out of that one list.
  const mine = useMemo(
    () => (selected === '' ? rows : rows?.filter(row => row.pillId === selected)),
    [rows, selected],
  )

  return (
    <RangeStats
      rows={mine ?? []}
      tree={state.tree}
      lines={lines}
      loading={mine === undefined}
      picker={<CapsulePicker rows={lines} selected={selected} onPick={setSelected} />}
    />
  )
}
