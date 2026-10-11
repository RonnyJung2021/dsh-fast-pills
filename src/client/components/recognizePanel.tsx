/**
 * AI 自主识别胶囊, the right-hand column of the settings tab.
 *
 * Everything this panel puts on screen lives here — the key window, the custom
 * prompt, the manual recognition button, and the confirmation list. Nothing is
 * stored until a suggestion is confirmed: the panel holds the model's
 * answer as local state, and a confirmation is the only path into the tree.
 *
 * The key is written through the host and never read back, and the
 * request body is masked as a whole before it leaves the page, so what a
 * confirmation list can never show is a secret the plugin failed to catch.
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import {
  DEEPSEEK_BASE_URL as DEFAULT_BASE_URL, DEFAULT_MAX_TOKENS, DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT, DEFAULT_TEMPERATURE, DEFAULT_TOP_P, MAX_TOKENS_MAX, MAX_TOKENS_MIN,
  TEMPERATURE_MAX, TEMPERATURE_MIN, TOP_P_MAX, TOP_P_MIN,
} from '../../shared/constants/index.ts'
import { REASONING_EFFORTS, type ReasoningEffort } from '../../shared/enums/index.ts'
import { maskLabels, translate } from '../../shared/locales/index.ts'
import { maskDeep } from '../../shared/utils/mask.ts'
import type {
  PillTree, RecognitionPreview, RecognitionPreviewPart, TranscriptEntry,
} from '../../shared/types/index.ts'
import { Action, Choice, Dialog, Section, TextField } from './controls.tsx'
import { formatDayShort, formatTime } from '../../shared/utils/localTime.ts'
import { PillForm, pillOf, type PillDraft, type WorkspaceChoice } from './pillForm.tsx'
import { useText } from '../contexts/textContext.ts'
import { usePrefs } from '../services/preferences.ts'
import { pillToText } from '../../shared/utils/pillRules.ts'
import { insertSuggestion, suggestionGroupNote } from '../../shared/utils/suggestions.ts'
import { newId } from '../../shared/utils/pillTree.ts'
import type { CredentialFacts, PillStore, PluginSettings, RouteError, TranscriptSummary } from '../services/pillStore.ts'

/** The four reasoning levels, and the words the control shows for each. */
const EFFORT_LABELS: Readonly<Record<ReasoningEffort, string>> = {
  none: 'recognize.reasoningNone',
  low: 'recognize.reasoningLow',
  high: 'recognize.reasoningHigh',
  max: 'recognize.reasoningMax',
}

/** The two halves of the request, as the preview groups them. */
const PREVIEW_GROUPS: readonly {
  readonly label: string
  readonly parts: readonly RecognitionPreviewPart[]
}[] = [
  { label: 'recognize.systemPrompt', parts: ['bundled'] },
  // 读者写的那段现在跟着用户消息走：它只是风格倾向，字段本身就比 system 低一档。
  { label: 'recognize.userMessage', parts: ['custom', 'transcript', 'pills'] },
]

/** What each block of the request is called on screen. */
const PREVIEW_LABELS: Readonly<Record<RecognitionPreviewPart, string>> = {
  bundled: 'recognize.bundledPrompt',
  custom: 'recognize.preferencesStyleOnly',
  transcript: 'recognize.sessionSRecords',
  pills: 'recognize.capsuleList',
}

/**
 * One stored instant, as a record row shows it: the local month-day and time.
 * @param at - the ISO instant the entry was stamped with.
 * @returns the label, or the raw value when it cannot be read.
 */
function formatMoment(at: string): string {
  const parsed = new Date(at)
  if (Number.isNaN(parsed.getTime())) return at
  return `${formatDayShort(parsed)} ${formatTime(parsed)}`
}

/** One suggestion the reader may still confirm or throw away. */
/**
 * One suggestion waiting to be confirmed.
 *
 * It carries a **draft in the same shape the capsule form edits** rather than a
 * hand-rolled copy of the fields: the recognition result reuses that form, so
 * what the reader adjusts here is exactly what a hand-added capsule adjusts.
 */
interface Pending {
  /** Position in the answer, so two identical names stay apart. */
  readonly key: number
  /** The capsule this suggestion would become. */
  readonly draft: PillDraft
  /** The group the model suggested, or `null` for a top-level capsule. */
  readonly group: string | null
  /** One line of reasoning the model offered. */
  readonly note: string
}

/**
 * The workspaces one suggestion may be limited to.
 *
 * The page's own list, plus any path the model named that the page does not know
 * — a suggestion is allowed to point at a directory the reader has not opened
 * yet, and a chip that is not offered cannot be switched off again.
 * @param entry - the pending suggestion.
 * @param known - the workspaces this page knows.
 * @returns the chips to offer.
 */
function scopeChoices(entry: Pending, known: readonly WorkspaceChoice[]): readonly WorkspaceChoice[] {
  const offered = new Set(known.map(choice => choice.path))
  const extra = entry.draft.scope
    .filter(path => !offered.has(path))
    .map(path => ({ name: path.split('/').filter(part => part.length > 0).pop() ?? path, path }))
  return [...known, ...extra]
}

/** Render the whole current tree the way the prompt describes it. */
function treeText(tree: PillTree): string {
  const lines: string[] = []
  for (const node of tree) {
    if (node.kind === 'pill') {
      lines.push(`${node.name} => ${pillToText(node)}`)
      continue
    }
    lines.push(`【${node.name}】`)
    for (const child of node.children) lines.push(`  ${child.name} => ${pillToText(child)}`)
  }
  return lines.join('\n')
}

/**
 * One field row: the name in the left column, the control filling the rest, and
 * the one-line explanation under the control where it belongs to that control.
 */
function Field({ label, hint, children }: {
  readonly label: string
  readonly hint?: string
  readonly children: JSX.Element
}): JSX.Element {
  return (
    <div className="dfp-field">
      <span className="dfp-field-label">{label}</span>
      <div className="dfp-field-body">
        {children}
        {hint !== undefined && <span className="dfp-field-note">{hint}</span>}
      </div>
    </div>
  )
}

/**
 * The AI recognition tab.
 * @param props.store - the page's one tree source.
 * @param props.workspaces - the workspaces this project knows, offered as scopes.
 * @returns the tab.
 */
export function RecognizePanel({ store, workspaces = [] }: {
  readonly store: PillStore
  readonly workspaces?: readonly WorkspaceChoice[]
}): JSX.Element {
  const t = useText()
  const prefs = usePrefs(store)
  // 预置偏好按读者自己的语言给：英文界面里填回去的是英文那一段。
  const seededPrompt = translate(prefs.locale, 'prompts.customDefault')
  const [facts, setFacts] = useState<CredentialFacts | undefined>(undefined)
  const [settings, setSettings] = useState<PluginSettings | undefined>(undefined)
  const [transcripts, setTranscripts] = useState<readonly TranscriptSummary[]>([])
  /** The session whose records are open, or nothing when all are folded. */
  const [openSession, setOpenSession] = useState('')
  /** The records read back for {@link openSession}. */
  const [records, setRecords] = useState<readonly TranscriptEntry[]>([])
  const [sessionId, setSessionId] = useState('')
  const [keyDraft, setKeyDraft] = useState('')
  const [promptDraft, setPromptDraft] = useState('')
  const [apiBaseDraft, setApiBaseDraft] = useState('')
  const [modelDraft, setModelDraft] = useState(DEFAULT_MODEL)
  const [temperatureDraft, setTemperatureDraft] = useState(String(DEFAULT_TEMPERATURE))
  const [topPDraft, setTopPDraft] = useState(String(DEFAULT_TOP_P))
  const [maxTokensDraft, setMaxTokensDraft] = useState(String(DEFAULT_MAX_TOKENS))
  const [effortDraft, setEffortDraft] = useState<ReasoningEffort>(DEFAULT_REASONING_EFFORT)
  const [savingKey, setSavingKey] = useState(false)
  /** Whether the reader is being asked to let the sync replace the key already stored. */
  const [confirmSync, setConfirmSync] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [running, setRunning] = useState(false)
  /** What a send would carry, once it has been assembled and not yet confirmed. */
  const [preview, setPreview] = useState<RecognitionPreview | undefined>(undefined)
  const [pending, setPending] = useState<readonly Pending[]>([])
  const [notice, setNotice] = useState('')
  /** Whether the notice is a refusal rather than a report; it reads in red. */
  const [noticeFailed, setNoticeFailed] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  /** Read the four things this tab shows. */
  const refresh = useCallback(async () => {
    const [nextFacts, nextSettings, sessions] = await Promise.all([
      store.credentialFacts(),
      store.readSettings(),
      store.transcripts(),
    ])
    setFacts(nextFacts)
    setTranscripts(sessions)
    setSessionId(current => (current.length > 0 && sessions.some(row => row.sessionId === current)
      ? current
      : sessions[0]?.sessionId ?? ''))
    if (nextSettings !== undefined) {
      setSettings(nextSettings)
      setPromptDraft(nextSettings.customPrompt)
      setApiBaseDraft(nextSettings.apiBase)
      setModelDraft(nextSettings.model)
      setTemperatureDraft(String(nextSettings.temperature))
      setTopPDraft(String(nextSettings.topP))
      setMaxTokensDraft(String(nextSettings.maxTokens))
      setEffortDraft(nextSettings.reasoningEffort)
    }
    return nextFacts
  }, [store])

  useEffect(() => { void refresh() }, [refresh])

  /** Open one session's records, or fold it again when it is already open. */
  const toggleSession = useCallback((id: string) => {
    setOpenSession(current => (current === id ? '' : id))
  }, [])

  // The records are read when a session is opened, not with the list: a long
  // transcript is only worth fetching once somebody asks to see it.
  useEffect(() => {
    if (openSession.length === 0) {
      setRecords([])
      return
    }
    let live = true
    void store.transcript(openSession).then((entries) => { if (live) setRecords(entries) })
    return () => { live = false }
  }, [openSession, store])

  const writeSettings = useCallback(async (patch: Partial<PluginSettings>) => {
    setSavingSettings(true)
    try {
      const next = await store.writeSettings(patch)
      if (next === undefined) {
        setNoticeFailed(true)
        setNotice(t('recognize.noticeSettingsUnsaved'))
      } else {
        setSettings(next)
        // 存进去的才算数：宿主可能把值收进它自己的范围（或整个字段不认识），
        // 这几格要显示**存下来的**那一份，而不是读者刚才敲的那一份。
        setEffortDraft(next.reasoningEffort)
        setTemperatureDraft(String(next.temperature))
        setTopPDraft(String(next.topP))
        setMaxTokensDraft(String(next.maxTokens))
      }
    } finally {
      setSavingSettings(false)
    }
  }, [store])

  const saveKey = useCallback(async () => {
    setSavingKey(true)
    setNotice('')
    setNoticeFailed(false)
    try {
      setFacts(await store.storeCredential(keyDraft))
      setKeyDraft('')
      setNotice(t('recognize.noticeKeyStored'))
    } catch (error) {
      setNoticeFailed(true)
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setSavingKey(false)
    }
  }, [keyDraft, store])

  /**
   * What the three sampling boxes hold, as numbers; an empty or unreadable box
   * is left out so the stored value stands.
   */
  const samplingPatch = useCallback(() => ({
    reasoningEffort: effortDraft,
    ...(temperatureDraft.trim().length > 0 && Number.isFinite(Number(temperatureDraft))
      ? { temperature: Number(temperatureDraft) } : {}),
    ...(topPDraft.trim().length > 0 && Number.isFinite(Number(topPDraft)) ? { topP: Number(topPDraft) } : {}),
    ...(maxTokensDraft.trim().length > 0 && Number.isFinite(Number(maxTokensDraft))
      ? { maxTokens: Number(maxTokensDraft) } : {}),
  }), [effortDraft, maxTokensDraft, temperatureDraft, topPDraft])

  /**
   * Whether the four editable fields differ from what is stored.
   *
   * The save button reads this, so a change to any of them — the sampling boxes
   * included — is what makes it pressable; before, only the key box could do it.
   */
  const edited = useMemo(() => {
    if (settings === undefined) return false
    const sampling = samplingPatch()
    return promptDraft !== settings.customPrompt
      || modelDraft !== settings.model
      || apiBaseDraft.trim() !== settings.apiBase
      || sampling.reasoningEffort !== settings.reasoningEffort
      || (sampling.temperature ?? settings.temperature) !== settings.temperature
      || (sampling.topP ?? settings.topP) !== settings.topP
      || (sampling.maxTokens ?? settings.maxTokens) !== settings.maxTokens
  }, [apiBaseDraft, modelDraft, promptDraft, samplingPatch, settings])

  /** Drop the stored key: nothing resolves until one is saved again. */
  const clearKey = useCallback(async () => {
    setSavingKey(true)
    setNotice('')
    setNoticeFailed(false)
    try {
      setFacts(await store.clearCredential())
      setKeyDraft('')
      setNotice(t('recognize.noticeKeyCleared'))
    } catch (error) {
      setNoticeFailed(true)
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setSavingKey(false)
    }
  }, [store, t])

  /** Copy the harness's own key in, so it does not have to be pasted twice. */
  const syncKey = useCallback(async () => {
    setSavingKey(true)
    setNotice('')
    setNoticeFailed(false)
    try {
      // 整份拷贝都在宿主那边完成：key 值不会经过页面，回答里只有事实与指纹。
      const synced = await store.syncCredential()
      setFacts(synced)
      setConfirmSync(false)
      setNotice(t('recognize.noticeKeySaved', {
        hint: synced.hint ?? t('recognize.none'),
      }))
    } catch (error) {
      setNoticeFailed(true)
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setSavingKey(false)
    }
  }, [store, t])

  /**
   * The request as it would leave, with masking already applied.
   *
   * Both steps below build it the same way, so what the preview shows is what
   * the confirmed send carries.
   */
  const requestBody = useCallback(() => {
    const apiBase = apiBaseDraft.trim()
    return maskDeep({
      sessionId,
      pills: store.getSnapshot().tree,
      customPrompt: promptDraft,
      model: modelDraft,
      // A blank endpoint is left out rather than sent as one: the host then
      // falls back to the stored setting, which is the official URL.
      ...(apiBase.length === 0 ? {} : { apiBase }),
    }, maskLabels(prefs.locale)).value as Parameters<PillStore['recognize']>[0]
  }, [apiBaseDraft, modelDraft, prefs.locale, promptDraft, sessionId, store])

  /** Assemble the request and show it; nothing leaves the machine yet. */
  const assemble = useCallback(async () => {
    // Two things stop a press before it assembles anything, and both say why:
    // without a key the send would fail anyway, and without a session
    // there is nothing to read.
    // 只有「发出去」那一步需要 key：拼预览不花任何东西，所以没配 key 时也让人先看一眼要发什么，
    // 真正发的时候才拦（那时候按钮就在旁边，说清为什么点不动）。
    if (facts?.configured === false && preview !== undefined) {
      setNoticeFailed(true)
      setNotice(t('recognize.noKeyCannotSend'))
      return
    }
    if (sessionId.length === 0) {
      setNotice(t('recognize.pickSession'))
      return
    }
    setRunning(true)
    setNotice('')
    setNoticeFailed(false)
    setPending([])
    try {
      setPreview(await store.previewRecognize(requestBody()))
    } catch (error) {
      const failure = error as RouteError
      // The host half is loaded once per engine process, so an engine that was
      // started before this build answers 404 for a route that exists in the
      // code. Say so rather than leaving the raw route name on screen.
      setNoticeFailed(true)
      setNotice(failure.code === 'not-found'
        ? t('recognize.hostRouteMissing')
        : failure.message)
    } finally {
      setRunning(false)
    }
  }, [facts, preview, requestBody, sessionId, store, t])

  /** Send the request the preview showed. */
  const recognize = useCallback(async () => {
    setRunning(true)
    setNotice('')
    setNoticeFailed(false)
    setPending([])
    try {
      const result = await store.recognize(requestBody())
      setPending(result.suggestions.map((suggestion, index) => ({
        key: index,
        draft: {
          name: suggestion.name,
          body: suggestion.body,
          skill: null,
          quick: suggestion.quick,
          // 这一版的建议一律「处处显示」：模型猜的路径噪音大于用處，限定仍可在胶囊树里手工加。
          scope: [],
        },
        group: suggestion.group,
        note: suggestion.note,
      })))
      setNotice(result.suggestions.length === 0
        ? t('recognize.resultEmpty', { model: result.model })
        : t('recognize.resultCount', {
          n: result.suggestions.length,
          model: result.model,
          masked: result.masked ? t('recognize.resultMaskedSuffix') : '',
        }))
    } catch (error) {
      const failure = error as RouteError
      setNoticeFailed(true)
      setNotice(failure.message)
    } finally {
      setRunning(false)
      setPreview(undefined)
    }
  }, [requestBody, store, t])

  // A draft that moves makes the assembled request stale: it goes, so the
  // preview on screen can never describe a send that is no longer the one.
  useEffect(() => {
    setPreview(undefined)
  }, [apiBaseDraft, maxTokensDraft, modelDraft, promptDraft, sessionId, temperatureDraft, topPDraft])

  /**
   * Rewrite one pending suggestion in place.
   *
   * A suggestion is a draft, not a verdict: the name is the word that will sit
   * on the button, the body is what a press will write, and the scope says where
   * it shows up — all three are the reader's to change before it enters the
   * tree. What the model wrote is only the starting point.
   */
  const editPending = useCallback((key: number, draft: PillDraft) => {
    setPending(current => current.map(entry => (entry.key === key ? { ...entry, draft } : entry)))
  }, [])

  const confirm = useCallback((entry: Pending) => {
    const tree = store.getSnapshot().tree
    // 和手工新建走同一条路：同一个 `pillOf`，所以「未命名」这类兜底也只有一处。
    const pill = pillOf(entry.draft, newId('pill'), t)
    void store.save(insertSuggestion(tree, pill, entry.group))
    setPending(current => current.filter(candidate => candidate.key !== entry.key))
  }, [store, t])

  const forget = useCallback(async (target?: string) => {
    await store.forgetTranscript(target)
    setConfirmClear(false)
    await refresh()
    setNotice(t(target === undefined ? 'recognize.everyRecordGone' : 'recognize.sessionSRecordsGone'))
  }, [refresh, store])

  const keyHint = useMemo(() => {
    if (facts === undefined) return t('recognize.keyChecking')
    if (!facts.configured) return t('recognize.noKeyNoRequest')
    if (!facts.writable) return t('recognize.keyFromSource', { source: facts.source ?? t('recognize.environment') })
    return t('recognize.keyInDataDir', {
      hint: facts.hint ?? t('recognize.none'),
    })
  }, [facts])

  return (
    <div className="dfp-stack">
      {/* 这一页做什么，进来先说一句：它会读什么、遮什么、给你什么、由谁决定入树。 */}
      <p className="dfp-ai-intro">
        {t('recognize.tabLead')}
      </p>

      {/* 用之前先把四件事说清楚：发到哪里、测过什么、key 放在哪、谁负责确认内容。 */}
      <div className="dfp-ai-disclaimer" data-ai-disclaimer="true">
        <span className="dfp-ai-disclaimer-title">{t('recognize.beforeUse')}</span>
        <ol className="dfp-ai-disclaimer-list">
          <li>{t('recognize.noticeSend')}</li>
          <li>{t('recognize.noticeVerified')}</li>
          <li>{t('recognize.noticeKeyOrigin')}</li>
          <li>{t('recognize.noticeMasking')}</li>
        </ol>
      </div>

      <Section index="01" title="DeepSeek">
        <div className="dfp-fields">
          {facts?.writable === false ? null : (
            <Field label="API key" hint={t('recognize.keyStoreNote')}>
              <div className="dfp-key-row">
                <TextField
                  type="password"
                  value={keyDraft}
                  placeholder={facts?.configured === true ? t('recognize.keyAlreadySet') : 'sk-…'}
                  onChange={event => { setKeyDraft(event.currentTarget.value) }}
                />
                {/* 两颗按钮都只动输入框：同步把 DSH 那把填进来，清空把已存的删掉。 */}
                {facts?.syncable !== true ? null : (
                  <Action
                    disabled={savingKey}
                    onClick={() => {
                      // 已经存着一把时，先确认「用 DSH 的那把覆盖」——同步现在直接落盘，
                      // 不像以前那样先填进框里让人看一眼。
                      if (facts?.configured === true) setConfirmSync(true)
                      else void syncKey()
                    }}
                  >
                    {t('recognize.syncDshSKey')}
                  </Action>
                )}
                <Action
                  disabled={savingKey || facts?.configured !== true}
                  onClick={() => { void clearKey() }}
                >
                  {t('editor.clear')}
                </Action>
              </div>
            </Field>
          )}
          <Field label={t('recognize.model')} hint={t('recognize.modelNote')}>
            <TextField value={modelDraft} onChange={event => { setModelDraft(event.currentTarget.value) }} />
          </Field>
          <Field label={t('recognize.endpoint')} hint={t('recognize.endpointNote', { url: DEFAULT_BASE_URL })}>
            <TextField value={apiBaseDraft} onChange={event => { setApiBaseDraft(event.currentTarget.value) }} />
          </Field>
          <Field label={t('recognize.preferencesStyleOnly')} hint={t('recognize.customPromptNote')}>
            <textarea
              className="dfp-body-input dfp-prompt-input"
              rows={8}
              value={promptDraft}
              placeholder={t('recognize.eGOurProjectRunSmoke')}
              onChange={event => { setPromptDraft(event.currentTarget.value) }}
            />
          </Field>
        </div>
          {/* 取样参数收在一折里：默认值就是「更确定」的那一档，多数人不必打开。 */}
          <details className="dfp-more">
            <summary className="dfp-more-summary">
              {t('recognize.moreSettingsSampling')}
              <span className="dfp-more-now">
                {t('recognize.moreNow', { effort: t(EFFORT_LABELS[effortDraft]), temperature: temperatureDraft })}
              </span>
            </summary>
            <p className="dfp-field-note">
              {t('recognize.samplingNote')}
            </p>
            <Field label={t('recognize.reasoningLabel')} hint={t('recognize.reasoningNote')}>
              <Choice<ReasoningEffort>
                value={effortDraft}
                options={REASONING_EFFORTS.map(id => ({ value: id, label: t(EFFORT_LABELS[id]) }))}
                onChange={setEffortDraft}
                label={t('recognize.reasoningLabel')}
              />
            </Field>
            {/* 三支取样参数里有两支要看推理这一档：写在它们**上面**，读者先读到这句再改数字。 */}
            <p className="dfp-field-note dfp-more-caveat" data-thinking={effortDraft === 'none' ? 'off' : 'on'}>
              {t(effortDraft === 'none' ? 'recognize.samplingPlainNote' : 'recognize.samplingThinkingNote')}
            </p>
            <div className="dfp-more-fields">
              <Field label="temperature" hint={t('recognize.temperatureNote', { low: TEMPERATURE_MIN, high: TEMPERATURE_MAX, d: DEFAULT_TEMPERATURE })}>
                <TextField
                  type="number"
                  min={TEMPERATURE_MIN}
                  max={TEMPERATURE_MAX}
                  step="0.1"
                  value={temperatureDraft}
                  onChange={event => { setTemperatureDraft(event.currentTarget.value) }}
                />
              </Field>
              <Field label="top_p" hint={t('recognize.topPNote', { low: TOP_P_MIN, high: TOP_P_MAX, d: DEFAULT_TOP_P })}>
                <TextField
                  type="number"
                  min={TOP_P_MIN}
                  max={TOP_P_MAX}
                  step="0.05"
                  value={topPDraft}
                  onChange={event => { setTopPDraft(event.currentTarget.value) }}
                />
              </Field>
              <Field label="max_tokens" hint={t('recognize.maxTokensNote', { low: MAX_TOKENS_MIN, high: MAX_TOKENS_MAX, d: DEFAULT_MAX_TOKENS })}>
                <TextField
                  type="number"
                  min={MAX_TOKENS_MIN}
                  max={MAX_TOKENS_MAX}
                  step="1"
                  value={maxTokensDraft}
                  onChange={event => { setMaxTokensDraft(event.currentTarget.value) }}
                />
              </Field>
            </div>
          </details>

        <div className="dfp-form-actions">
          {facts?.writable === false ? null : (
            <Action variant="primary" disabled={savingKey || keyDraft.trim().length === 0} onClick={() => { void saveKey() }}>
              {t(savingKey ? 'recognize.saving' : 'recognize.saveKey')}
            </Action>
          )}

          <Action
            disabled={savingSettings || !edited}
            onClick={() => {
              void writeSettings({
                customPrompt: promptDraft,
                model: modelDraft,
                // Blank means the official endpoint: the host's field rule
                // rejects an empty string and puts the default back.
                apiBase: apiBaseDraft.trim(),
                // A box left empty or typed over its bounds keeps the stored
                // value: the host's own field rules answer the same way.
                ...samplingPatch(),
                ...(settings === undefined ? {} : { provider: settings.provider }),
              })
            }}
          >
            {t(savingSettings ? 'recognize.saving' : 'recognize.savePromptModel')}
          </Action>
          <Action
            disabled={promptDraft === seededPrompt}
            onClick={() => { setPromptDraft(seededPrompt) }}
          >
            {t('recognize.restoreSeededPrompt')}
          </Action>
          <span className="dfp-field-note">{keyHint}</span>
        </div>
      </Section>

      <Section index="02" title={t('recognize.sessionRecords')}>
        <p className="dfp-quiet">{t('recognize.transcriptSummary', { n: transcripts.length })}</p>
        <div className="dfp-ai-list">
          {transcripts.length === 0
            ? <p className="dfp-quiet">{t('recognize.transcriptEmpty')}</p>
            : transcripts.map(row => (
              <div className="dfp-ai-session-block" key={row.sessionId} data-session={row.sessionId}>
                <div className="dfp-ai-session">
                  <button
                    type="button"
                    className="dfp-ai-session-pick"
                    aria-expanded={openSession === row.sessionId}
                    aria-pressed={row.sessionId === sessionId}
                    onClick={() => {
                      // One press both picks the session and opens its records:
                      // the one you are looking at is the one you mean.
                      setSessionId(row.sessionId)
                      toggleSession(row.sessionId)
                    }}
                  >
                    <span
                      className="dfp-ai-session-arrow"
                      data-open={openSession === row.sessionId ? 'true' : 'false'}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                    {t('recognize.sessionNRows', { session: row.sessionId, n: row.count })}
                  </button>
                  <Action variant="outline" onClick={() => { void forget(row.sessionId) }}>{t('recognize.clearSession')}</Action>
                </div>

                {openSession === row.sessionId && (
                  <ol className="dfp-ai-records" data-session-records={row.sessionId}>
                    {records.length === 0
                      ? <li className="dfp-quiet">{t('recognize.sessionCouldReadBack')}</li>
                      : records.map((entry, position) => (
                        <li className="dfp-ai-record" key={`${entry.at}-${String(position)}`}>
                          <span className="dfp-ai-record-meta">
                            <span>{formatMoment(entry.at)}</span>
                            <span>{entry.workspace.length === 0 ? t('recognize.unknownDirectory') : entry.workspace}</span>
                          </span>
                          <span className="dfp-ai-record-text">{entry.text}</span>
                        </li>
                      ))}
                  </ol>
                )}
              </div>
            ))}
        </div>
        <div className="dfp-form-actions">
          <Action variant="outline" disabled={transcripts.length === 0} onClick={() => { setConfirmClear(true) }}>
            {t('recognize.clearEveryRecord')}
          </Action>
        </div>
      </Section>

      <Section index="03" title={t('⚡Super Pillls')}>
        <p className="dfp-field-note">
          {t('recognize.introAssemble')}
        </p>
        <div className="dfp-form-actions">
          <Action
            variant="primary"
            disabled={running}
            onClick={() => { void assemble() }}
          >
            {t('⚡Super Pillls')}
          </Action>
          {/* 拼出来之后的第二步就在第一步旁边：看完那两段，接着按这一颗发出去。
              跑起来的那句话只写在**这一颗**上：左边那颗只是按不动，字不该跟着变。 */}
          {preview !== undefined && (
            <Action
              variant="primary"
              disabled={running || facts?.configured !== true}
              onClick={() => { void recognize() }}
            >
              {running && <span className="dfp-spinner" aria-hidden="true" />}
              {t(running ? 'recognize.modelThinking' : 'recognize.send')}
            </Action>
          )}
        </div>

        {preview !== undefined && (
          <div className="dfp-ai-preview" data-ai-preview="preview">
            <p className="dfp-quiet">
              {t('recognize.previewLead')}
            </p>
            <div className="dfp-ai-preview-groups">
              {PREVIEW_GROUPS.map(group => {
                const blocks = preview.blocks.filter(block => group.parts.includes(block.part))
                if (blocks.length === 0) return null
                return (
                  <section className="dfp-ai-preview-group" key={group.label} data-ai-group={group.label}>
                    <h5 className="dfp-ai-preview-heading">{t(group.label)}</h5>
                    {blocks.map(block => (
                      <div className="dfp-ai-preview-part" key={block.part} data-ai-part={block.part}>
                        <span className="dfp-ai-preview-label">{t(PREVIEW_LABELS[block.part])}</span>
                        {block.heading.length > 0 && <span className="dfp-ai-preview-label">{block.heading}</span>}
                        <pre className="dfp-ai-prompt" data-ai-prompt={block.part}>{block.text}</pre>
                      </div>
                    ))}
                  </section>
                )
              })}

              <section className="dfp-ai-preview-group" data-ai-group="route">
                <h5 className="dfp-ai-preview-heading">{t('recognize.goes')}</h5>
                <pre className="dfp-ai-prompt" data-ai-prompt="route">{`${preview.model}\n${t('recognize.reasoningValue', { effort: t(EFFORT_LABELS[preview.reasoningEffort]) })}\n${preview.apiBase}\n${preview.masked ? t('recognize.previewMasked') : t('recognize.previewUnmasked')}`}</pre>
              </section>
            </div>

          </div>
        )}

        {notice.length > 0 && (
          <p className="dfp-ai-notice" data-ai-notice={noticeFailed ? 'failed' : 'ok'}>{notice}</p>
        )}
      </Section>

      <Section index="04" title={pending.length === 0
            ? t('recognize.suggestedCapsules')
            : t('recognize.suggestionsTitle', { n: pending.length })}>
        {pending.length === 0
          ? <p className="dfp-quiet">{t('recognize.suggestionsEmpty')}</p>
          : pending.map(entry => (
            <div className="dfp-ai-suggestion" key={entry.key} data-suggestion={entry.draft.name}>
              {/* 一块建议就是一颗还没入树的胶囊，所以这里**直接用新建胶囊那张表单**：
                  名字、写入什么、快速自发送、限定工作区四处，读者改的就是它入树后的样子。 */}
              <PillForm
                draft={entry.draft}
                editing={false}
                showScope={false}
                workspaces={scopeChoices(entry, workspaces)}
                sessionId={sessionId}
                onDraft={draft => { editPending(entry.key, draft) }}
                onSave={() => { confirm(entry) }}
                onCancel={() => { setPending(current => current.filter(candidate => candidate.key !== entry.key)) }}
              />
              {entry.note.length > 0 && <p className="dfp-quiet">{entry.note}</p>}
              <p className="dfp-quiet" data-group-note={entry.draft.name}>
                {suggestionGroupNote(store.getSnapshot().tree, entry.group, t)}
              </p>
            </div>
          ))}
      </Section>

      <Dialog
        open={confirmSync}
        onClose={() => { setConfirmSync(false) }}
        title={t('recognize.replaceStoredKeyDshS')}
        description={t('recognize.overwriteNote', {
          hint: facts?.hint ?? t('recognize.none'),
        })}
        footer={(
          <>
            <Action variant="outline" onClick={() => { setConfirmSync(false) }}>{t('form.cancel')}</Action>
            <Action variant="primary" onClick={() => { void syncKey() }}>{t('recognize.replace')}</Action>
          </>
        )}
      />

      <Dialog
        open={confirmClear}
        onClose={() => { setConfirmClear(false) }}
        title={t('recognize.clearEveryRecord')}
        description={t('recognize.clearAllConfirm', {
          sessions: transcripts.length,
          rows: transcripts.reduce((sum, row) => sum + row.count, 0),
        })}
        footer={(
          <>
            <Action variant="outline" onClick={() => { setConfirmClear(false) }}>{t('form.cancel')}</Action>
            <Action variant="primary" onClick={() => { void forget() }}>{t('editor.clear')}</Action>
          </>
        )}
      />

      {/* 最下方一条：许可与责任。许可本身写在仓库的 LICENSE 里，这里只说「按现状提供」。 */}
      <p className="dfp-ai-footnote" data-ai-footnote="true">
        {t('recognize.noticeLicence')}
      </p>
    </div>
  )
}
