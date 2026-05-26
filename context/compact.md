# Project Context Handoff

## Purpose

Build a minimal Cloudflare RealtimeKit WebRTC demo app for learning from first principles. The MVP lets users create or join an audio-video meeting, receives participant auth tokens from a server-side Worker API, renders the built-in RealtimeKit React UI, and receives RealtimeKit lifecycle webhooks.

## Current State

- Initial MVP PRD is accepted.
- Issue #1 established the project baseline README and baseline diagrams.
- Implementation has not started yet; no pnpm workspace, app scaffold, Worker routes, Wrangler config, or tests exist.
- GitHub issues #1-#7 define the MVP implementation slices.

## Repo Layout

- `docs/specs/mvp/PRD.md` — accepted MVP product contract.
- `README.md` — first-stop project orientation.
- `docs/diagrams/architecture.d2` and `.svg` — baseline architecture diagram.
- `docs/diagrams/sequences/main-flow.puml` and `.svg` — baseline create/join/webhook sequence.
- `docs/adr/` — ADR location, currently no ADRs.
- `docs/issues/` — local issue fallback; GitHub issues are the active tracker.
- `context/compact.md` — canonical baseline context.
- `context/compact-delta.md` — rolling post-baseline change log.

## Decisions

- V1 deployment shape: single Cloudflare Worker app serving built React/Vite assets plus Hono API routes.
- Frontend packages: `@cloudflare/realtimekit-react` and `@cloudflare/realtimekit-react-ui`, rendering `RtkMeeting`.
- Join model: users join by pasting an existing RealtimeKit `meetingId`.
- Participant preset: backend reads `REALTIMEKIT_PRESET_NAME`.
- Persistence: no D1 for V1 unless a later accepted requirement needs durable product state.
- Secrets: `CLOUDFLARE_API_TOKEN` is server-only and must never be exposed to browser code or logs.
- Observability: use Cloudflare platform observability first; app-owned telemetry is limited to safe structured product-stage logs.
- Production: deploy/smoke is HITL only and out of scope until explicitly approved.

## Validation

- Issue #1 validation:
  - PRD/README/context readback completed.
  - `d2 --layout=elk docs/diagrams/architecture.d2 docs/diagrams/architecture.svg` passed with a non-fatal inherited `DEBUG=release` warning.
  - `plantuml -tsvg docs/diagrams/sequences/main-flow.puml` passed.
  - `slice-evidence:v1` on GitHub issue #1 records quality gate `PASS`.
- No application build/test/runtime validation exists yet because the app scaffold has not been created.

## PRDs / Specs

- `docs/specs/mvp/PRD.md` — initial product baseline; Status: Accepted; last reviewed: 2026-05-26; GitHub issue #1 established baseline docs/diagrams.

## Open Questions

- Confirm current Cloudflare RealtimeKit API response field name for the participant frontend auth token during issue #2.
- Confirm whether current RealtimeKit webhook docs define signature verification headers/algorithm during issue #2.
- Confirm the actual `REALTIMEKIT_PRESET_NAME` configured in the user's Cloudflare RealtimeKit app before live API validation.
