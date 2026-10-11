/**
 * 主题与外观: the one section that says what this panel looks like.
 *
 * The panel is paper and ink, so there is a paper to pick and three colours to
 * move. Each colour is a **family**: 普通胶囊 is what a capsule that only inserts
 * looks like, 快速胶囊 is what one that sends itself looks like, and 风格色彩 is a
 * wash over the whole sheet. Out of each fill the panel derives a hover step, a
 * weak wash and a text variant that stays readable on the current paper, so a
 * pale choice cannot end up unreadable — and every choice takes effect the
 * moment it is pressed, which is what the preview underneath shows.
 */

import type { JSX } from 'react'
import { THEME_CHOICES, type ThemeChoice } from '../../shared/enums/index.ts'
import {
  accentSet, COLOR_FAMILIES, familyRamp, type ColorFamily, type ColorFamilyId,
} from '../utils/accent.ts'
import { Choice, Section } from './controls.tsx'
import { THEME_LABELS, type Prefs } from '../services/preferences.ts'
import { useText } from '../contexts/textContext.ts'

/** What the 主题与外观 card offers, and the way to change it. */
export interface AppearanceProps {
  /** The panel's settings. */
  readonly prefs: Prefs
  /** Called with the fields to change; they take effect and are written at once. */
  readonly set: (patch: {
    readonly theme?: ThemeChoice
    readonly colors?: Readonly<Record<ColorFamilyId, string>>
  }) => void
}

/**
 * One colour family's card: the swatches, the literal, and what it derives.
 *
 * The swatches are the family's own hue turned either way, not a palette of
 * unrelated colours, because a preset that does not belong beside the default
 * is a preset that will look wrong once it is painted. Under them sits the
 * ramp — what this colour looks like as a bar — and the four values it derives,
 * each with the contrast it will have on the current paper.
 * @param props.family - which family this card is for.
 * @param props.prefs - the panel's settings.
 * @param props.set - called with the whole next colour map.
 * @returns the card.
 */
function ColorRow({ family, prefs, set }: AppearanceProps & { readonly family: ColorFamily }): JSX.Element {
  const t = useText()
  const chosen = prefs.colors[family.id]
  // 没选这一支时，行里给读者看的就是它**自己**那一支默认色（而不是别家的）：
  // 派生值是给眼睛看的，写进样式表的仍然是「什么都没选」。
  const shown = chosen.length === 0 ? family.fallback : chosen
  const derived = accentSet(shown, prefs.resolved)
  const ramp = familyRamp(shown, prefs.resolved)
  const custom = chosen.length > 0 && !family.presets.includes(chosen)
  const pick = (next: string): void => { set({ colors: { ...prefs.colors, [family.id]: next } }) }
  return (
    <div className="dfp-color-card" data-family={family.id}>
      <div className="dfp-color-head">
        <span className="dfp-color-title">{t(family.title)}</span>
        <span className="dfp-color-note">{t(family.note)}</span>
      </div>

      <div className="dfp-color-picks">
        {/* 「默认」也是一种选择：清掉它就回到这一版自带的那一支。 */}
        <button
          type="button"
          className="dfp-accent-default"
          aria-pressed={chosen.length === 0}
          onClick={() => { pick('') }}
        >
          {t('appearance.default')}
        </button>
        {family.presets.map(preset => (
          <button
            key={preset}
            type="button"
            className="dfp-accent-chip"
            style={{ background: preset }}
            aria-pressed={chosen === preset}
            aria-label={t('{family} {hex}', { family: t(family.title), hex: preset })}
            title={preset}
            data-color={preset}
            onClick={() => { pick(preset) }}
          />
        ))}
        <input
          className="dfp-input dfp-accent-input"
          value={chosen}
          placeholder="#rrggbb"
          aria-label={t('appearance.customFamily', { family: t(family.title) })}
          onChange={(event) => {
            const next = event.currentTarget.value.trim().toLowerCase()
            // Half-typed hex is not a colour: it is only stored once it is one.
            if (next === '' || /^#[0-9a-f]{6}$/u.test(next)) pick(next)
          }}
        />
        {custom && <span className="dfp-field-note">{t('appearance.customLiteral')}</span>}
      </div>

      {/* 这一支长什么样：一条从深到浅的色带。 */}
      <div className="dfp-ramp" aria-hidden="true">
        {ramp.map((stop, position) => (
          <span key={`${String(position)}-${stop}`} style={{ background: stop }} />
        ))}
      </div>

      <div className="dfp-swatches" data-derived={family.id}>
        <span className="dfp-swatch-cell">
          <span className="dfp-swatch-chip" style={{ background: derived.fill }} />
          <span className="dfp-swatch-name">{t('appearance.fill')}</span>{derived.fill}
        </span>
        <span className="dfp-swatch-cell">
          <span className="dfp-swatch-chip" style={{ background: derived.hover }} />
          <span className="dfp-swatch-name">{t('appearance.hover')}</span>{derived.hover}
        </span>
        <span className="dfp-swatch-cell">
          <span className="dfp-swatch-chip" style={{ background: derived.wash }} />
          <span className="dfp-swatch-name">{t('appearance.wash')}</span>{derived.wash}
        </span>
        {/* 两处文字色：画在纸上的那一支（边框、字），和画在填充上的那一支（实心胶囊的字）。 */}
        <span className="dfp-swatch-cell">
          <span className="dfp-swatch-chip dfp-swatch-chip-ink" style={{ background: derived.ink }} />
          <span className="dfp-swatch-name">{t('appearance.textPaper')}</span>{derived.ink}
          <span className="dfp-swatch-ratio">{t('{ratio}:1', { ratio: derived.inkRatio })}</span>
        </span>
        <span className="dfp-swatch-cell">
          <span
            className="dfp-swatch-chip dfp-swatch-chip-on"
            style={{ background: derived.fill, color: derived.on }}
          >
            A
          </span>
          <span className="dfp-swatch-name">{t('appearance.textFill')}</span>{derived.on}
          <span className="dfp-swatch-ratio">{t('{ratio}:1', { ratio: derived.onRatio })}</span>
        </span>
      </div>

      <span className="dfp-field-note">{t('appearance.swatchesNote')}</span>
    </div>
  )
}

/**
 * The 主题与外观 section.
 * @param props - the settings and the setter.
 * @returns the section body.
 */
export function AppearanceSection({ prefs, set }: AppearanceProps): JSX.Element {
  const t = useText()
  const paper = prefs.resolved
  const filled = (id: ColorFamilyId): string => {
    const family = COLOR_FAMILIES.find(entry => entry.id === id)
    const chosen = prefs.colors[id]
    return chosen.length === 0 ? (family?.fallback ?? chosen) : chosen
  }
  const plain = accentSet(filled('plain'), paper)
  const quick = accentSet(filled('quick'), paper)
  const style = accentSet(filled('style'), paper)
  const scope = accentSet(filled('scope'), paper)
  return (
    <Section index="02" title={t('appearance.themeAppearance')}>
      <div className="dfp-fields">
        <div className="dfp-field">
          <span className="dfp-field-label">{t('appearance.theme')}</span>
          <div className="dfp-field-body">
            <Choice<ThemeChoice>
              value={prefs.theme}
              options={THEME_CHOICES.map(choice => ({ value: choice, label: t(THEME_LABELS[choice]) }))}
              onChange={(theme) => { set({ theme }) }}
              label={t('appearance.theme')}
            />
            <span className="dfp-field-note">
              {t('appearance.themeNote')}
            </span>
          </div>
        </div>

        {COLOR_FAMILIES.map(family => (
          <ColorRow key={family.id} family={family} prefs={prefs} set={set} />
        ))}
      </div>

      {/* 预览画的就是这三支派生出来的值本身，所以它和面板真实画出来的东西不会走样。 */}
      <div className="dfp-accent-preview" data-accent-preview="panel">
        <span className="dfp-accent-preview-label">{t('appearance.preview')}</span>

        <span className="dfp-accent-preview-block">
          <span className="dfp-accent-preview-label">{t('appearance.capsuleRow')}</span>
          <span className="dfp-pill" data-quick="false" style={{ borderColor: plain.fill, color: plain.ink }}>
            {t('appearance.plainCapsule')}
          </span>
          <span
            className="dfp-pill"
            data-quick="true"
            style={{ borderColor: quick.fill, background: quick.wash, color: quick.ink }}
          >
            {t('appearance.quickCapsule')}
          </span>
        </span>

        <span className="dfp-accent-preview-block">
          <span className="dfp-accent-preview-label">{t('appearance.ledgerCharts')}</span>
          <span className="dfp-stats-dot" data-quick="false" style={{ background: plain.fill }} />
          <span className="dfp-stats-dot" data-quick="true" style={{ background: quick.fill }} />
          <span className="dfp-heat-scale">
            {[1, 2, 3, 4, 5].map(step => (
              <span
                key={step}
                className="dfp-stats-heat-cell"
                style={{ background: `color-mix(in srgb, ${style.fill} ${String(step * 18)}%, ${style.ink})` }}
              />
            ))}
          </span>
        </span>

        <span className="dfp-accent-preview-block">
          <span className="dfp-accent-preview-label">{t('appearance.scopeMark')}</span>
          <span
            className="dfp-scope-tag dfp-scope-preview"
            style={{ borderColor: scope.fill, background: scope.wash, color: scope.ink }}
          >
            {t('appearance.scopePreviewLabel')}
          </span>
        </span>

        <span className="dfp-accent-preview-block">
          <span className="dfp-accent-preview-label">{t('appearance.styleColour')}</span>
          <span className="dfp-accent-preview-sheet" />
          <span className="dfp-accent-preview-note">
            {t('appearance.stylePreviewNote', { ink: style.ink, ratio: style.inkRatio })}
          </span>
        </span>
      </div>
    </Section>
  )
}
