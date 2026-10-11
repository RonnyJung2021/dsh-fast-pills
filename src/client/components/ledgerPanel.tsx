/**
 * 今日胶囊台账: the day's presses, drawn on a 24-hour line and listed below it.
 *
 * The shape is one a reader already knows: one strip of
 * figures ruled into cells, a flat day line with its hour labels and legend, a
 * line of words saying how the line and the list answer each other, then one
 * row per press with its number in the margin, its dot, and its workspace on
 * the right. Pointing at a block on the line or at the row below it inverts
 * both and names the press in a tip, so the two readings of the same day stay
 * one record.
 *
 * The drawing takes the day it reads as a prop, so the trends tab can put the
 * same ledger on any earlier day: 「今日胶囊台账」is this day being today, and
 * nothing else about the two screens differs.
 *
 * Days are cut by the reader's own local midnight, across every
 * workspace alike, and a capsule deleted since it was pressed is still
 * listed, named by its id.
 */

import { useMemo, useState, type JSX } from 'react'
import type { PillTree, UsageRecord } from '../../shared/types/index.ts'
import { Hero, Section } from './controls.tsx'
import type { Text } from '../../shared/types/index.ts'
import { useText } from '../contexts/textContext.ts'
import { dateOfDayKey, dayKeyOf, formatTime, startOfLocalDay } from '../../shared/utils/localTime.ts'
import type { PillStore } from '../services/pillStore.ts'
import { knownPills, rowsOfDay } from '../../shared/utils/usageStats.ts'
import { useStore } from '../hooks/useStore.ts'

/** The five labels under the day line, evenly spread across the 24 hours. */
const HOUR_TICKS = ['00:00', '06:00', '12:00', '18:00', '24:00'] as const

/** One press as the ledger draws it: the row, joined against the tree. */
interface Press {
  readonly pillId: string
  readonly name: string
  readonly quick: boolean
  readonly at: Date
  readonly workspace: string
}

/**
 * Where on the day line a press sits.
 * @param press - the press.
 * @returns its left edge in percent, kept off the very end so the block stays whole.
 */
function leftOf(press: Press): number {
  const minutes = press.at.getHours() * 60 + press.at.getMinutes() + press.at.getSeconds() / 60
  return Math.min(99.4, (minutes / 1440) * 100)
}

/**
 * One press as the hover tip words it.
 * @param press - the press.
 * @param t - the asker for the panel's language.
 * @returns the time, the capsule, and where it was pressed.
 */
function tipOf(press: Press, t: Text): string {
  const quick = press.quick ? t('ledger.quick') : ''
  const where = press.workspace === '' ? '' : ` · ${press.workspace}`
  return `${formatTime(press.at)} · ${press.name}${quick}${where}`
}

/**
 * One cell of the figures strip.
 * @param props.label - what the figure counts.
 * @param props.value - the figure, already formatted.
 * @param props.tone - which of the two series the figure wears, if either.
 * @returns the cell.
 */
function Stat({ label, value, tone }: {
  readonly label: string
  readonly value: string
  readonly tone?: 'quick' | 'plain'
}): JSX.Element {
  return (
    <span className="dfp-ledger-stat" data-tone={tone}>
      <span className="dfp-ledger-stat-label">{label}</span>
      <span className="dfp-ledger-stat-value">{value}</span>
    </span>
  )
}

/** What one day's reading is headed by. */
export interface DayLedgerProps {
  /** The rows in scope: the ledger, or one capsule's presses. */
  readonly rows: readonly UsageRecord[]
  /** The tree the rows are joined against for a name and a 快速 mark. */
  readonly tree: PillTree
  /** The local day to read, as its key. */
  readonly day: string
  /**
   * The caption on a section, when the caller numbers it. Left out by the
   * ledger tab, whose one card carries no index of its own.
   */
  readonly index?: string
  /**
   * Whether the drawing brings the banner, its figures and all.
   *
   * The ledger tab is this one drawing, so it opens with the banner. The trends
   * tab has a banner of its own and hands this day to it, so there it draws the
   * section alone.
   */
  readonly hero?: boolean
}

/**
 * One local day's presses, drawn as the ledger draws them.
 * @param props - the rows, the tree, and which day to read.
 * @returns the figures strip, the day line and the list.
 */
export function DayLedger({ rows, tree, day, index, hero = true }: DayLedgerProps): JSX.Element {
  const t = useText()
  const [hover, setHover] = useState<number | null>(null)
  const pills = useMemo(() => knownPills(tree, rows), [tree, rows])
  const today = dayKeyOf(startOfLocalDay())
  const isToday = day === today
  const presses = useMemo<Press[]>(() => {
    const byId = new Map(pills.map(pill => [pill.id, pill]))
    return rowsOfDay(rows, dateOfDayKey(day)).map(row => {
      const pill = byId.get(row.pillId)
      return {
        pillId: row.pillId,
        name: pill?.name ?? row.pillId,
        quick: pill?.quick ?? false,
        at: new Date(Date.parse(row.at)),
        workspace: row.workspace,
      }
    })
  }, [day, pills, rows])

  const quick = presses.filter(press => press.quick).length
  const last = presses.at(-1)
  const directories = new Set(presses.map(press => press.workspace).filter(name => name !== '')).size
  const hovered = hover === null ? undefined : presses[hover]

  return (
    <>
      {hero && (
        <Hero
          pattern="CAPSULES · LEDGER · 00:00 – 24:00"
          eyebrow={isToday ? 'LEDGER · TODAY' : `LEDGER · ${day}`}
          title={isToday ? t('ledger.capsuleLedger') : t('ledger.capsuleLedgerDay', { day })}
          description={isToday
            ? t('ledger.todayDescription')
            : t('ledger.dayDescription')}
          figure={{
            key: isToday ? t('ledger.todayPresses') : t('ledger.dayPresses'),
            value: t('ledger.pressesCount', { n: presses.length }),
            state: t('ledger.metricsLine', {
              quick,
              plain: presses.length - quick,
              directories,
            }),
          }}
        />
      )}

      <div className="dfp-stack">
        <Section {...(index === undefined ? {} : { index })} title={t(isToday ? 'ledger.capsuleLedger' : 'ledger.capsuleLedgerDay')}>
          <div className="dfp-ledger-stats">
            <Stat label={t(isToday ? 'ledger.presses' : 'ledger.dayPressesTotal')} value={t('ledger.pressesCount', { n: presses.length })} />
            {/* The two colours: the strip wears them so a figure can be read
                against the line below without going back to the legend. */}
            <Stat label={t('appearance.quickCapsule')} value={t('ledger.pressesCount', { n: quick })} tone="quick" />
            <Stat label={t('appearance.plainCapsule')} value={t('ledger.pressesCount', { n: presses.length - quick })} tone="plain" />
            <Stat label={t('ledger.latest')} value={last === undefined ? '—' : formatTime(last.at)} />
            <Stat label={t('ledger.workspaces')} value={t('ledger.workspacesCount', { n: directories })} />
          </div>

          <div className="dfp-ledger-timeline">
            {hovered !== undefined && (
              <div
                className="dfp-ledger-tip"
                style={{ left: `${String(Math.min(94, Math.max(6, leftOf(hovered))))}%` }}
              >
                {tipOf(hovered, t)}
              </div>
            )}
            <div
              className="dfp-ledger-track"
              role="img"
              aria-label={t('ledger.daySTimeline')}
              onMouseLeave={() => { setHover(null) }}
            >
              {presses.map((press, position) => (
                <span
                  key={`${press.pillId}-${String(position)}`}
                  className="dfp-ledger-seg"
                  data-quick={press.quick ? 'true' : 'false'}
                  data-hover={hover === position ? 'true' : undefined}
                  style={{ left: `${String(leftOf(press))}%` }}
                  onMouseEnter={() => { setHover(position) }}
                />
              ))}
            </div>
            <div className="dfp-ledger-ticks">
              {HOUR_TICKS.map(tick => <span key={tick}>{tick}</span>)}
            </div>
          </div>

          {/* Two colours and no more — a quick capsule is the one that sends
              itself, and skill versus plain words is not drawn here. */}
          <div className="dfp-stats-legend">
            <span className="dfp-stats-legend-item"><span className="dfp-stats-dot" data-quick="true" />{t('appearance.quickCapsule')}</span>
            <span className="dfp-stats-legend-item"><span className="dfp-stats-dot" data-quick="false" />{t('appearance.plainCapsule')}</span>
          </div>

          <p className="dfp-quiet">
            {t('ledger.timelineNote')}
          </p>

          <ul className="dfp-ledger-list" onMouseLeave={() => { setHover(null) }}>
            {presses.length === 0
              ? <li className="dfp-ledger-empty">{t(isToday ? 'ledger.emptyToday' : 'ledger.emptyThatDay')}</li>
              : presses.map((press, position) => (
                <li
                  key={`${press.pillId}-${String(position)}`}
                  className="dfp-ledger-row"
                  data-dfp-ledger-row={press.pillId}
                  data-hover={hover === position ? 'true' : undefined}
                  onMouseEnter={() => { setHover(position) }}
                >
                  <span className="dfp-ledger-index">{String(position + 1).padStart(2, '0')}</span>
                  <span className="dfp-ledger-main">
                    <span className="dfp-ledger-dot" data-quick={press.quick ? 'true' : 'false'} />
                    <span className="dfp-ledger-name">{`${formatTime(press.at)} · ${press.name}`}</span>
                  </span>
                  <span className="dfp-ledger-tail">{press.workspace === '' ? '—' : press.workspace}</span>
                </li>
              ))}
          </ul>
        </Section>
      </div>
    </>
  )
}

/**
 * The 今日胶囊台账 tab: the reader's own day, drawn by {@link DayLedger}.
 * @param props.store - the page's tree and ledger source.
 * @returns the tab body.
 */
export function LedgerPanel({ store }: { readonly store: PillStore }): JSX.Element {
  const t = useText()
  const state = useStore(store)
  if (state.usage === undefined) return <p className="dfp-quiet">{t('ledger.usageLedgerAvailableYet')}</p>
  return <DayLedger rows={state.usage} tree={state.tree} day={dayKeyOf(startOfLocalDay())} />
}
