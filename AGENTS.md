# Chronomator — agent working notes

- Read `CLAUDE.md` here and `../CLAUDE.md` + `../AGENTS.md` first. The
  contract section is `../Budgeting Platform/docs/amacra-platform-contract.md`
  section 13; the consolidated build list entry and the roadmap line
  (`../Budgeting Platform/docs/roadmap.md`) name the full shape.
- State of the build at hand-over: `docs/handover-2026-10-19.md`. Read it
  before touching anything; it says what exists where, what is verified and
  what is not, and what is blocked.
- Browser verification is only in the AMACRA Chrome profile (Stonehaven's
  rule); when Claude in Chrome is unreachable, say so - never substitute
  another browser.
- Stonehaven deploys with `COMPOSE_PROFILES=legacy-web bash scripts/public-test up`
  from `../Stonehaven/property-manager` after `npx tsc -b`, the server
  typecheck and the node:test suites; the platform API deploys from
  `../Budgeting Platform` with `docker compose build calcyoulater-app &&
  docker compose up -d calcyoulater-app` (its Dockerfile runs `gradle test`
  as the gate). Verify both healths after either.
