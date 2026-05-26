# Cloudflare RealtimeKit Demo

## Overview

This repo is a minimal learning prototype for Cloudflare RealtimeKit. The MVP will let users create and join an audio-video meeting, receive a RealtimeKit participant auth token from a server-side API, render the built-in RealtimeKit React UI, and receive lifecycle webhook events.

The accepted product contract is [docs/specs/mvp/PRD.md](docs/specs/mvp/PRD.md). Implementation work is tracked in GitHub issues for `ekgra/cf-realtimeKit`.

## Quick Start

Expected local toolchain:

- `pnpm`
- Node.js 20.x or newer
- Wrangler, installed through the workspace dev dependency

Install dependencies:

```sh
corepack pnpm install
```

For create/join local validation, provide Worker-only values in an untracked
`.dev.vars` file. If you already maintain an untracked `.env` with the same
keys, copy it before starting Wrangler:

```sh
cp .env .dev.vars
```

Run the target single Worker app shape locally:

```sh
corepack pnpm dev:worker
```

Then check:

```sh
curl -s -i http://localhost:8787/health
```

`http://localhost:8787/` serves the built Vite frontend assets. `http://localhost:8787/health` is the Worker/Hono API health route.

Create-meeting API smoke:

```sh
curl -s -i -X POST http://localhost:8787/api/meetings \
  -H 'Content-Type: application/json' \
  --data '{"displayName":"Local Tester","title":"Local smoke"}'
```

The response is `{ "meetingId": "...", "authToken": "..." }`. Treat
`authToken` as a participant credential: do not paste it into docs, logs, or
issue comments.

Join-meeting API smoke using the created meeting ID:

```sh
curl -s -i -X POST http://localhost:8787/api/meetings/<meeting-id>/join \
  -H 'Content-Type: application/json' \
  --data '{"displayName":"Second Tester"}'
```

This returns a second participant `{ "meetingId": "...", "authToken": "..." }`
without storing or looking up meeting records in the app.

Frontend-only Vite development is also available when API/runtime behavior is not needed:

```sh
corepack pnpm --filter @cf-realtimekit-demo/web dev
```

## Documentation Map

- MVP PRD: [docs/specs/mvp/PRD.md](docs/specs/mvp/PRD.md)
- RealtimeKit implementation notes: [docs/realtimekit-notes.md](docs/realtimekit-notes.md)
- Architecture diagram source: [docs/diagrams/architecture.d2](docs/diagrams/architecture.d2)
- Architecture diagram SVG: [docs/diagrams/architecture.svg](docs/diagrams/architecture.svg)
- Main sequence source: [docs/diagrams/sequences/main-flow.puml](docs/diagrams/sequences/main-flow.puml)
- Main sequence SVG: [docs/diagrams/sequences/main-flow.svg](docs/diagrams/sequences/main-flow.svg)
- Issue #4 create sequence source: [docs/diagrams/issues/4-sequence.puml](docs/diagrams/issues/4-sequence.puml)
- Issue #4 create sequence SVG: [docs/diagrams/issues/4-sequence.svg](docs/diagrams/issues/4-sequence.svg)
- Issue #5 join sequence source: [docs/diagrams/issues/5-sequence.puml](docs/diagrams/issues/5-sequence.puml)
- Issue #5 join sequence SVG: [docs/diagrams/issues/5-sequence.svg](docs/diagrams/issues/5-sequence.svg)
- ADRs: [docs/adr/](docs/adr/)
- Local issue fallback: [docs/issues/](docs/issues/)

Planned documentation:

- Environment and webhook registration instructions
- Slice evidence on the corresponding GitHub issues

## Architecture

V1 is planned as a single Cloudflare Worker app:

- React + Vite + TypeScript builds the browser UI.
- Cloudflare Worker + Hono serves API routes and built frontend assets.
- The Worker is the only component that calls Cloudflare RealtimeKit APIs requiring secrets.
- The frontend receives only safe data, including the participant auth token required by the RealtimeKit SDK.
- No D1 persistence is planned for V1.
- Webhook events are accepted by the Worker and logged as structured records.

See the baseline architecture diagram source in [docs/diagrams/architecture.d2](docs/diagrams/architecture.d2).

Current scaffold layout:

```text
apps/
  web/       React + Vite frontend source
  worker/    Hono Worker source and route tests
wrangler.jsonc
```

Wrangler serves built frontend files from `apps/web/dist` and runs Worker code from `apps/worker/src/index.ts`. The configured Worker-first routes are `/health` and future `/api/*` paths.

Current implemented API routes:

- `GET /health`
- `POST /api/meetings`
- `POST /api/meetings/:meetingId/join`

The frontend create and join flows use `@cloudflare/realtimekit-react` and
`@cloudflare/realtimekit-react-ui` to initialize a RealtimeKit client with the
participant `authToken` returned by the Worker and render `RtkMeeting`.

## Core Workflows

Create meeting:

1. User enters display name and optional meeting title.
2. Browser calls `POST /api/meetings`.
3. Worker creates a RealtimeKit meeting and participant.
4. Worker returns `{ meetingId, authToken }`.
5. Browser initializes RealtimeKit and renders `RtkMeeting`.

Join meeting:

1. User enters display name and an existing meeting ID.
2. Browser calls `POST /api/meetings/:meetingId/join`.
3. Worker adds the participant and returns `{ meetingId, authToken }`.
4. Browser initializes RealtimeKit and renders `RtkMeeting`.

Webhook:

1. RealtimeKit sends lifecycle events to `POST /api/realtimekit/webhook`.
2. Worker validates/parses the payload.
3. Worker logs event type, meeting ID when present, timestamp when present, status, and safe metadata.

See the baseline sequence source in [docs/diagrams/sequences/main-flow.puml](docs/diagrams/sequences/main-flow.puml).

## Environments

- `dev-local`: local development with `wrangler dev` when the required bindings and behavior are supported locally.
- `dev-remote`: remote-primary validation with `wrangler dev --remote` when Cloudflare-network behavior matters.
- `staging`: definitive deployed validation and promotion target for runtime/config/release-gate slices.
- `production`: optional and human-approved only. Production deploys and production smoke checks require explicit current-turn approval.

Do not use bare `wrangler deploy` unless future repo docs or scripts explicitly define it as safe for the target environment.

## Configuration

The scaffold includes [.env.example](.env.example) with placeholder values only. The MVP requires these environment variables:

- `CLOUDFLARE_ACCOUNT_ID`: Worker/server-side Cloudflare account identifier for RealtimeKit REST API paths.
- `REALTIMEKIT_APP_ID`: Worker/server-side RealtimeKit app identifier.
- `REALTIMEKIT_PRESET_NAME`: Worker/server-side participant preset name used when creating participants.
- `CLOUDFLARE_API_TOKEN`: Worker/server-only token for Cloudflare REST API calls.
- `PUBLIC_BASE_URL`: public app origin used for callback URLs such as webhook registration.

`CLOUDFLARE_API_TOKEN` must remain server-side. Browser code must not read it, bundle it, log it, or receive it in API responses. Do not add it with browser-exposed prefixes such as `VITE_`.

For local Worker development, use untracked local secret files such as `.dev.vars` or shell-provided environment variables. For deployed environments, use Cloudflare Worker secrets/vars rather than committing real values.

## Development

Development should follow the accepted PRD and the GitHub issue sequence:

1. Accept baseline and diagrams.
2. Document current RealtimeKit API discovery.
3. Scaffold the single Worker React app.
4. Implement create meeting.
5. Implement join meeting.
6. Implement webhook receiver and registration path.
7. Run runtime validation and release gate.

Before implementation slices, store `test-strategy:v1` on the issue. During implementation, store `slice-evidence:v1` on the issue.

Common commands:

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm build:web
corepack pnpm --filter @cf-realtimekit-demo/worker dev
```

The root `dev:worker` and filtered Worker `dev` scripts both build frontend assets before starting Wrangler on `http://localhost:8787`.

## Testing And Validation

Current scaffold validation commands:

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry-run
```

Local runtime smoke:

```sh
corepack pnpm dev:worker
curl -s -i http://localhost:8787/health
curl -s -i http://localhost:8787/dashboard
```

Validation layers by later slice:

- Documentation slices: document review and diagram render checks.
- API/runtime slices: Zod/unit tests, mocked route tests, Worker runtime evidence, and observability evidence.
- User-visible flows: frontend build/typecheck and E2E/manual evidence as selected by `test-strategy`.
- Release gate: staging deploy and smoke evidence unless explicitly accepted as risk.

Create/join validation currently includes Worker schema/service/route tests with
mocked Cloudflare API responses, frontend typecheck/build, workspace typecheck,
secret scans, and dev-local smoke with configured RealtimeKit credentials.

## Operations

Use Cloudflare platform observability first. App-owned telemetry in V1 should be limited to structured logs for product-relevant stages such as meeting creation, participant join, Cloudflare API failures, and webhook receipt.

Do not duplicate platform-provided runtime logs, traces, metrics, or request metadata into D1/R2/app tables. Do not log secrets, Cloudflare API tokens, participant auth tokens, or sensitive request bodies.

## Decisions

- Initial accepted PRD: [docs/specs/mvp/PRD.md](docs/specs/mvp/PRD.md)
- V1 deployment shape: single Worker app serving frontend assets and Hono API routes.
- V1 join model: paste meeting ID.
- V1 persistence: no D1 unless a later accepted requirement needs durable product state.
- Participant preset: configured by `REALTIMEKIT_PRESET_NAME`.

ADR candidates are listed in the PRD and should become ADRs only if implementation forces a durable architecture decision.

## Current Status / Roadmap

Current status: issue #5 join existing meeting happy path is implemented locally. The app has
a pnpm workspace, Vite React frontend, Hono Worker, Wrangler static-assets
config, `.env.example`, `GET /health`, `POST /api/meetings`,
`POST /api/meetings/:meetingId/join`, a Worker-only RealtimeKit REST wrapper,
and frontend RealtimeKit SDK/UI Kit initialization for created or joined
meetings.

Next planned work:

- Issue #6: implement webhook receiver and registration path.
- Issue #7: run MVP runtime validation and release gate.
