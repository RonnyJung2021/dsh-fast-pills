/**
 * The plugin card: the one switch, and how the row is used.
 *
 * This is the section 侧栏「插件」draws for this bundle, between the bundle's
 * description and its rows. It deliberately carries none of the panel's own
 * settings: those belong to the drawer's 设置 tab, which has the room for them
 * and is where a reader goes to change them. What it carries is the one switch
 * that has to live here — with the row hidden the drawer has no entry left, so
 * this page is where the row comes back — and a short guide whose pictures do
 * most of the explaining: the row and the drawer are easier shown than
 * described. A step whose picture has not been taken yet simply carries none.
 */

import type { JSX } from 'react'
import { PANEL_ATTRIBUTE, ROUTE_PREFIX } from '../../shared/constants/index.ts'
import { Switch } from './controls.tsx'
import { textFor } from '../../shared/locales/index.ts'
import { ThemeContext, usePrefs } from '../services/preferences.ts'
import type { PillStore } from '../services/pillStore.ts'
import { TextContext } from '../contexts/textContext.ts'

/** One step of the guide: what it says, and the picture above it. */
interface Step {
  /** File name of the picture, served from this plugin's own asset route; none when it is not shot yet. */
  readonly shot?: string
  /** One line naming the entry. */
  readonly title: string
  /** One or two sentences about it. */
  readonly body: string
}

/** The three entries, in the order a reader meets them. */
const STEPS: readonly Step[] = [
  {
    shot: 'row',
    title: 'card.stepRowTitle',
    body: 'card.stepRowBody',
  },
  {
    shot: 'drawer',
    title: 'card.stepDrawerTitle',
    body: 'card.stepDrawerBody',
  },
  {
    title: 'card.stepRecognizeTitle',
    body: 'card.stepRecognizeBody',
  },
]

/**
 * The plugin card.
 * @param props.store - the page's tree source and settings route.
 * @returns the card's section.
 */
export function FastPillsCard({ store }: { readonly store: PillStore }): JSX.Element {
  const prefs = usePrefs(store)
  const t = textFor(prefs.locale)
  return (
    <TextContext.Provider value={t}>
      <ThemeContext.Provider value={prefs.resolved}>
        <section className="dfp-card" data-dfp-theme={prefs.resolved} {...{ [PANEL_ATTRIBUTE]: 'card' }}>
          <Switch
            checked={prefs.showRow}
            label={t('card.switchLabel')}
            note={t('card.switchNote')}
            onChange={(next) => { prefs.set({ showRow: next }) }}
          />

          <div className="dfp-guide">
            <p className="dfp-guide-lead">
              {t('card.guideLead')}
            </p>
            {STEPS.map(step => (
              <figure className="dfp-guide-step" key={step.title}>
                {step.shot !== undefined && (
                  <img
                    className="dfp-guide-shot"
                    src={`${ROUTE_PREFIX}/asset/${step.shot}.png`}
                    alt={t(step.title)}
                  />
                )}
                <figcaption className="dfp-guide-words">
                  <span className="dfp-guide-title">{t(step.title)}</span>
                  <span className="dfp-guide-body">{t(step.body)}</span>
                </figcaption>
              </figure>
            ))}
            <p className="dfp-field-note">
              {t('card.settingsNote')}
            </p>
          </div>
        </section>
      </ThemeContext.Provider>
    </TextContext.Provider>
  )
}
