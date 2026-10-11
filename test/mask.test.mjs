/**
 * The masking rules, driven as pure text.
 *
 * Two properties matter more than any single rule: a secret shape always comes
 * out replaced, and a replacement never throws or blocks the caller. The
 * "leave alone" cases below are deliberately few and dull — the rules are meant
 * to over-mask, so only ordinary prose is asserted to survive.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { maskLabels } from '../src/shared/locales/index.ts'
import { mask, maskDeep, maskText } from '../src/shared/utils/mask.ts'

/** The markers these cases read: the Chinese table's own. */
const zh = maskLabels('zh')

const root = dirname(dirname(fileURLToPath(import.meta.url)))

describe('the masking rules', () => {
  it('replaces an API key wherever it sits in a sentence', () => {
    assert.equal(mask('用 sk-abcdefghijklmnopqrstuvwx 调一下', zh), '用 [已脱敏:token] 调一下')
  })

  it('replaces the value of a named secret, leaving the name readable', () => {
    assert.equal(mask('DEEPSEEK_API_KEY=sk-live-abcd1234', zh), 'DEEPSEEK_API_KEY=[已脱敏:token]')
    assert.equal(mask('password: hunter2xyz', zh), 'password:[已脱敏:token]')
    assert.equal(mask('密码：e5f6a7b8', zh), '密码：[已脱敏:值]')
  })

  it('replaces a private key block whole', () => {
    const text = `看这个\n-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nABCD\n-----END RSA PRIVATE KEY-----\n别外传`
    assert.equal(mask(text, zh), '看这个\n[已脱敏:私钥]\n别外传')
  })

  it('replaces a connection string with credentials in it', () => {
    assert.equal(mask('DATABASE_URL=postgres://admin:hunter2@db.internal:5432/app', zh),
      'DATABASE_URL=[已脱敏:连接串]')
    assert.equal(mask('连 postgres://admin:hunter2@db.internal:5432/app 这个库', zh), '连 [已脱敏:连接串] 这个库')
  })

  it('replaces mail addresses, phone numbers and date-like stamps', () => {
    assert.equal(mask('发到 zhangsan@example.com 或打 13812345678', zh), '发到 [已脱敏:邮箱] 或打 [已脱敏:手机号]')
    assert.equal(mask('版本是 2026-10-10 发的', zh), '版本是 [已脱敏:日期] 发的')

    // A transcript line carries its own instant; masking only the date half of
    // it would leave a dangling time behind for the model to read.
    assert.equal(mask('[2026-10-10T11:00:50.990Z] 说了句话', zh), '[[已脱敏:时间]] 说了句话')
  })

  it('replaces a JWT and an AWS key', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    assert.equal(mask(jwt, zh), '[已脱敏:token]')
    assert.equal(mask('AKIAIOSFODNN7EXAMPLE', zh), '[已脱敏:token]')
  })

  it('replaces any assignment-shaped value, whatever the name', () => {
    assert.equal(mask('customerCode: A81F2C', zh), 'customerCode:[已脱敏:值]')
    // A CJK name works the same way; the rule keeps its own characters.
    assert.equal(mask('密码：e5f6a7b8', zh), '密码：[已脱敏:值]')
    assert.equal(mask('customerCode=abcdef1234', zh), 'customerCode=[已脱敏:值]')
    assert.equal(mask('客户号：A81F2C', zh), '客户号：[已脱敏:值]')
    // Prose stays prose: a sentence is not an assignment.
    assert.equal(mask('先读规格再写测试', zh), '先读规格再写测试')
    // A host:port is not an assignment either — the net must not eat a URL.
    assert.equal(mask('接口在 http://127.0.0.1:63111 上', zh), '接口在 http://127.0.0.1:63111 上')
  })

  it('reports where each span sat in the text it was given', () => {
    const outcome = maskText('联系 zhangsan@example.com 谢谢', zh)
    assert.equal(outcome.tokens.length, 1)
    assert.equal(outcome.text.slice(outcome.tokens[0].start, outcome.tokens[0].start + '[已脱敏:邮箱]'.length),
      '[已脱敏:邮箱]')
    assert.equal(outcome.text, '联系 [已脱敏:邮箱] 谢谢')
  })

  it('is idempotent: masking masked text changes nothing more', () => {
    const once = mask('password: hunter2xyz 与 13812345678', zh)
    assert.equal(mask(once, zh), once)
  })

  it('leaves ordinary prose alone', () => {
    const text = '把这段需求整理成胶囊：先读规格，再写测试，最后跑构建'
    assert.equal(mask(text, zh), text)
    assert.deepEqual(maskText('', zh).tokens, [])
  })

  it('masks every string inside a request body, at any depth', () => {
    const body = {
      pills: [{ name: '联系', body: '打 13812345678', skill: null }],
      nested: { note: ['zhangsan@example.com'] },
      count: 3,
    }
    const outcome = maskDeep(body, zh)
    assert.deepEqual(outcome.value, {
      pills: [{ name: '联系', body: '打 [已脱敏:手机号]', skill: null }],
      nested: { note: ['[已脱敏:邮箱]'] },
      count: 3,
    })
    assert.equal(outcome.masked, 2)
  })

  it('never lets a secret shape survive, whatever rule fires', () => {
    assert.equal(mask('{'.repeat(200)), '{'.repeat(200))
    for (const text of [
      '```token sk-secretvalue```',
      'Bearer abcdefghijklmnop',
      '密码：e5f6a7b8',
      'api key: abc1234567',
      'SESSION_ID=abcdef1234567',
    ]) {
      assert.doesNotMatch(mask(text, zh), /secretvalue|abcdefghijklmnop|e5f6a7b8|abc1234567|abcdef1234567/u)
    }
  })
})

describe('the browser half', () => {
  it('carries the same rules, so the outbound pass does not depend on the host', async () => {
    const artifact = await readFile(join(root, 'lib', 'client.js'), 'utf8')
    // The bundle is what runs the send-time pass; a masked placeholder in it
    // is proof the rules rode along rather than being assumed on the page.
    // esbuild escapes non-ASCII in the bundle, so the check looks for the
    // escape alphabet rather than the characters themselves.
    assert.match(artifact, /u5DF2\\u8131\\u654F/u)
    assert.match(artifact, /已脱敏:邮箱|u90AE\\u7BB1/u)
    assert.match(artifact, /BEGIN \[A-Z \]\*PRIVATE KEY/u)
  })
})
