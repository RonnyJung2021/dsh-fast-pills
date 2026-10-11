/**
 * The panel the drawer mounts: three horizontal tabs over their bodies.
 *
 * The row's round entry shows this panel inside a drawer; the plugin
 * card in 侧栏「插件」used to mount the same component in place and no longer
 * does — that page carries the row's switch and a short guide instead, and the
 * settings all live here. The first tab is the day's own ledger, the
 * second is the settings page, and the third is 胶囊使用趋势统计.
 *
 * 设置 is a page with a rail: the banner spans the page, and under it the left
 * column picks one of three parts — the capsule tree, the general preferences,
 * or the recognition page — so nothing here is ever a long scroll.
 */

import { useMemo, useState, type JSX } from 'react'
import { PANEL_ATTRIBUTE } from '../../shared/constants/index.ts'
import { AppearanceSection } from './appearanceSection.tsx'
import { Choice, Hero, Section, TabBar } from './controls.tsx'
import { textFor } from '../../shared/locales/index.ts'
import { TextContext, useText } from '../contexts/textContext.ts'
import { LedgerPanel } from './ledgerPanel.tsx'
import { PillsEditor } from './pillsEditor.tsx'
import type { WorkspaceChoice } from './pillForm.tsx'
import {
  colorStyle, LOCALE_LABELS, THEME_LABELS, ThemeContext, usePrefs, type Prefs, type PrefsPatch,
} from '../services/preferences.ts'
import { LOCALES, type Locale } from '../../shared/enums/index.ts'
import { RecognizePanel } from './recognizePanel.tsx'
import { TrendPanel } from './trendPanel.tsx'
import type { PillStore } from '../services/pillStore.ts'
import { countEntries } from '../../shared/utils/pillTree.ts'
import { useStore } from '../hooks/useStore.ts'

/** The three tabs, in the order the panel shows them. */
export type PanelTab = 'ledger' | 'settings' | 'trend'

/**
 * Tab values, ids and the sentence each is named by, in one place so the ids
 * never drift and the labels follow the reader's language.
 */
const TABS = [
  { value: 'ledger', label: 'ledger.capsuleLedger', id: 'dfp-tab-ledger', panelId: 'dfp-panel-ledger' },
  { value: 'trend', label: 'panel.capsuleTrends', id: 'dfp-tab-trend', panelId: 'dfp-panel-trend' },
  { value: 'settings', label: 'panel.settings', id: 'dfp-tab-settings', panelId: 'dfp-panel-settings' },
] as const

/** The parts of the settings page, in the order the rail offers them. */
const SECTIONS = [
  { value: 'capsules', index: '01', title: 'panel.capsules' },
  { value: 'appearance', index: '02', title: 'appearance.themeAppearance' },
  { value: 'general', index: '03', title: 'panel.general' },
  { value: 'ai', index: '04', title: '⚡Super Pillls' },
] as const

/** Which part of the settings page the rail is showing. */
type SettingsSection = (typeof SECTIONS)[number]['value']

/** The waits a quick capsule may be given, in milliseconds. */
const DELAYS = [500, 1000, 2000, 3000] as const

/** The languages the 通用 card offers, in reading order. */
const LOCALE_OPTIONS = LOCALES.map(value => ({ value, label: LOCALE_LABELS[value] }))

/** The settings page's prefs face: the values, and the way to change them. */
type PrefsEditor = Prefs & { readonly set: (patch: PrefsPatch) => void }

/**
 * The settings page: one banner over a rail and the part the rail picked.
 * @param props.store - the page's tree source.
 * @param props.prefs - the panel's settings, as the 通用 card edits them.
 * @param props.section - which part is showing.
 * @param props.onSection - called with the part the rail picked.
 * @returns the settings page.
 */
function SettingsPage({ store, prefs, section, onSection, workspaces, sessionId }: {
  readonly store: PillStore
  readonly prefs: PrefsEditor
  readonly section: SettingsSection
  readonly onSection: (next: SettingsSection) => void
  readonly workspaces: readonly WorkspaceChoice[]
  readonly sessionId: string
}): JSX.Element {
  const t = useText()
  const state = useStore(store)
  const totals = useMemo(() => countEntries(state.tree), [state.tree])
  const shown = SECTIONS.find(part => part.value === section)
  return (
    <>
      <Hero
        pattern="CAPSULES · SETTINGS · TREE · GENERAL"
        eyebrow="SETTINGS · GENERAL / CAPSULES / AI"
        title={t('panel.settings')}
        description={t('panel.settingsDescription')}
        figure={{
          key: t('panel.totalCapsules'),
          value: t('panel.n', { n: totals.pills }),
          state: t('panel.nGroupsThemeTheme', {
            n: totals.groups,
            theme: t(THEME_LABELS[prefs.theme]),
          }),
        }}
      />

      <div className="dfp-split">
        <nav className="dfp-side" aria-label={t('panel.settingsSections')}>
          {SECTIONS.map(part => (
            <button
              key={part.value}
              type="button"
              className="dfp-side-item"
              aria-current={section === part.value ? 'true' : undefined}
              onClick={() => { onSection(part.value) }}
            >
              {t(part.title)}
            </button>
          ))}
        </nav>

        <div className="dfp-side-body">
          {/* The recognition page brings its own numbered cards, so it is not
              wrapped in one more. */}
          {section === 'ai'
            ? <RecognizePanel store={store} workspaces={workspaces} />
            : (
              <div className="dfp-stack">
                {/* 外观那一页自带编号卡，所以不再套一层；其余几节由这里统一给标题。 */}
                {section === 'appearance'
                  ? <AppearanceSection prefs={prefs} set={prefs.set} />
                  : (
                <Section index={shown?.index ?? '01'} title={t(shown?.title ?? 'panel.capsules')}>
                  {section === 'capsules' && (
                    <PillsEditor store={store} workspaces={workspaces} sessionId={sessionId} />
                  )}

                  {section === 'general' && (
                    <div className="dfp-fields">
                      <div className="dfp-field">
                        <span className="dfp-field-label">{t('panel.language')}</span>
                        <div className="dfp-field-body">
                          <Choice<Locale>
                            value={prefs.locale}
                            options={LOCALE_OPTIONS}
                            onChange={(locale) => { prefs.set({ locale }) }}
                            label={t('panel.language')}
                          />
                          <span className="dfp-field-note">
                            {t('panel.localeNote')}
                          </span>
                        </div>
                      </div>

                      <div className="dfp-field">
                        <span className="dfp-field-label">{t('panel.quickCapsuleDelay')}</span>
                        <div className="dfp-field-body">
                          <Choice<string>
                            value={String(prefs.quickDelayMs)}
                            options={DELAYS.map(ms => ({ value: String(ms), label: t('panel.nS', { n: ms / 1000 }) }))}
                            onChange={(next) => { prefs.set({ quickDelayMs: Number(next) }) }}
                            label={t('panel.quickCapsuleDelay')}
                          />
                          <span className="dfp-field-note">
                            {t('panel.quickDelayNote')}
                          </span>
                        </div>
                      </div>

                      <div className="dfp-field">
                        <span className="dfp-field-label">{t('panel.drawerWidth')}</span>
                        <div className="dfp-field-body">
                          <Choice<string>
                            value={String(prefs.drawerWidth)}
                            options={[70, 85, 100].map(percent => ({ value: String(percent), label: t('{n}%', { n: percent }) }))}
                            onChange={(next) => { prefs.set({ drawerWidth: Number(next) }) }}
                            label={t('panel.drawerWidth')}
                          />
                          <span className="dfp-field-note">
                            {t('panel.drawerWidthNote')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </Section>
                  )}
              </div>
            )}
        </div>
      </div>
    </>
  )
}

/**
 * The panel's three tabs, and the settings page under the second one.
 * @param props.store - the page's tree source.
 * @param props.tab - the tab to show first (the drawer opens on the day's ledger).
 * @param props.onClose - closes the drawer; left out when nothing opened one.
 * @returns the panel.
 */
export function FastPillsPanel({
  store, tab = 'ledger', onClose, workspaces = [], sessionId = '',
}: {
  readonly store: PillStore
  readonly tab?: PanelTab
  readonly onClose?: () => void
  /** The workspaces this project knows, which the capsule editor offers as scopes. */
  readonly workspaces?: readonly WorkspaceChoice[]
  /** The session whose skill catalog the capsule form suggests from. */
  readonly sessionId?: string
}): JSX.Element {
  const [value, setValue] = useState<PanelTab>(tab)
  const [section, setSection] = useState<SettingsSection>('capsules')
  const prefs = usePrefs(store)
  const t = textFor(prefs.locale)
  const shown = TABS.find(item => item.value === value)
  /* 三支颜色派生的变量写在面板根上：纸与墨是样式表的事，这几支是读者的事。 */
  const accent = useMemo(() => colorStyle(prefs), [prefs.colors, prefs.resolved])
  /* One square cell at the right end of the tab strip: the three main tabs are
     the top row, and nothing else sits above them. */
  const close = onClose === undefined ? null : (
    <button type="button" className="dfp-close" aria-label={t('panel.close')} onClick={onClose}>×</button>
  )
  return (
    <TextContext.Provider value={t}>
      <ThemeContext.Provider value={prefs.resolved}>
        <div className="dfp-panel" style={accent} {...{ [PANEL_ATTRIBUTE]: 'panel' }}>
          <div className="dfp-topbar">
            {close}
            <TabBar<PanelTab>
              items={TABS.map(item => ({
                value: item.value,
                label: t(item.label),
                id: item.id,
                panelId: item.panelId,
              }))}
              value={value}
              onChange={setValue}
              label={t('panel.capsulePanel')}
              className="dfp-tabs"
            />
          </div>

          <div
            className="dfp-tab-body"
            id={shown?.panelId}
            aria-labelledby={shown?.id}
            role="tabpanel"
          >
            {value === 'settings'
              ? (
                <SettingsPage
                  store={store}
                  prefs={prefs}
                  section={section}
                  onSection={setSection}
                  workspaces={workspaces}
                  sessionId={sessionId}
                />
              )
              : value === 'ledger'
                ? <LedgerPanel store={store} />
                : <TrendPanel store={store} />}
          </div>
        </div>
      </ThemeContext.Provider>
    </TextContext.Provider>
  )
}
