/**
 * 主题与外观里那几支颜色：一个色号进来，整套派生值出去。
 *
 * The panel is paper and ink, and it lets a reader move four colours: what a
 * plain capsule looks like, what a quick one looks like, the wash over the whole
 * sheet, and the mark that says a capsule is limited to some workspaces. Each is
 * a **family** — a short list of colours of the same character — and out of
 * whichever one is chosen this module derives everything the sheet draws with:
 * a hover step, a weak wash, a variant that stays readable on the paper, and the
 * variant to print **on the fill** (a filled chip cannot use the paper's ink).
 *
 * This module holds no React and no settings: it is colour arithmetic, so the
 * tests can drive it with literals.
 */

/** Light or dark paper; the derived values differ per paper, not per theme choice. */
export type Paper = 'light' | 'dark'

/** One accent, derived for one paper. */
export interface AccentSet {
  /** The `#rrggbb` literal as chosen, quantized. */
  readonly fill: string
  /** The value to draw text **on the fill** (a filled chip needs this, not {@link AccentSet.ink}). */
  readonly on: string
  /** Contrast of {@link AccentSet.on} against the fill. */
  readonly onRatio: number
  /** One step darker, for a hover. */
  readonly hover: string
  /** The fill at wash strength, for a tinted surface. */
  readonly wash: string
  /** The value to draw the accent as text on this paper. */
  readonly ink: string
  /** Contrast of {@link AccentSet.ink} against the paper. */
  readonly inkRatio: number
}

/** One `#rrggbb` literal, lower case. */
const HEX = /^#([0-9a-f]{6})$/u

/** The most saturation a turned swatch keeps, so the row stays multicoloured but calm. */
const VARIANT_SATURATION = 0.55

/** Where a turned swatch's lightness lands, near the middle of the scale. */
const VARIANT_LIGHTNESS = 0.52

/** Which family of colour one choice stands for. */
export type ColorFamilyId = 'plain' | 'quick' | 'style' | 'scope'

/** One family of colour: what it paints, and which colours it offers. */
export interface ColorFamily {
  readonly id: ColorFamilyId
  /** What this colour is, as the sentence the card labels it with. */
  readonly title: string
  /** One line saying where the colour shows up. */
  readonly note: string
  /** The colour this family paints when nothing is chosen. */
  readonly fallback: string
  /** The colours the card offers for this family, in reading order. */
  readonly presets: readonly string[]
}

/**
 * The colours a family offers: the fallback, then its own hue turned either way.
 *
 * The row is meant to be multicoloured — a reader who wants a green panel should
 * find one — but every swatch keeps the default's saturation and lightness, only
 * a little tamed, so nothing in the row is the fluorescent version of its
 * neighbour.
 * @param fallback - the family's own colour, which leads the row.
 * @param steps - how far to turn the hue for each swatch, in degrees.
 * @returns one literal per swatch.
 */
function hueFamily(fallback: string, steps: readonly number[]): readonly string[] {
  const base = parseHex(fallback)
  if (base === undefined) return [fallback]
  return steps.map(step => (step === 0 ? toHex(base) : toHex(turnHue(base, step))))
}

/**
 * Turn one colour's hue, keeping its saturation and lightness inside the band
 * the panel paints in.
 * @param color - the colour to turn.
 * @param degrees - how far to turn it.
 * @returns the turned channels.
 */
function turnHue(
  color: { readonly r: number; readonly g: number; readonly b: number },
  degrees: number,
): { readonly r: number; readonly g: number; readonly b: number } {
  const [hue, saturation, lightness] = toHsl(color)
  if (saturation < 0.02) return color
  // 饱和度压到一个中等带宽、明度也夹在中间：多彩但不刺眼，是这一版给「其他颜色」定的调子。
  return fromHsl([
    (hue + degrees / 360 + 1) % 1,
    Math.min(saturation, VARIANT_SATURATION),
    Math.min(Math.max(lightness, 0.46), VARIANT_LIGHTNESS),
  ])
}

/** Split channels into hue / saturation / lightness, each `0` to `1`. */
function toHsl(color: { readonly r: number; readonly g: number; readonly b: number }): [number, number, number] {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const high = Math.max(r, g, b)
  const low = Math.min(r, g, b)
  const span = high - low
  const lightness = (high + low) / 2
  if (span === 0) return [0, 0, lightness]
  const saturation = span / (1 - Math.abs(2 * lightness - 1))
  const hue = high === r ? ((g - b) / span) % 6 : high === g ? (b - r) / span + 2 : (r - g) / span + 4
  return [((hue / 6) + 1) % 1, saturation, lightness]
}

/** Put hue / saturation / lightness back into channels. */
function fromHsl([hue, saturation, lightness]: readonly [number, number, number]): { readonly r: number; readonly g: number; readonly b: number } {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const second = chroma * (1 - Math.abs(((hue * 6) % 2) - 1))
  const match = lightness - chroma / 2
  const sector = Math.floor(hue * 6) % 6
  const table: readonly (readonly [number, number, number])[] = [
    [chroma, second, 0], [second, chroma, 0], [0, chroma, second],
    [0, second, chroma], [second, 0, chroma], [chroma, 0, second],
  ]
  const [r, g, b] = table[sector] ?? [0, 0, 0]
  return { r: (r + match) * 255, g: (g + match) * 255, b: (b + match) * 255 }
}

/**
 * The four colours the panel lets a reader move.
 *
 * They are families rather than one accent because they answer four different
 * questions, and each family keeps to one character: the plain capsules are
 * blues, the quick ones are oranges, the style wash is one of the paper-like
 * pastels, and the scope mark is a dark stamp.
 */
export const COLOR_FAMILIES: readonly ColorFamily[] = [
  {
    id: 'plain',
    title: 'appearance.plainCapsule',
    note: 'appearance.familyPlainNote',
    fallback: '#0095ff',
    // 默认还是最先那支蓝；横向换色是多彩的，但色相之外一律不动。
    presets: hueFamily('#0095ff', [0, 35, -35, 70, -70]),
  },
  {
    id: 'quick',
    title: 'appearance.quickCapsule',
    note: 'appearance.familyQuickNote',
    fallback: '#f59e0b',
    // 默认还是最先那支橙（产品里「警告」那一支）；横向同样多彩。
    presets: hueFamily('#f59e0b', [0, 34, -34, 68, -68]),
  },
  {
    id: 'style',
    title: 'appearance.styleColour',
    note: 'appearance.familyStyleNote',
    fallback: '#C9B6E4',
    presets: ['#c9b6e4', '#e3d5bc', '#b7dcc4', '#afd3ec'],
  },
  {
    id: 'scope',
    title: 'appearance.scopeMark',
    note: 'appearance.familyScopeNote',
    fallback: '#1E3A8A',
    presets: ['#1e3a8a', '#14532d', '#4c1d95', '#134e4a', '#7c2d12'],
  },
]

/**
 * The family one id names.
 * @param id - the family.
 * @returns the family record.
 */
export function familyFor(id: ColorFamilyId): ColorFamily {
  const found = COLOR_FAMILIES.find(family => family.id === id)
  if (found === undefined) throw new Error(`unknown colour family ${id}`)
  return found
}

/**
 * What a family paints when a choice is empty or unusable.
 * @param id - the family.
 * @returns the fallback literal.
 */
export function fallbackFor(id: ColorFamilyId): string {
  return familyFor(id).fallback
}

/** The accent the tests and the stylesheet call the default one. */
export const DEFAULT_ACCENT = fallbackFor('plain')

/**
 * Read one `#rrggbb` literal.
 * @param value - the candidate.
 * @returns the three channels, or `undefined` when it is not a hex colour.
 */
export function parseHex(value: string): { readonly r: number; readonly g: number; readonly b: number } | undefined {
  const hit = HEX.exec(value.trim().toLowerCase())
  if (hit === null) return undefined
  const number = Number.parseInt(hit[1] ?? '', 16)
  if (!Number.isFinite(number)) return undefined
  return { r: (number >> 16) & 0xFF, g: (number >> 8) & 0xFF, b: number & 0xFF }
}

/**
 * Spell three channels as `#rrggbb`.
 * @param color - the channels; each is rounded and clamped into a byte.
 * @returns the literal.
 */
export function toHex(color: { readonly r: number; readonly g: number; readonly b: number }): string {
  const byte = (value: number): string => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${byte(color.r)}${byte(color.g)}${byte(color.b)}`
}

/**
 * Mix one colour towards another.
 * @param color - the colour to move.
 * @param target - the colour to move towards.
 * @param amount - how far, `0` to `1`.
 * @returns the mixed channels.
 */
function mix(
  color: { readonly r: number; readonly g: number; readonly b: number },
  target: { readonly r: number; readonly g: number; readonly b: number },
  amount: number,
): { readonly r: number; readonly g: number; readonly b: number } {
  const at = Math.max(0, Math.min(1, amount))
  return {
    r: color.r + (target.r - color.r) * at,
    g: color.g + (target.g - color.g) * at,
    b: color.b + (target.b - color.b) * at,
  }
}

/**
 * The relative luminance of one colour.
 * @param color - the channels.
 * @returns luminance, `0` for black and `1` for white.
 */
export function luminance(color: { readonly r: number; readonly g: number; readonly b: number }): number {
  const channel = (value: number): number => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

/**
 * The contrast ratio between two colours.
 * @param left - one colour.
 * @param right - the other.
 * @returns the WCAG ratio, `1` to `21`.
 */
export function contrast(
  left: { readonly r: number; readonly g: number; readonly b: number },
  right: { readonly r: number; readonly g: number; readonly b: number },
): number {
  const a = luminance(left)
  const b = luminance(right)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * The colour of one of the two papers.
 * @param paper - which paper.
 * @returns the paper's own colour, for the contrast arithmetic.
 */
function paperColor(paper: Paper): { readonly r: number; readonly g: number; readonly b: number } {
  return paper === 'dark' ? { r: 0x00, g: 0x00, b: 0x00 } : { r: 0xFA, g: 0xF7, b: 0xF5 }
}

/** Below this ratio a colour drawn as text is pulled towards the readable end. */
const READABLE_RATIO = 4.5

/** How much closer to black or white each unreadable step moves. */
const NUDGE = 0.12

/** How much darker a hover is than the fill it belongs to. */
const HOVER_STEP = 0.16

/** How much of the fill a wash keeps. */
const WASH_ALPHA = 0.25

/**
 * Move one colour until it can be read on a background.
 *
 * The first candidate is whichever end of the greyscale the background is not,
 * and it keeps stepping until it clears {@link READABLE_RATIO}, then bisects the
 * last stretch — a count of steps is a guess at how far a colour has to move,
 * and a guess that is one step short leaves a reader with text they cannot read.
 * @param color - the colour to move.
 * @param background - what it will be read against.
 * @returns the readable variant.
 */
export function readableOn(
  color: { readonly r: number; readonly g: number; readonly b: number },
  background: Paper,
): { readonly r: number; readonly g: number; readonly b: number } {
  const behind = paperColor(background)
  const target = background === 'dark' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }
  if (contrast(color, behind) >= READABLE_RATIO) return color
  let readable = color
  let amount = 0
  for (let step = 0; step < 12 && contrast(readable, behind) < READABLE_RATIO; step += 1) {
    amount += NUDGE
    readable = mix(color, target, Math.min(1, amount))
  }
  if (contrast(readable, behind) < READABLE_RATIO && amount < 1) {
    let low = amount - NUDGE
    let high = 1
    for (let step = 0; step < 12; step += 1) {
      const middle = (low + high) / 2
      if (contrast(mix(color, target, middle), behind) >= READABLE_RATIO) high = middle
      else low = middle
    }
    readable = mix(color, target, high)
  }
  return readable
}

/**
 * The value to print **on** a fill: white on a dark one, ink on a light one.
 *
 * A filled chip cannot use the paper's ink — its background is the fill. The
 * lighter or darker end is picked by the fill's own luminance, the way a
 * designer would, and if that end cannot be read (a mid orange takes white at
 * only 3:1) the other end is used instead.
 * @param fill - the fill the text sits on.
 * @returns the colour and the contrast it reaches.
 */
export function inkOnFill(fill: { readonly r: number; readonly g: number; readonly b: number }): {
  readonly color: string
  readonly ratio: number
} {
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0x11, g: 0x11, b: 0x11 }
  const first = luminance(fill) > 0.42 ? black : white
  const other = first === white ? black : white
  const chosen = contrast(first, fill) >= READABLE_RATIO ? first : other
  return { color: toHex(chosen), ratio: Math.round(contrast(chosen, fill) * 10) / 10 }
}

/**
 * Derive every value the sheet spends an accent as.
 * @param accent - the configured fill, a `#rrggbb` literal.
 * @param paper - the paper it will be painted on.
 * @returns the fill, both text variants, the hover step and the wash.
 */
export function accentSet(accent: string, paper: Paper): AccentSet {
  const fill = parseHex(accent) ?? parseHex(DEFAULT_ACCENT) ?? { r: 0x4F, g: 0x6B, b: 0xED }
  const ink = readableOn(fill, paper)
  // 填充上的字看的是**填充**，不是纸：一颗实心胶囊上的字跟它自己的底比。
  const on = inkOnFill(fill)
  return {
    fill: toHex(fill),
    on: on.color,
    onRatio: on.ratio,
    hover: toHex(mix(fill, { r: 0, g: 0, b: 0 }, HOVER_STEP)),
    wash: `${toHex(fill)}${Math.round(WASH_ALPHA * 255).toString(16).padStart(2, '0')}`,
    ink: toHex(ink),
    inkRatio: Math.round(contrast(ink, paperColor(paper)) * 10) / 10,
  }
}

/**
 * Whether a literal is one this panel can paint.
 * @param value - the candidate, as typed.
 * @returns whether it is a `#rrggbb` colour.
 */
export function isAccent(value: string): boolean {
  return parseHex(value) !== undefined
}

/**
 * The family as a bar: four stops from the dark end to the light one.
 *
 * The reference panel shows an accent as a ramp rather than as a row of numbers,
 * and it is right to: what a reader is choosing is a colour's character, and a
 * ramp says that at a glance. The four stops are the ink this paper can read,
 * the fill darkened, the fill, and the fill lightened.
 * @param accent - the configured fill.
 * @param paper - the paper it will be painted on.
 * @returns four literals, dark end first.
 */
export function familyRamp(accent: string, paper: Paper): readonly string[] {
  const set = accentSet(accent, paper)
  const fill = parseHex(set.fill) ?? { r: 0, g: 0, b: 0 }
  const end = paper === 'dark' ? { r: 255, g: 255, b: 255 } : { r: 0xFA, g: 0xF7, b: 0xF5 }
  return [
    set.ink,
    toHex(mix(fill, { r: 0, g: 0, b: 0 }, 0.28)),
    set.fill,
    toHex(mix(fill, end, paper === 'dark' ? 0.55 : 0.45)),
  ]
}

/**
 * One family's derived values as the custom properties the sheet reads.
 *
 * The sheet keeps its own defaults, so a family left empty writes nothing at all
 * and the panel stays the paper it shipped as. A family that is set takes both
 * the value and its derivations: a reader who picks one colour means that
 * colour, not "that colour plus the one that was there before".
 * @param id - the family being painted.
 * @param accent - the configured fill.
 * @param paper - the paper it will be painted on.
 * @returns name and value pairs.
 */
export function familyTokens(
  id: ColorFamilyId,
  accent: string,
  paper: Paper,
): readonly (readonly [string, string])[] {
  const set = accentSet(accent, paper)
  if (id === 'plain') {
    return [
      ['--dfp-plain-fill', set.fill],
      ['--dfp-plain-ink', set.ink],
      ['--dfp-plain-wash', set.wash],
      ['--dfp-accent-hover', set.hover],
      ['--dfp-accent-ink', set.ink],
      ['--dfp-accent-wash', set.wash],
      // 图表与图例里的「普通」那一支就是这一支：它们画的是同一类胶囊的用量。
      ['--dfp-brand', set.fill],
    ]
  }
  if (id === 'quick') {
    return [
      ['--dfp-quick-fill', set.fill],
      // 两处文字色：实心胶囊（聊天框那排）用 on，带淡底的标记用 ink。
      ['--dfp-quick-ink', set.on],
      ['--dfp-quick-text', set.ink],
      ['--dfp-quick-wash', set.wash],
    ]
  }
  if (id === 'scope') {
    return [
      ['--dfp-scope-fill', set.fill],
      ['--dfp-scope-ink', set.ink],
      ['--dfp-scope-wash', set.wash],
    ]
  }
  // 风格色彩只管那张纸与那颗「统领」圆牌：图表的两支颜色归两种胶囊，不归它。
  return [
    ['--dfp-style-fill', set.fill],
    ['--dfp-style-wash', set.wash],
    ['--dfp-style-ink', set.ink],
  ]
}
