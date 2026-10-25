# Chronomator

AmacrA's effort capability: how many SECONDS a person spent working on a
record, by channel - a call made through the app, writing, reading, doing,
travel (to, on site, back) - reported by the application or plugin the work
happened in and read back as tallies, so time spent can be set against what
the record returns. Named by Darren on 19 Oct 2026; the key is `effort`.

- Contract: `../Budgeting Platform/docs/amacra-platform-contract.md`, section 13.
- Platform (owner of the sessions): `../Budgeting Platform/spring-backend` -
  migration `V48__effort_sessions.sql`, `PlatformEffort.java`
  (`POST /api/effort/sessions`, `GET /api/effort/tallies`,
  `GET /api/effort/sessions`, `GET /api/effort/mine`), scopes `effort:read`
  / `effort:write`.
- The shared client tracker lives HERE: `src/effort-tracker.mjs` (framework-
  free ESM) with `src/effort-tracker.d.mts` and `test/effort-tracker.test.mjs`
  (`npm test`). Apps import `@amacra/chronomator/tracker` through a
  `file:../../Chronomator` dependency, exactly as `@amacra/documator/editor`
  is consumed; an app supplies the ONE reporter (a session goes to the app's
  own server, which holds the platform token) and claims a record from each
  surface. Throwaway end-to-end check: Stonehaven
  `server/scripts/e2e-effort.py` + `e2e-effort-cleanup.sh`.
- First application: Stonehaven (`../Stonehaven/property-manager`) -
  `server/src/effort.ts` (the gateway, the property's return from the
  ledger), `src/lib/effort.ts` (the thin binding of the tracker: reporter and
  channel labels) + `src/hooks/use-effort.ts` (the React hook), the property
  page and the document editors claiming time, the Activity tab's tally and
  entries.
- Documator: its hosted editors report through Stonehaven with surface
  `document-editor`; its standalone server will report as its own
  application.

Current state and what remains: `docs/handover-2026-10-19.md` (the dated
update at its top is the latest).
