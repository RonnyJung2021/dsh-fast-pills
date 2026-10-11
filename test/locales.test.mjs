/**
 * The two message tables, and the promise they keep to each other.
 *
 * `zh.json` is the wording the plugin is written in and `en.json` is the
 * translation. Three things are therefore checked mechanically: the two files
 * carry the same keys, every answer fills the same `{placeholders}` as the
 * sentence it answers, and every key a source asks for is in the table — a key
 * nothing answers would otherwise render as itself, quietly, and only for a
 * reader of one language.
 */

import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { TABLES, textFor, translate } from '../src/shared/locales/index.ts'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const zh = TABLES.zh
const en = TABLES.en

/** Every key a source asks for by literal. */
function asked() {
  const found = new Set()
  for (const file of globSync(join(root, 'src', '**', '*.ts*'))) {
    if (file.includes('locales')) continue
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/\bt\(\s*'([a-z][\w.]*)'/gu)) found.add(match[1])
  }
  return found
}

/** The placeholder names one template carries. */
function placeholders(template) {
  return [...template.matchAll(/\{(\w+)\}/gu)].map(match => match[1]).sort()
}

describe('the message tables', () => {
  it('carry the same keys in both languages', () => {
    const missing = Object.keys(zh).filter(key => !(key in en))
    const extra = Object.keys(en).filter(key => !(key in zh))
    assert.deepEqual(missing, [], 'these keys have no English answer')
    assert.deepEqual(extra, [], 'these English answers have no Chinese key')
  })

  it('answer every key the sources ask for', () => {
    const missing = [...asked()].filter(key => !(key in zh))
    assert.deepEqual(missing, [], 'these keys are asked for but not in the table')
  })

  it('keeps the same placeholders on both sides', () => {
    const drifted = Object.keys(zh)
      .filter(key => placeholders(zh[key]).join() !== placeholders(en[key] ?? '').join())
      .map(key => key)
    assert.deepEqual(drifted, [], 'these translations fill different placeholders')
  })

  it('holds no empty entry', () => {
    const empty = Object.entries(zh).filter(([, value]) => value.trim().length === 0).map(([key]) => key)
    assert.deepEqual(empty, [])
  })
})

describe('the prompts', () => {
  it('ships one in each language, and each in its own language', () => {
    const zhPrompt = translate('zh', 'prompts.system')
    const enPrompt = translate('en', 'prompts.system')
    assert.match(zhPrompt, /胶囊/u)
    assert.match(enPrompt, /capsule/u)
    assert.doesNotMatch(enPrompt, /[\u4e00-\u9fff]/u, 'the English prompt carries Chinese')
    assert.match(enPrompt, /\{"suggestions"/u)
    assert.match(zhPrompt, /\{"suggestions"/u)
  })

  it('asks for the answer in the format sample it shows', () => {
    const sample = /\{"suggestions":\[[^\]]*\]\}/u
    assert.match(translate('en', 'prompts.system'), sample)
    assert.match(translate('zh', 'prompts.system'), sample)
  })

  it('writes a language its own default preference', () => {
    assert.match(translate('zh', 'prompts.customDefault'), /偏好/u)
    assert.match(translate('en', 'prompts.customDefault'), /Preferences/u)
  })

  it('names the seed capsules in both languages', () => {
    assert.equal(translate('zh', 'seed.continue.name'), '继续')
    assert.equal(translate('en', 'seed.continue.name'), 'Continue')
  })
})

describe('reading one entry', () => {
  it('answers in the language it was asked for', () => {
    assert.equal(translate('zh', 'panel.capsuleTrends'), '胶囊使用趋势统计')
    assert.equal(translate('en', 'panel.capsuleTrends'), 'Capsule trends')
  })

  it('fills what the caller passes', () => {
    const t = textFor('zh')
    assert.equal(t('ledger.metricsLine', { quick: 1, plain: 2, directories: 3 }),
      '快速 1 次 · 普通 2 次 · 3 个工作目录')
    assert.equal(textFor('en')('ledger.metricsLine', { quick: 1, plain: 2, directories: 3 }),
      'quick 1 · plain 2 · 3 workspaces')
  })

  it('leaves a name it was not given standing rather than printing nothing', () => {
    assert.equal(textFor('en')('ledger.metricsLine'), 'quick {quick} · plain {plain} · {directories} workspaces')
  })

  it('falls back to the key when neither table has it', () => {
    assert.equal(translate('en', 'no.such.key'), 'no.such.key')
  })
})
