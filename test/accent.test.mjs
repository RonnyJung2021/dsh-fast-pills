/**
 * 外观里那支主色的算术。
 *
 * The panel derives everything it paints with from one literal, and these are
 * the promises that derivation has to keep: a fill that survives being typed in
 * any case, a hover that is darker than its fill, a text variant that clears
 * 4.5:1 on the paper it will be read on, and a set of custom properties that
 * names the paper's own tokens.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  accentSet, COLOR_FAMILIES, contrast, familyRamp, familyTokens, isAccent, luminance, parseHex, readableOn,
  toHex,
} from '../src/client/utils/accent.ts'

/** Every colour the card offers as a swatch, across the four families. */
const ALL_PRESETS = [...new Set(COLOR_FAMILIES.flatMap(family => [...family.presets, family.fallback]))]

/** Read a literal the tests also want as channels. */
function channels(hex) {
  const parsed = parseHex(hex)
  assert.notEqual(parsed, undefined, `${hex} should parse`)
  return parsed
}

describe('parseHex and toHex', () => {
  it('reads a literal whatever case it was typed in', () => {
    assert.deepEqual(parseHex('#0095FF'), { r: 0, g: 0x95, b: 0xFF })
    assert.deepEqual(parseHex('  #0095ff '), { r: 0, g: 0x95, b: 0xFF })
    assert.equal(toHex({ r: 0, g: 0x95, b: 0xFF }), '#0095ff')
  })

  it('refuses anything that is not one', () => {
    for (const value of ['', '#fff', '0095ff', '#0095ff00', 'rgb(0,149,255)', '#zzzzzz']) {
      assert.equal(parseHex(value), undefined, `${value} should not parse`)
      assert.equal(isAccent(value), false)
    }
  })
})

describe('readableOn', () => {
  it('leaves a colour that already reads on the paper alone', () => {
    const dark = channels('#0F766E')
    assert.deepEqual(readableOn(dark, 'light'), dark)
  })

  it('pulls an unreadable colour until it clears the bar', () => {
    for (const paper of ['light', 'dark']) {
      for (const preset of [...ALL_PRESETS, '#FFFF00', '#00FF00', '#808080']) {
        const ink = readableOn(channels(preset), paper)
        const behind = paper === 'dark' ? { r: 0, g: 0, b: 0 } : { r: 0xFA, g: 0xF7, b: 0xF5 }
        assert.ok(
          contrast(ink, behind) >= 4.5,
          `${preset} on ${paper} should clear 4.5:1, got ${contrast(ink, behind).toFixed(2)}`,
        )
      }
    }
  })
})

describe('accentSet', () => {
  it('derives the four values from one literal', () => {
    const set = accentSet('#0095FF', 'light')
    assert.equal(set.fill, '#0095ff')
    assert.match(set.hover, /^#[0-9a-f]{6}$/u)
    assert.match(set.wash, /^#[0-9a-f]{8}$/u)
    assert.equal(set.wash.slice(0, 7), set.fill, 'the wash is the fill with its own alpha')
    // The shipped blue is a fill, not a text colour: 2.9:1 on warm paper, so the
    // derived text variant has to be a darker one.
    assert.notEqual(set.ink, '#0095ff', 'a fill that cannot be read is moved')
    assert.equal(set.ink.length, 7)
    assert.ok(set.inkRatio >= 4.5, `ratio should clear the bar, got ${String(set.inkRatio)}`)
  })

  it('darkens the hover rather than returning the fill', () => {
    const set = accentSet('#0095FF', 'light')
    const fill = channels(set.fill)
    const hover = channels(set.hover)
    assert.ok(hover.r <= fill.r && hover.b <= fill.b, 'a hover is never lighter than its fill')
    assert.notEqual(set.hover, set.fill)
  })

  it('answers a paintable set for a literal it cannot read', () => {
    const set = accentSet('not a colour', 'light')
    assert.equal(set.fill, '#0095ff', 'the plain family ships as the original blue')
  })

  it('gives the dark paper its own readable variant', () => {
    const light = accentSet('#000080', 'light')
    const dark = accentSet('#000080', 'dark')
    assert.ok(dark.inkRatio >= 4.5)
    assert.notEqual(dark.ink, light.ink, 'navy cannot be read the same way on both papers')
  })
})

describe('the families', () => {
  it('offers one character per family, with the default leading it', () => {
    const [plain, quick, style, scope] = COLOR_FAMILIES
    assert.equal(plain.presets[0], plain.fallback)
    assert.equal(quick.presets[0], quick.fallback)
    // 默认就是最先那两支：普通胶囊是蓝的，快速胶囊是橙的。
    assert.equal(plain.fallback, '#0095ff')
    assert.equal(quick.fallback, '#f59e0b')
    assert.ok(hueOf(plain.fallback) > 200 && hueOf(plain.fallback) < 230, 'plain defaults to the blue')
    assert.ok(hueOf(quick.fallback) > 25 && hueOf(quick.fallback) < 50, 'quick defaults to the orange')
    // 横向换色是多彩的：同一行里出现多个色相。
    for (const family of [plain, quick]) {
      const hues = new Set(family.presets.map(preset => Math.round(hueOf(preset) / 20)))
      assert.ok(hues.size >= 3, `${family.id} should offer several hues`)
      // 默认那一枚就是最先那支（满饱和也算数），**换的那些**才要求被把控过。
      for (const preset of family.presets.slice(1)) {
        const [, saturation, lightness] = hslOf(preset)
        assert.ok(saturation <= 0.8, `${preset} stays out of the fluorescent end`)
        assert.ok(lightness >= 0.4 && lightness <= 0.62, `${preset} keeps a middle lightness`)
      }
    }
    // 限定标记偏深：亮度低，才能当一枚「盖章」。
    for (const preset of scope.presets) assert.ok(luminance(parseHex(preset)) < 0.12, `${preset} is dark`)
    // 风格色彩是能当纸的淡色。
    for (const preset of style.presets) assert.ok(luminance(parseHex(preset)) > 0.45, `${preset} is pale`)
  })
})

/** Hue / saturation / lightness of one literal, for the family assertions. */
function hslOf(hex) {
  const { r, g, b } = parseHex(hex)
  const channels = [r / 255, g / 255, b / 255]
  const high = Math.max(...channels)
  const low = Math.min(...channels)
  const lightness = (high + low) / 2
  const span = high - low
  if (span === 0) return [0, 0, lightness]
  return [hueOf(hex) / 360, span / (1 - Math.abs(2 * lightness - 1)), lightness]
}

/** Hue of one literal in degrees, for the family assertions. */
function hueOf(hex) {
  const { r, g, b } = parseHex(hex)
  const [red, green, blue] = [r / 255, g / 255, b / 255]
  const high = Math.max(red, green, blue)
  const low = Math.min(red, green, blue)
  const span = high - low
  if (span === 0) return 0
  const raw = high === red ? ((green - blue) / span) % 6 : high === green ? (blue - red) / span + 2 : (red - green) / span + 4
  return ((raw / 6) + 1) % 1 * 360
}

describe('the on-fill ink', () => {
  it('gives every swatch a value that can be read on its own fill', () => {
    for (const preset of ALL_PRESETS) {
      const set = accentSet(preset, 'light')
      const fill = parseHex(set.fill)
      assert.ok(
        contrast(parseHex(set.on), fill) >= 4.5,
        `${preset}: text on the fill should clear 4.5:1, got ${String(set.onRatio)}`,
      )
      assert.equal(set.onRatio, Math.round(contrast(parseHex(set.on), fill) * 10) / 10)
    }
  })
})

describe('familyRamp', () => {
  it('walks from the readable dark end to a light one', () => {
    const ramp = familyRamp('#4F6BED', 'light')
    assert.equal(ramp.length, 4)
    for (const stop of ramp) assert.equal(isAccent(stop), true)
    assert.notEqual(ramp[0], ramp[3])
  })
})

describe('familyTokens', () => {
  it('gives each family its own tokens rather than one shared accent', () => {
    const plain = new Map(familyTokens('plain', '#E8890C', 'light'))
    const quick = new Map(familyTokens('quick', '#0095FF', 'light'))
    const style = new Map(familyTokens('style', '#8B5CF6', 'light'))
    assert.equal(plain.get('--dfp-plain-fill'), '#e8890c')
    assert.ok(plain.has('--dfp-accent-hover'), 'the plain family drives the drawer ring')
    assert.equal(quick.get('--dfp-quick-fill'), '#0095ff')
    assert.ok(quick.has('--dfp-quick-ink'), 'a quick capsule is filled, so it needs an ink')
    assert.equal(plain.get('--dfp-brand'), '#e8890c', 'the plain family owns the chart colour')
    assert.equal(style.has('--dfp-brand'), false, 'the style wash does not own the chart colour')
    assert.equal(style.has('--dfp-quick-fill'), false, 'the style colour is not a capsule colour')
    const scope = new Map(familyTokens('scope', '#0F766E', 'light'))
    assert.equal(scope.get('--dfp-scope-fill'), '#0f766e')
    assert.ok(scope.has('--dfp-scope-wash'), 'the scope mark has a wash of its own')
    assert.equal(scope.has('--dfp-brand'), false, 'the scope colour does not move the charts')
  })

  it('offers four families, each with its own default and presets', () => {
    assert.deepEqual(COLOR_FAMILIES.map(family => family.id), ['plain', 'quick', 'style', 'scope'])
    for (const family of COLOR_FAMILIES) {
      assert.ok(family.presets.length >= 4, `${family.id} should offer a few colours`)
      assert.equal(family.presets[0], family.fallback.toLowerCase(), `${family.id} leads with its default`)
      for (const preset of family.presets) assert.equal(isAccent(preset), true, `${preset} should be a colour`)
      assert.equal(isAccent(family.fallback), true)
    }
  })
})
