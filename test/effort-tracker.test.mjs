import test from 'node:test'
import assert from 'node:assert/strict'
import { createEffortTracker, formatSeconds, EFFORT_CHANNELS, EFFORT_LEGS, IDLE_CUTOFF_SECONDS, MIN_REPORTED_SECONDS, MAX_ACTIONS } from '../src/effort-tracker.mjs'

/** A page the test controls: the clock, the timer, the window's input events and the document's visibility. */
const page = (options = {}) => {
  const state = { now: 1_000_000_000, keys: 0, timers: new Map(), listeners: { window: new Map(), document: new Map() } }
  const on = (where) => (type, listener) => { if (!state.listeners[where].has(type)) state.listeners[where].set(type, []); state.listeners[where].get(type).push(listener) }
  const document = { visibilityState: 'visible', addEventListener: on('document') }
  const window = { addEventListener: on('window') }
  const reports = []
  const tracker = createEffortTracker({
    report: options.report ?? ((session, context) => { reports.push({ ...session, keepalive: context.keepalive }) }),
    ...(options.tracker ?? {}),
    env: { now: () => state.now, randomUUID: () => `key-${++state.keys}`, setInterval: (fn) => { const id = state.timers.size + 1; state.timers.set(id, fn); return id }, clearInterval: (id) => state.timers.delete(id), window, document },
  })
  const fire = (where, type) => { for (const listener of state.listeners[where].get(type) ?? []) listener() }
  /** Let seconds pass, one tick each; with input, the person touches the page every second. */
  const pass = (seconds, { input = true } = {}) => { for (let i = 0; i < seconds; i++) { state.now += 1000; if (input) fire('window', 'pointerdown'); for (const fn of state.timers.values()) fn() } }
  return { tracker, reports, state, document, fire, pass }
}
const PAGE = { recordKind: 'property', recordId: 'p-1', surface: 'property-summary', channel: 'reading' }
const EDITOR = { recordKind: 'property', recordId: 'p-1', surface: 'document-editor', channel: 'writing' }

test('a tally is written as h:mm:ss, to the second', () => {
  assert.equal(formatSeconds(0), '0:00:00')
  assert.equal(formatSeconds(59), '0:00:59')
  assert.equal(formatSeconds(1330), '0:22:10')
  assert.equal(formatSeconds(3600 * 5 + 61), '5:01:01')
  assert.equal(formatSeconds(-4), '0:00:00')
  assert.equal(formatSeconds(2.6), '0:00:03', 'display rounds; storage never does')
})

test('the rulings are the constants every app reads', () => {
  assert.deepEqual([...EFFORT_CHANNELS], ['call', 'writing', 'reading', 'doing', 'travel'])
  assert.deepEqual([...EFFORT_LEGS], ['to', 'on_site', 'back'])
  assert.equal(IDLE_CUTOFF_SECONDS, 120, 'provisional idle ruling: two minutes')
  assert.equal(MIN_REPORTED_SECONDS, 5, 'a glance is not work')
  assert.equal(MAX_ACTIONS, 500)
})

test('a session counts active, visible seconds only and is reported the moment the person goes idle', () => {
  const p = page()
  const release = p.tracker.claim(PAGE)
  p.pass(10)
  assert.equal(p.tracker.snapshot().activeSeconds, 10)
  p.pass(119, { input: false })
  assert.equal(p.reports.length, 0, 'still within the idle cut-off')
  assert.equal(p.tracker.snapshot().activeSeconds, 10 + 119, 'seconds inside the cut-off count: the person may be reading')
  p.pass(1, { input: false })
  assert.equal(p.reports.length, 1, 'the first idle second reports what was counted')
  assert.equal(p.reports[0].activeSeconds, 129)
  assert.equal(p.reports[0].keepalive, false)
  p.pass(300, { input: false })
  assert.equal(p.reports.length, 1, 'the idle stretch itself is never counted or reported')
  assert.equal(p.tracker.snapshot().activeSeconds, 0)
  p.pass(6)
  release()
  assert.equal(p.reports.length, 2, 'the session resumed under a new key when input returned')
  assert.equal(p.reports[1].activeSeconds, 6)
  assert.notEqual(p.reports[0].sourceKey, p.reports[1].sourceKey)
  assert.equal(p.tracker.snapshot(), null)
  assert.equal(p.state.timers.size, 0, 'no ticker runs without a claim')
})

test('a hidden page stops counting and reports with keepalive', () => {
  const p = page()
  p.tracker.claim(PAGE)
  p.pass(8)
  p.document.visibilityState = 'hidden'
  p.fire('document', 'visibilitychange')
  assert.equal(p.reports.length, 1)
  assert.equal(p.reports[0].activeSeconds, 8)
  assert.equal(p.reports[0].keepalive, true, 'a page going away gets one last chance to report')
  p.pass(30)
  assert.equal(p.tracker.snapshot().activeSeconds, 0, 'nothing counts while hidden, whatever the input')
  p.document.visibilityState = 'visible'
  p.pass(7)
  p.fire('window', 'pagehide')
  assert.equal(p.reports.length, 2)
  assert.equal(p.reports[1].activeSeconds, 7)
  assert.equal(p.reports[1].keepalive, true)
})

test('one claim at a time: the most specific surface wins and time is never counted twice', () => {
  const p = page()
  const releasePage = p.tracker.claim(PAGE)
  p.pass(6)
  const releaseEditor = p.tracker.claim(EDITOR)
  assert.equal(p.reports.length, 1, 'the page session is reported when the editor takes over')
  assert.equal(p.reports[0].surface, 'property-summary')
  assert.equal(p.reports[0].channel, 'reading')
  assert.equal(p.reports[0].activeSeconds, 6)
  assert.deepEqual(p.tracker.snapshot().claim, EDITOR)
  p.pass(7)
  releaseEditor()
  assert.equal(p.reports.length, 2)
  assert.equal(p.reports[1].surface, 'document-editor')
  assert.equal(p.reports[1].channel, 'writing')
  assert.equal(p.reports[1].activeSeconds, 7)
  assert.deepEqual(p.tracker.snapshot().claim, PAGE, 'the page resumes under a new session')
  assert.equal(p.tracker.snapshot().activeSeconds, 0)
  p.pass(3)
  releasePage()
  releasePage()
  assert.equal(p.reports.length, 2, 'three seconds is a glance, not work; releasing twice is harmless')
  assert.equal(p.reports.reduce((sum, report) => sum + report.activeSeconds, 0), 13)
})

test('a report carries the platform session shape, and actions attach to the live session by id', () => {
  const p = page()
  assert.equal(p.tracker.recordAction('save', 'doc-1'), false, 'nothing live, nothing to attach to')
  const release = p.tracker.claim(EDITOR)
  p.pass(4)
  assert.equal(p.tracker.recordAction('save', 'doc-1'), true)
  p.pass(4)
  assert.equal(p.tracker.recordAction('  ', 'doc-1'), false, 'an action names its kind')
  release()
  const [report] = p.reports
  assert.deepEqual(Object.keys(report).sort(), ['actions', 'activeSeconds', 'channel', 'endedAt', 'idleCutoffSeconds', 'keepalive', 'recordId', 'recordKind', 'sourceKey', 'startedAt', 'surface'])
  assert.equal(report.recordKind, 'property'); assert.equal(report.recordId, 'p-1'); assert.equal(report.idleCutoffSeconds, 120)
  assert.equal(report.startedAt, new Date(1_000_000_000).toISOString())
  assert.equal(report.endedAt, new Date(1_000_008_000).toISOString())
  assert.ok(report.activeSeconds <= 8 + 1, 'active seconds never exceed the span (one second of skew tolerated)')
  assert.deepEqual(report.actions, [{ kind: 'save', at: new Date(1_000_004_000).toISOString(), ref: 'doc-1' }])
})

test('actions are capped where the platform caps them', () => {
  const p = page()
  const release = p.tracker.claim(EDITOR)
  p.pass(6)
  for (let i = 0; i < MAX_ACTIONS + 20; i++) p.tracker.recordAction('step', `s-${i}`)
  assert.equal(p.tracker.snapshot().actions, MAX_ACTIONS)
  release()
  assert.equal(p.reports[0].actions.length, MAX_ACTIONS)
})

test('a claim is validated: brand-free keys and a known channel', () => {
  const p = page()
  assert.throws(() => p.tracker.claim({ ...PAGE, channel: 'typing' }), /channel/)
  assert.throws(() => p.tracker.claim({ ...PAGE, surface: 'Document Editor' }), /surface/)
  assert.throws(() => p.tracker.claim({ ...PAGE, recordKind: 'Property' }), /recordKind/)
  assert.throws(() => p.tracker.claim({ ...PAGE, recordId: '' }), /recordId/)
  assert.throws(() => createEffortTracker({ report: () => {}, idleCutoffSeconds: 29 }), /idleCutoffSeconds/)
  assert.throws(() => createEffortTracker({}), /report/)
  assert.equal(p.tracker.snapshot(), null, 'a refused claim claims nothing')
})

test('the application chooses its idle cut-off within the platform bounds, and its reporter may fail quietly', () => {
  const failures = []
  const p = page({ report: (session) => { failures.push(session.activeSeconds); return Promise.reject(new Error('offline')) }, tracker: { idleCutoffSeconds: 60 } })
  p.tracker.claim(PAGE)
  p.pass(5)
  p.pass(60, { input: false })
  assert.deepEqual(failures, [64], 'reported at the 60 s cut-off; the rejection is swallowed')
  const q = page({ report: () => { throw new Error('boom') } })
  const release = q.tracker.claim(PAGE)
  q.pass(6)
  assert.doesNotThrow(release)
  assert.equal(q.reports.length, 0)
})

test('a host without a window reports through noteActivity, and reset forgets everything without reporting', () => {
  const reports = []
  const now = { value: 5_000_000 }
  const tracker = createEffortTracker({ report: (session) => reports.push(session), env: { now: () => now.value, setInterval: () => 1, clearInterval: () => {}, window: undefined, document: undefined } })
  tracker.claim(PAGE)
  for (let i = 0; i < 6; i++) { now.value += 1000; tracker.noteActivity(); tracker.tick() }
  assert.equal(tracker.snapshot().activeSeconds, 6)
  tracker.reset()
  assert.equal(tracker.snapshot(), null)
  assert.equal(reports.length, 0)
  assert.equal(tracker.flush(), null)
})
