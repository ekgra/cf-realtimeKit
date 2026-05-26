# Cloudflare RealtimeKit Demo PRD

Status: Accepted
Source requirement: `REQUIREMENTS.md`
Last reviewed: 2026-05-26

## Summary

Build a minimal end-to-end Cloudflare RealtimeKit WebRTC demo app. The app lets a user create a meeting, lets another user join by pasting the meeting ID, creates RealtimeKit participant auth tokens server-side, renders the built-in RealtimeKit React meeting UI, and receives meeting lifecycle webhook events.

The goal is learning and first-principles understanding, not production polish. V1 should prove the smallest useful vertical slice with current official Cloudflare RealtimeKit APIs and packages.

## Goals

- Demonstrate the full flow from browser form to Cloudflare RealtimeKit meeting UI.
- Keep Cloudflare API tokens and other secrets out of the browser.
- Use the official RealtimeKit React SDK and UI Kit packages:
  - `@cloudflare/realtimekit-react`
  - `@cloudflare/realtimekit-react-ui`
- Document what RealtimeKit provides, where WebRTC/SFU/STUN/TURN fit, and what this app owns.
- Provide a simple webhook receiver and a documented way to register the `meeting.ended` webhook.
- Keep the codebase small enough to inspect and modify while learning.

## Non-Goals

- No custom video UI in V1.
- No user accounts, authorization system, calendar integration, scheduling, or room directory.
- No D1 persistence unless a later slice needs durable product state.
- No production-grade webhook event processing, retries, dashboards, or audit history.
- No recording, transcription, summary, livestreaming, or analytics workflows beyond documenting relevant events.
- No production deployment without explicit human approval under the repo's Cloudflare promotion rules.

## Success Criteria

- A user can create a RealtimeKit meeting from the app and receive a visible meeting ID.
- A second user can join by pasting that meeting ID and entering a display name.
- The frontend receives only safe data from the backend, especially the RealtimeKit SDK auth token.
- The frontend initializes the RealtimeKit client with the auth token and renders `RtkMeeting`.
- The backend can receive and log a RealtimeKit webhook payload for `meeting.ended`.
- README and `docs/realtimekit-notes.md` explain setup, local dev, webhook registration, deployment, and common troubleshooting.
- Lightweight tests cover validation, backend route behavior with mocked Cloudflare API calls, and webhook handling.

## Ubiquitous Language

- RealtimeKit App: Cloudflare-side application container identified by `REALTIMEKIT_APP_ID`.
- Meeting: RealtimeKit room resource created through Cloudflare's Meetings API.
- Meeting ID: RealtimeKit meeting identifier returned by the backend and pasted by users to join.
- Participant: A user added to a meeting through the RealtimeKit Participants API.
- Preset: Reusable RealtimeKit role/configuration applied to a participant; V1 reads the preset name from `REALTIMEKIT_PRESET_NAME`.
- Auth Token: Participant token returned by RealtimeKit and passed to the frontend SDK so a participant can join.
- Session: The live runtime instance of participants actively in a meeting.
- Webhook: Cloudflare-to-app HTTP callback for RealtimeKit lifecycle events.

## User Experience

The first screen is the working app, not a landing page. It presents a compact form with:

- display name
- optional meeting title for create
- meeting ID for join
- Create meeting action
- Join meeting action

States:

- idle: form is editable.
- creating/joining: relevant action is disabled and progress is visible.
- in meeting: built-in `RtkMeeting` UI is rendered.
- error: actionable error text is shown without exposing secrets or raw internal responses.

Create flow:

1. User enters display name and optional meeting title.
2. Frontend calls `POST /api/meetings`.
3. Backend creates a RealtimeKit meeting.
4. Backend adds the creator as a participant using `REALTIMEKIT_PRESET_NAME`.
5. Backend returns `{ meetingId, authToken }`.
6. Frontend shows the meeting ID and initializes RealtimeKit.
7. Frontend renders `RtkMeeting`.

Join flow:

1. User enters display name and an existing meeting ID.
2. Frontend calls `POST /api/meetings/:meetingId/join`.
3. Backend adds the participant using `REALTIMEKIT_PRESET_NAME`.
4. Backend returns `{ meetingId, authToken }`.
5. Frontend initializes RealtimeKit and renders `RtkMeeting`.

## System Architecture

Use a single deployable Cloudflare Worker app for V1:

- React + Vite + TypeScript builds static frontend assets.
- Cloudflare Worker + Hono serves API routes and built frontend assets.
- Zod validates request bodies and environment assumptions.
- RealtimeKit API calls happen only in the Worker.
- No D1 binding is required for V1.
- Webhook events are logged as structured JSON-compatible records.

Suggested layout:

```text
apps/
  web/
    src/
      App.tsx
      main.tsx
      components/
      lib/
  worker/
    src/
      index.ts
      routes/
      services/
      schemas/
      types/
docs/
  realtimekit-notes.md
scripts/
  register-webhook.ts
.env.example
README.md
wrangler.jsonc
```

## API Contract

### `GET /health`

Returns basic health status.

Example response:

```json
{
  "ok": true,
  "service": "realtimekit-demo"
}
```

### `POST /api/meetings`

Creates a RealtimeKit meeting and adds the creator as a participant.

Request:

```json
{
  "title": "Optional meeting title",
  "displayName": "Ada"
}
```

Response:

```json
{
  "meetingId": "meeting-id-from-cloudflare",
  "authToken": "participant-auth-token"
}
```

### `POST /api/meetings/:meetingId/join`

Adds a participant to an existing RealtimeKit meeting.

Request:

```json
{
  "displayName": "Grace"
}
```

Response:

```json
{
  "meetingId": "meeting-id-from-path",
  "authToken": "participant-auth-token"
}
```

### `POST /api/realtimekit/webhook`

Receives RealtimeKit webhook events.

V1 behavior:

- Parse JSON payload.
- Log event type, meeting ID when present, timestamp when present, and payload.
- Return a 2xx response for accepted payloads.
- Implement signature verification if official RealtimeKit webhook signature documentation is clear during implementation.
- If signature verification is not clearly documented, add an implementation TODO and document the gap in `docs/realtimekit-notes.md`.

## Cloudflare RealtimeKit Integration

Implementation must verify exact request and response shapes from current official docs before coding against the API.

Current documented assumptions:

- Create a meeting:
  - `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/realtime/kit/{app_id}/meetings`
  - body includes `title`.
- Add a participant:
  - `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants`
  - body includes `name`, `preset_name`, and a generated `custom_participant_id`.
  - response includes an auth token for the frontend SDK.
- Register a webhook:
  - `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/realtime/kit/{app_id}/webhooks`
  - body includes `name`, `url`, `events`, and optionally `enabled`.
- V1 registers at least `meeting.ended`.
- Additional documented event names may be mentioned in notes, including `meeting.started`, `meeting.participantJoined`, `meeting.participantLeft`, `meeting.chatSynced`, `recording.statusUpdate`, `livestreaming.statusUpdate`, `meeting.transcript`, and `meeting.summary`.

Official references:

- https://developers.cloudflare.com/realtime/realtimekit/quickstart/
- https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/react/rtkmeeting/
- https://developers.cloudflare.com/api/resources/realtime_kit/subresources/webhooks/methods/create_webhook/
- https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/

## Environment And Configuration

Required variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `REALTIMEKIT_APP_ID`
- `REALTIMEKIT_PRESET_NAME`
- `CLOUDFLARE_API_TOKEN`
- `PUBLIC_BASE_URL`

Configuration rules:

- `CLOUDFLARE_API_TOKEN` must be available only to the Worker/server runtime.
- Browser code must not read or bundle `CLOUDFLARE_API_TOKEN`.
- `PUBLIC_BASE_URL` is used for webhook registration documentation or script output.
- Wrangler config should be environment-aware and avoid unsafe bare production deploy assumptions.
- README must document local development, `wrangler dev`, optional tunnel setup for webhooks, staging deployment expectations, and production HITL requirements.

## Observability And Operations

Use Cloudflare platform observability first. Do not add D1/R2/app tables as a duplicate log or metrics store in V1.

Structured logs should cover meaningful stage boundaries:

- health request if useful for debugging
- meeting create request accepted/rejected
- participant add request accepted/rejected
- Cloudflare API failure
- webhook event accepted
- webhook parse or validation failure

Logs should be JSON-compatible and avoid secrets, raw credentials, auth tokens, sensitive request bodies, full prompts, or generated artifacts.

Recommended stable fields where available:

- `env`
- `service`
- `route`
- `request_id`
- `cf_ray`
- `stage`
- `meeting_id`
- `event_type`
- `status`
- `duration_ms`
- `error_code`

## Security And Privacy

- Never expose Cloudflare API tokens to the browser.
- Return only `meetingId` and the participant auth token required by the RealtimeKit frontend SDK.
- Do not log participant auth tokens.
- Validate all request bodies with Zod.
- Validate `meetingId` path input as a non-empty string.
- Keep webhook logging useful but avoid turning logs into a shadow data store.
- If webhook signature verification is unavailable or unclear, explicitly document the accepted V1 risk.

## Validation Plan

Before implementation:

- Use official Cloudflare RealtimeKit docs to confirm API endpoints, request fields, response token field names, package names, and webhook signature support.

During implementation:

- Unit tests for Zod request validation.
- Backend route tests with mocked Cloudflare API calls.
- Webhook handler test proving expected payloads are accepted and logged.
- Typecheck for frontend and Worker code.
- Build verification for the single deployable app.

Cloudflare runtime validation:

- Use `wrangler dev` when local bindings are sufficient.
- Use `wrangler dev --remote` or staging validation if RealtimeKit/network behavior requires Cloudflare-hosted execution.
- For deployment/config/runtime-affecting slices, collect staging deploy and smoke evidence before declaring release readiness.
- Production deploys and production smoke checks require explicit current-turn human approval.

## Deliverables

- `docs/realtimekit-notes.md`
- React/Vite frontend using `RtkMeeting`
- Hono Worker API routes
- RealtimeKit service wrapper
- Zod schemas
- webhook receiver
- webhook registration script or documented curl command
- `.env.example`
- `wrangler.jsonc` or equivalent Wrangler config
- README with setup, permissions, local dev, deployment, webhook registration, tunnel notes, validation, and troubleshooting
- lightweight tests

## First Vertical Slice

Implement a create-and-join happy path:

1. Scaffold the single Worker + Vite structure.
2. Add env parsing and RealtimeKit API wrapper.
3. Implement `GET /health`, `POST /api/meetings`, and `POST /api/meetings/:meetingId/join`.
4. Build a minimal frontend form and `RtkMeeting` rendering.
5. Add validation and mocked route tests.
6. Document setup and current RealtimeKit findings.

## Follow-Up Slices

- Add webhook receiver and registration script or curl docs.
- Improve error mapping and troubleshooting docs after first real Cloudflare API test.
- Add staging deploy and smoke validation evidence.
- Add diagrams after PRD acceptance and before implementation closure.
- Consider D1 only if a later requirement needs durable meeting history, admin state, or product-owned operational state.

## ADR Candidates

- Single Worker app versus split Pages plus Worker deployment.
- No D1 persistence for V1.
- Webhook signature verification risk if official documentation is unclear.
- RealtimeKit preset management: externally configured `REALTIMEKIT_PRESET_NAME` versus app-managed presets.

## Readiness Assessment

- Product intent and users: confirmed.
- Domain language, workflows, and business rules: confirmed for V1.
- Data model, source of truth, state lifecycle, and migrations: confirmed as no app persistence for V1.
- Architecture, APIs, integrations, platform/runtime, environment promotion, and deployment: confirmed at PRD level; API field names must be verified immediately before implementation.
- Package/library choices, coding style, module boundaries, and implementation standards: confirmed.
- Instrumentation, structured logging, observability, diagnostics, and operational evidence: assumed sufficient for V1 with Cloudflare platform observability plus structured app logs.
- Security, privacy, failure modes, and recovery: confirmed for token handling; webhook signature verification remains a documented risk until implementation-time docs check.
- Testing strategy, validation expectations, and quality gates: confirmed for lightweight V1 plus repo Cloudflare validation workflow for runtime-affecting slices.

## Open Questions

- What exact response field name does the current Participants API return for the frontend auth token in the implementation-time docs and examples?
- Does current RealtimeKit webhook documentation define a verifiable signature header and signing algorithm?
- Which preset name should the user configure in their Cloudflare RealtimeKit app for `REALTIMEKIT_PRESET_NAME`?
