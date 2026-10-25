// CHRONOMATOR - the shared client tracker (contract section 13; Darren, 19 Oct 2026).
//
// Framework-free, consumed by every AmacrA application and plugin the way
// @amacra/documator/editor is. It knows nothing of any one app: the app says
// which record is on screen (a claim), feeds it the person's input through
// the page's own events, and supplies the ONE function that reports a
// finished session to the app's server - which holds the platform token and
// issues the subject proof. Nothing here is a second copy of a session.
//
// ONE SESSION AT A TIME. A surface claims the person's attention - a record
// page, a document editor inside it, a composer - and the most specific
// (latest) claim wins, so time is never counted twice. A session counts
// ACTIVE SECONDS only: a second is added while the surface is visible and the
// person has touched, typed, scrolled or pointed within the idle cut-off; an
// idle gap is not work. It is reported when the claim ends, the page hides or
// the person goes idle; what is reported is a FACT and is never edited - the
// session simply continues under a new source key.

export const EFFORT_CHANNELS = Object.freeze(['call', 'writing', 'reading', 'doing', 'travel'])
export const EFFORT_LEGS = Object.freeze(['to', 'on_site', 'back'])
/** Provisional ruling (Darren to confirm): no input for two minutes is idle. The platform accepts 30 s to 1 h. */
export const IDLE_CUTOFF_SECONDS = 120
/** A session shorter than this is a glance, not work, and is not reported. */
export const MIN_REPORTED_SECONDS = 5
/** The platform keeps at most this many actions on one session. */
export const MAX_ACTIONS = 500
const ACTIVITY_EVENTS = Object.freeze(['pointerdown', 'keydown', 'scroll', 'touchstart', 'input', 'wheel'])
const KEY = /^[a-z][a-z0-9_-]{0,63}$/

/** Seconds as h:mm:ss - the one way a tally is written. Display rounds; storage never does. */
export const formatSeconds = (seconds) => {
  const whole = Math.max(0, Math.round(Number(seconds) || 0))
  const hours = Math.floor(whole / 3600), minutes = Math.floor((whole % 3600) / 60), rest = whole % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const fallbackUuid = () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16 >> (Number(c) / 4))).toString(16))

const validClaim = (claim) => {
  if (!claim || typeof claim !== 'object') throw new TypeError('An effort claim names a recordKind, recordId, surface and channel.')
  const { recordKind, recordId, surface, channel } = claim
  if (typeof recordKind !== 'string' || !KEY.test(recordKind)) throw new TypeError('recordKind must be a brand-free key (a-z, 0-9, _ -).')
  if (typeof recordId !== 'string' || !recordId.trim() || recordId.length > 200) throw new TypeError('recordId is required.')
  if (typeof surface !== 'string' || !KEY.test(surface)) throw new TypeError('surface must be a brand-free key (a-z, 0-9, _ -).')
  if (!EFFORT_CHANNELS.includes(channel)) throw new TypeError('channel must be one of call, writing, reading, doing, travel.')
  return { recordKind, recordId: recordId.trim(), surface, channel }
}

const sameClaim = (a, b) => a.recordKind === b.recordKind && a.recordId === b.recordId && a.surface === b.surface && a.channel === b.channel

/**
 * Create a tracker. `report(session, { keepalive })` is the application's: it
 * posts the session to the app's own server (keepalive = the page is going
 * away, so the request must outlive the document). `env` lets a test, or a
 * non-browser host, supply the clock, timers, window and document.
 */
export const createEffortTracker = (options) => {
  if (!options || typeof options.report !== 'function') throw new TypeError('createEffortTracker needs a report(session, { keepalive }) function.')
  const idleCutoffSeconds = Number.isInteger(options.idleCutoffSeconds) ? options.idleCutoffSeconds : IDLE_CUTOFF_SECONDS
  if (idleCutoffSeconds < 30 || idleCutoffSeconds > 3600) throw new TypeError('idleCutoffSeconds must be between 30 and 3600.')
  const minReportedSeconds = Number.isInteger(options.minReportedSeconds) ? options.minReportedSeconds : MIN_REPORTED_SECONDS
  const globalWindow = typeof window === 'undefined' ? undefined : window
  const globalDocument = typeof document === 'undefined' ? undefined : document
  const env = {
    now: () => Date.now(),
    randomUUID: () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function' ? globalThis.crypto.randomUUID() : fallbackUuid()),
    setInterval: (handler, ms) => globalThis.setInterval(handler, ms),
    clearInterval: (id) => globalThis.clearInterval(id),
    window: globalWindow,
    document: globalDocument,
    ...(options.env ?? {}),
  }

  const claims = []
  let live = null
  let nextClaimId = 1
  let ticker = null
  let listening = false
  let lastInputAt = env.now()

  const visible = () => !env.document || env.document.visibilityState !== 'hidden'
  const active = () => visible() && env.now() - lastInputAt < idleCutoffSeconds * 1000

  const deliver = (session, keepalive) => {
    try {
      const outcome = options.report(session, { keepalive })
      if (outcome && typeof outcome.catch === 'function') outcome.catch(() => undefined)
    } catch { /* a failed report never breaks the page; the next flush stands on its own */ }
  }

  /** Report what the live session has counted so far; it continues under a new key. */
  const flush = (keepalive = false) => {
    const session = live
    if (!session) return null
    const endedAt = env.now()
    const span = Math.max(0, Math.round((endedAt - session.startedAt) / 1000))
    const activeSeconds = Math.min(session.activeSeconds, span + 1)
    let reported = null
    if (activeSeconds >= minReportedSeconds) {
      reported = {
        sourceKey: session.sourceKey, surface: session.claim.surface, recordKind: session.claim.recordKind, recordId: session.claim.recordId,
        channel: session.claim.channel, startedAt: new Date(session.startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(),
        activeSeconds, idleCutoffSeconds, actions: session.actions.slice(0, MAX_ACTIONS),
      }
      deliver(reported, keepalive)
    }
    live = { ...session, sourceKey: env.randomUUID(), startedAt: endedAt, activeSeconds: 0, actions: [], idleReported: false }
    return reported
  }

  const start = (claim) => { live = { claim, sourceKey: env.randomUUID(), startedAt: env.now(), activeSeconds: 0, actions: [], idleReported: false } }

  const tick = () => {
    if (!live) return
    if (active()) { live.activeSeconds += 1; live.idleReported = false }
    // The moment the person goes idle, what they did so far is reported; the
    // idle stretch itself is never counted and the session simply resumes.
    else if (!live.idleReported) { flush(); if (live) live.idleReported = true }
  }

  const settle = () => {
    const top = claims.length ? claims[claims.length - 1].claim : null
    if (live && (!top || !sameClaim(live.claim, top))) { flush(); live = null }
    if (top && !live) start(top)
    if (live && ticker === null) ticker = env.setInterval(tick, 1000)
    if (!live && ticker !== null) { env.clearInterval(ticker); ticker = null }
  }

  const touched = () => { lastInputAt = env.now() }
  const listen = () => {
    if (listening) return
    listening = true
    if (env.window && typeof env.window.addEventListener === 'function') {
      for (const event of ACTIVITY_EVENTS) env.window.addEventListener(event, touched, { passive: true, capture: true })
      env.window.addEventListener('pagehide', () => flush(true))
    }
    if (env.document && typeof env.document.addEventListener === 'function') {
      env.document.addEventListener('visibilitychange', () => { if (env.document.visibilityState === 'hidden') flush(true) })
    }
  }

  /** A surface claims the person's attention for a record; the most specific claim wins. Returns the release. */
  const claim = (input) => {
    const valid = validClaim(input)
    listen()
    const id = nextClaimId++
    claims.push({ id, claim: valid })
    settle()
    let released = false
    return () => {
      if (released) return
      released = true
      const index = claims.findIndex((entry) => entry.id === id)
      if (index >= 0) claims.splice(index, 1)
      settle()
    }
  }

  /** Something happened inside the live session - a save, a step, a send - attached by id. */
  const recordAction = (kind, ref) => {
    if (!live || typeof kind !== 'string' || !kind.trim() || live.actions.length >= MAX_ACTIONS) return false
    const action = { kind: kind.trim(), at: new Date(env.now()).toISOString() }
    if (typeof ref === 'string' && ref) action.ref = ref
    live.actions.push(action)
    return true
  }

  /** The person's input, for hosts that do not route it through the window's events. */
  const noteActivity = () => touched()

  /** What is live right now - for the app's own display and for tests. */
  const snapshot = () => live ? { claim: { ...live.claim }, activeSeconds: live.activeSeconds, actions: live.actions.length, sourceKey: live.sourceKey } : null

  /** Forget every claim and session without reporting (a test seam, or a sign-out). */
  const reset = () => { claims.length = 0; live = null; if (ticker !== null) { env.clearInterval(ticker); ticker = null } }

  return Object.freeze({ claim, recordAction, noteActivity, flush: () => flush(false), tick, snapshot, reset })
}
