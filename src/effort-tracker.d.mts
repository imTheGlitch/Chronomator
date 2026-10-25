// Chronomator: the shared client tracker (contract section 13). Types only.
export type EffortChannel = 'call' | 'writing' | 'reading' | 'doing' | 'travel'
export type EffortLeg = 'to' | 'on_site' | 'back'
export const EFFORT_CHANNELS: readonly EffortChannel[]
export const EFFORT_LEGS: readonly EffortLeg[]
/** Provisional ruling (Darren to confirm): no input for two minutes is idle. */
export const IDLE_CUTOFF_SECONDS: 120
/** A session shorter than this is a glance, not work, and is not reported. */
export const MIN_REPORTED_SECONDS: 5
export const MAX_ACTIONS: 500
/** Seconds as h:mm:ss - the one way a tally is written. */
export function formatSeconds(seconds: number): string

/** A surface's claim on the person's attention for one record. Keys are brand-free (a-z, 0-9, _ -). */
export type EffortClaim = { recordKind: string; recordId: string; surface: string; channel: EffortChannel }
export type EffortAction = { kind: string; ref?: string; at: string }
/** One finished session, as the application's server receives it and forwards it to the platform. */
export type EffortSessionReport = {
  sourceKey: string; surface: string; recordKind: string; recordId: string; channel: EffortChannel
  startedAt: string; endedAt: string; activeSeconds: number; idleCutoffSeconds: number; actions: EffortAction[]
}
export type EffortTrackerEnv = {
  now?: () => number
  randomUUID?: () => string
  setInterval?: (handler: () => void, ms: number) => unknown
  clearInterval?: (id: unknown) => void
  window?: { addEventListener: (type: string, listener: () => void, options?: unknown) => void } | undefined
  document?: { visibilityState: string; addEventListener: (type: string, listener: () => void) => void } | undefined
}
export type EffortTrackerOptions = {
  /** The application's reporter: posts the session to the app's own server. keepalive = the page is going away. */
  report: (session: EffortSessionReport, context: { keepalive: boolean }) => void | Promise<unknown>
  idleCutoffSeconds?: number
  minReportedSeconds?: number
  env?: EffortTrackerEnv
}
export type EffortTracker = {
  /** The most specific (latest) claim is the live one. Returns the release. */
  claim: (claim: EffortClaim) => () => void
  /** Attach something that happened inside the live session, by id. */
  recordAction: (kind: string, ref?: string) => boolean
  /** The person's input, for hosts that do not route it through the window's events. */
  noteActivity: () => void
  /** Report what the live session has counted so far; it continues under a new key. */
  flush: () => EffortSessionReport | null
  /** One second of the clock (the tracker runs this itself every second; tests call it). */
  tick: () => void
  snapshot: () => { claim: EffortClaim; activeSeconds: number; actions: number; sourceKey: string } | null
  /** Forget every claim and session without reporting. */
  reset: () => void
}
export function createEffortTracker(options: EffortTrackerOptions): EffortTracker
