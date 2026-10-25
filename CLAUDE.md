# Chronomator — rules for Claude

## Shared Amacratech rules (MANDATORY, read first)

- `../CLAUDE.md` and `../AGENTS.md` (the Amacratech folder) bind this
  project as they bind every app and plugin: the AmacrA platform owns the
  shared real-world records; before adding ANY field, column, table or
  record type, run the five questions and check
  `../Budgeting Platform/docs/amacra-platform-contract.md`. This file adds
  to those rules and never weakens them.

## What Chronomator is

- The AmacrA EFFORT capability: a person's working time on a record, in
  SECONDS, from every channel an AmacrA application or plugin mediates -
  call, writing, reading, doing, travel (to, on site, back). Darren named
  it Chronomator on 19 Oct 2026; every KEY stays brand-free (`effort`).
- The contract is section 13 of the platform contract. The platform owns
  the sessions (`effort_sessions`, `/api/effort/*`, `effort:read` /
  `effort:write`); each application reports sessions for the person who did
  the work and reads tallies back. A plugin hosted inside an application
  (Documator's editors in Stonehaven) reports through its host with its own
  surface key; a plugin running on its own reports as its own application.
- This project holds the shared client TRACKER (framework-free, consumed by
  apps like `@amacra/documator/editor` is), its tests, the docs and the
  hand-over state. Layout: `src/effort-tracker.mjs` + `.d.mts` exported as
  `@amacra/chronomator/tracker`; `test/*.test.mjs` run by `npm test`; an app
  depends on `file:../../Chronomator` and its image build copies the two
  files in (Stonehaven's web Dockerfile shows how). The tracker never calls
  a server itself: the app passes `report(session, {keepalive})`. The platform's Java lives in
  `../Budgeting Platform/spring-backend`; each app's gateway lives in that
  app. Never a second copy of a session anywhere.

## Rules that are Chronomator's own (MANDATORY)

- SECONDS, never minutes: sessions and tallies are stored to the second;
  display rounds, storage does not. One formatter, `h:mm:ss`.
- ACTIVE TIME, not screen time: a second counts only while the surface is
  visible and the person has touched, typed, scrolled or pointed within the
  idle cut-off; an idle gap is never counted. Idle cut-off 120 s is a
  PROVISIONAL ruling until Darren confirms it.
- ONE CLAIM AT A TIME: the most specific surface wins (an editor inside a
  page beats the page); time is never counted twice.
- A SESSION IS A FACT: reported once, immutable; a correction is a new
  session. Reporting is idempotent per application (`sourceKey`).
- A CALL IS MEASURED BY THE CALL (its recorded start and end), TRAVEL IS
  THREE LEGS, and the RETURN SIDE (what a record earns) is the
  application's, derived from its ledger - never stored beside the time.
- PLATFORM STAFF LEAVE NO TRACE: a superuser's or site administrator's time
  is never reported (Stonehaven's "superuser actions are invisible").
- WHO SEES WHOSE TIME is a ruling still to take: a person always their own
  across applications; a manager their staff's per record; an owner seeing
  an agency's time is commercial and OFF until Darren rules.

## Working agreements

- Every app's own rules apply to its files (Stonehaven's CLAUDE.md for
  Stonehaven's gateway and pages; the platform's for the Java). The
  checkouts are shared with other sessions: bump versions from the live
  `/api/health`, never message peer sessions, expect swept-in edits.
- Darren's work never leaves his server. Demos live in Stonehaven's
  `public/demos`, delivered as greenback URLs.
- A question is answered; work starts only on an instruction. Commit only
  when Darren says "commit", after he confirms the proposed title; this
  project has its own git repository.
