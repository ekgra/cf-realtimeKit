# Cloudflare RealtimeKit Demo

## Overview

This repo is a minimal learning prototype for Cloudflare RealtimeKit. The MVP will let users create and join an audio-video meeting, receive a RealtimeKit participant auth token from a server-side API, render the built-in RealtimeKit React UI, and receive lifecycle webhook events.

The accepted product contract is [docs/specs/mvp/PRD.md](docs/specs/mvp/PRD.md). Implementation work is tracked in GitHub issues for `ekgra/cf-realtimeKit`.

## Quick Start

The app scaffold is not implemented yet. Start with the accepted PRD and issue #1 baseline, then implement the scaffold in issue #3.

Expected toolchain for the MVP:

- `pnpm`
- `node`
- `wrangler`
- Cloudflare account access with RealtimeKit enabled

Runtime commands will be added when the pnpm workspace, Vite app, Hono Worker, and Wrangler config exist.

## Documentation Map

- MVP PRD: [docs/specs/mvp/PRD.md](docs/specs/mvp/PRD.md)
- RealtimeKit implementation notes: [docs/realtimekit-notes.md](docs/realtimekit-notes.md)
- Architecture diagram source: [docs/diagrams/architecture.d2](docs/diagrams/architecture.d2)
- Architecture diagram SVG: [docs/diagrams/architecture.svg](docs/diagrams/architecture.svg)
- Main sequence source: [docs/diagrams/sequences/main-flow.puml](docs/diagrams/sequences/main-flow.puml)
- Main sequence SVG: [docs/diagrams/sequences/main-flow.svg](docs/diagrams/sequences/main-flow.svg)
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

The MVP requires these environment variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `REALTIMEKIT_APP_ID`
- `REALTIMEKIT_PRESET_NAME`
- `CLOUDFLARE_API_TOKEN`
- `PUBLIC_BASE_URL`

`CLOUDFLARE_API_TOKEN` must remain server-side. Browser code must not read it, bundle it, log it, or receive it in API responses.

Wrangler config and `.env.example` will be added with the app scaffold.

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

## Testing And Validation

No application test commands exist yet because the app scaffold has not been created.

Expected validation layers by slice:

- Documentation slices: document review and diagram render checks.
- API/runtime slices: Zod/unit tests, mocked route tests, Worker runtime evidence, and observability evidence.
- User-visible flows: frontend build/typecheck and E2E/manual evidence as selected by `test-strategy`.
- Release gate: staging deploy and smoke evidence unless explicitly accepted as risk.

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

Current status: PRD accepted; baseline README and diagrams are established in issue #1.

Next planned work:

- Issue #2: document RealtimeKit API discovery.
- Issue #3: scaffold the single Worker React app with health check.
- Issue #4: implement create meeting happy path.
- Issue #5: implement join existing meeting happy path.
- Issue #6: implement webhook receiver and registration path.
- Issue #7: run MVP runtime validation and release gate.
