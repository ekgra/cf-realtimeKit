# Compact Delta

Current state:
- Reset after latest context compaction.
- Add new entries below in this format:

## YYYY-MM-DD HH:MM TZ
- Issue: #123 or none
- Change:
- Files:
- Validation:

## 2026-05-27 00:00 AEST
- Issue: #1
- Change: Accepted the MVP PRD as the initial product baseline and established baseline README plus architecture/main-flow diagram sources.
- Files: docs/specs/mvp/PRD.md; README.md; docs/diagrams/architecture.d2; docs/diagrams/architecture.svg; docs/diagrams/sequences/main-flow.puml; docs/diagrams/sequences/main-flow.svg
- Validation: Human approval in conversation: "PRD lgtm"; rendered D2 architecture SVG and PlantUML sequence SVG locally.

## 2026-05-27 00:24 AEST
- Issue: #2
- Change: Documented current Cloudflare RealtimeKit discovery notes. Key implementation findings: participant REST response uses `data.token`; app response may map it to `authToken`; webhook registration uses `events`, `name`, `url`, optional `enabled`; RealtimeKit webhook signature verification and inbound payload shape are not clearly documented in official docs and are V1 gaps.
- Files: docs/realtimekit-notes.md; README.md; context/compact-delta.md
- Validation: Official Cloudflare docs review; documentation readback, official-source link check, acceptance keyword check, and git scope review completed.

## 2026-05-27 01:32 AEST
- Issue: #3 / local slice 3D
- Change: Added root Wrangler static-assets configuration for the single Worker deployment shape. The Worker entrypoint is `apps/worker/src/index.ts`; built frontend assets are served from `apps/web/dist`; `/api/*` and `/health` run Worker-first; SPA fallback is enabled for frontend routes. Wrangler is pinned to `4.50.0` for Node 20 compatibility.
- Files: wrangler.jsonc; package.json; pnpm-lock.yaml; .gitignore; issue3-slices-runbook.md
- Validation: `corepack pnpm build:web`, Worker typecheck/test, Wrangler dry-run, and local Wrangler smoke passed for `/health` plus SPA asset fallback at `/dashboard`. Generated local artifacts were removed after validation.

## 2026-05-27 01:37 AEST
- Issue: #3 / local slice 3D
- Change: Added package-level Worker dev scripts so `pnpm --filter @cf-realtimekit-demo/worker dev` and `pnpm --filter @cf-realtimekit-demo/worker dev:worker` work from the repo root.
- Files: apps/worker/package.json; issue3-slices-runbook.md; context/compact-delta.md
- Validation: Filtered Worker dev command started Wrangler local dev and served `/health` plus frontend assets; Worker typecheck and test passed.

## 2026-05-27 01:48 AEST
- Issue: #3 / local slice 3E
- Change: Added `.env.example` with placeholder V1 config and documented the secret boundary. `CLOUDFLARE_API_TOKEN` is Worker/server-only; browser-exposed env prefixes such as `VITE_` must not be used for it. Local env files and Wrangler `.dev.vars` files are ignored.
- Files: .env.example; .gitignore; README.md; issue3-slices-runbook.md; context/compact-delta.md
- Validation: Frontend token/RealtimeKit secret scan passed; `.env.example` placeholder check passed; web and Worker typechecks passed.

## 2026-05-27 01:54 AEST
- Issue: #3 / local slice 3F
- Change: Updated README with confirmed setup/run/validation commands and stored `test-strategy:v1` plus `slice-evidence:v1` on GitHub issue #3. Issue #3 scaffold quality gate result is PASS.
- Files: README.md; issue3-slices-runbook.md; context/compact-delta.md
- Validation: `corepack pnpm install`, workspace typecheck/test/build, Wrangler dry-run, local Wrangler smoke, frontend secret scan, app-code scope scan, and `.env.example` placeholder check passed. Local smoke used port `8788` because an existing Worker process was already listening on `8787`.
