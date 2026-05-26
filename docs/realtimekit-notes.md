# Cloudflare RealtimeKit Notes

Source issue: #2
Last reviewed: 2026-05-27

These notes are the implementation discovery record for the MVP. They summarize current official Cloudflare RealtimeKit docs without replacing the docs themselves.

## Official Sources Checked

- RealtimeKit overview: https://developers.cloudflare.com/realtime/realtimekit/
- RealtimeKit quickstart: https://developers.cloudflare.com/realtime/realtimekit/quickstart/
- Meeting concept: https://developers.cloudflare.com/realtime/realtimekit/concepts/meeting/
- Participant concept: https://developers.cloudflare.com/realtime/realtimekit/concepts/participant/
- Preset concept: https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/
- Session lifecycle: https://developers.cloudflare.com/realtime/realtimekit/concepts/session-lifecycle/
- React `RtkMeeting`: https://developers.cloudflare.com/realtime/realtimekit/ui-kit/api-reference/react/rtkmeeting/
- REST API reference: https://developers.cloudflare.com/api/resources/realtime_kit/
- Create meeting API: https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/create/
- Add participant API: https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/add_participant/
- Refresh participant token API: https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/refresh_participant_token/
- Add webhook API: https://developers.cloudflare.com/api/resources/realtime_kit/subresources/webhooks/methods/create_webhook/
- TURN service: https://developers.cloudflare.com/realtime/turn/

## What RealtimeKit Is

RealtimeKit is Cloudflare's higher-level SDK/API product for adding live audio and video to web and mobile apps. The overview describes it as powered by WebRTC and built on top of Cloudflare Realtime SFU, with SDKs, UI Kit components, REST APIs, webhooks, and signalling infrastructure.

For this demo:

- RealtimeKit owns media session infrastructure, client SDK behavior, meeting UI primitives, and server-side RealtimeKit resources.
- This app owns the product flow: collecting a display name, creating or joining a meeting, requesting a participant token server-side, and rendering the built-in meeting UI.

## WebRTC, SFU, STUN, And TURN

- WebRTC is the browser/mobile real-time media technology used for low-latency audio/video.
- Cloudflare Realtime SFU sits between participants and routes media tracks efficiently instead of every participant sending media to every other participant.
- STUN helps peers discover network addresses for direct connectivity.
- TURN relays media when direct peer connectivity is blocked by NAT/firewall conditions.
- For this MVP, the app should not implement WebRTC, SFU, STUN, or TURN behavior directly. RealtimeKit SDK/API usage is the product integration boundary.

## Frontend SDK And UI Kit

The current quickstart lists these React dependencies:

```sh
npm i @cloudflare/realtimekit-react @cloudflare/realtimekit-react-ui
```

The React `RtkMeeting` component is documented in `@cloudflare/realtimekit-react-ui`. It renders the meeting UI and handles many internal meeting UI states, dialogs, and smaller UI pieces.

Frontend responsibilities for this MVP:

- Call this app's backend, not the Cloudflare REST API directly.
- Receive `{ meetingId, authToken }` from the backend.
- Initialize the RealtimeKit client/meeting object with the participant auth token.
- Render the built-in `RtkMeeting` UI.
- Never read or bundle `CLOUDFLARE_API_TOKEN`.

## Backend API Responsibility

Cloudflare REST API calls requiring secrets must happen server-side in the Worker.

The Worker will:

- read `CLOUDFLARE_ACCOUNT_ID`, `REALTIMEKIT_APP_ID`, `REALTIMEKIT_PRESET_NAME`, and `CLOUDFLARE_API_TOKEN`
- create RealtimeKit meetings
- add participants and receive participant tokens
- return only safe frontend data
- receive webhook events

The Cloudflare REST base URL is:

```text
https://api.cloudflare.com/client/v4
```

Authorization uses:

```http
Authorization: Bearer <CLOUDFLARE_API_TOKEN>
```

The token needs at least one of the documented Realtime permissions: `Realtime Admin` or `Realtime`.

Why this is needed even when the backend is a Cloudflare Worker:

- A Worker running on Cloudflare infrastructure is not automatically authorized to manage account-level Cloudflare resources.
- RealtimeKit meeting and participant management is currently documented as Cloudflare REST API access, not as a Worker binding.
- Worker bindings such as D1, Durable Objects, R2, KV, and Workers AI are a different access mode: the binding gives the Worker both the API surface and scoped permission through `env.*`.
- Because RealtimeKit does not currently expose a Worker binding, the Worker must call the RealtimeKit REST endpoints with `CLOUDFLARE_API_TOKEN`.
- The participant auth token returned by RealtimeKit is a separate, browser-safe credential for joining a meeting. The Worker obtains it by calling the participant endpoint with the Cloudflare API token, then returns only the participant token and meeting ID to the browser.
- If Cloudflare later ships a RealtimeKit Worker binding, this integration boundary may change. Until then, REST API plus a scoped server-only token is the documented path.

## Meeting API Shape

Create meeting:

```http
POST /accounts/{account_id}/realtime/kit/{app_id}/meetings
```

V1 request body:

```json
{
  "title": "My meeting title"
}
```

The API also documents optional meeting configuration fields, including:

- `ai_config`
- `live_stream_on_start`
- `persist_chat`
- `record_on_start`
- `recording_config`
- `session_keep_alive_time_in_secs`
- `summarize_on_end`
- `transcribe_on_end`

V1 should use only `title` unless a later issue explicitly expands scope.

Documented response shape:

```json
{
  "success": true,
  "data": {
    "id": "meeting-uuid",
    "created_at": "2019-12-27T18:11:19.117Z",
    "updated_at": "2019-12-27T18:11:19.117Z",
    "status": "ACTIVE",
    "title": "title"
  }
}
```

Implementation note:

- Use `data.id` as the `meetingId` returned by this app's backend.
- Treat `data` as optional at the type boundary and fail safely if `success !== true` or `data.id` is missing.

## Participant API Shape

Add participant:

```http
POST /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants
```

Request body:

```json
{
  "custom_participant_id": "generated-internal-id",
  "preset_name": "group-call-host",
  "name": "Mary Sue",
  "picture": "https://example.com/avatar.jpg"
}
```

Documented fields:

- `custom_participant_id`: required string; unique participant ID generated by the client/app.
- `preset_name`: required string; preset to apply.
- `name`: optional string.
- `picture`: optional URL.

MVP request body decision:

- `custom_participant_id`: generate server-side as a UUID or another non-PII stable ID for the request.
- `preset_name`: use `REALTIMEKIT_PRESET_NAME`.
- `name`: use validated `displayName`.
- `picture`: omit for V1.

Documented response shape:

```json
{
  "success": true,
  "data": {
    "id": "participant-uuid",
    "token": "participant-auth-token",
    "created_at": "2019-12-27T18:11:19.117Z",
    "custom_participant_id": "custom_participant_id",
    "preset_name": "preset_name",
    "updated_at": "2019-12-27T18:11:19.117Z",
    "name": "name",
    "picture": "https://example.com"
  }
}
```

Important implementation correction:

- The frontend auth token field from Cloudflare is currently `data.token`.
- This app's backend may return that value to its own frontend as `authToken`, but the RealtimeKit REST response field is not `authToken`.
- Validate the REST response before returning to the browser. Do not pass through the entire Cloudflare response.

## Participant Token Refresh

Refresh participant token:

```http
POST /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants/{participant_id}/token
```

Documented response shape:

```json
{
  "data": {
    "token": "token"
  },
  "success": true
}
```

The Participant concept docs say participant tokens are time-bound and can be refreshed without creating a new participant.

V1 decision:

- Do not implement token refresh in the create/join happy path unless the SDK integration requires it during testing.
- Keep this endpoint in mind for a later reliability or long-session issue.

## Presets And `REALTIMEKIT_PRESET_NAME`

A preset is reusable participant experience configuration. The Preset docs say presets belong to an App and are applied to participants, not meetings. They control meeting type, permissions/actions, and UI look and feel.

Cloudflare creates default presets when an app is created through the dashboard. Presets can also be created or managed through the Cloudflare dashboard or Presets API.

MVP rule:

- `REALTIMEKIT_PRESET_NAME` must match a preset in the target RealtimeKit app.
- Use a dashboard-created group-call style preset for the first prototype.
- Do not auto-fetch or auto-create presets in V1.
- If participant creation returns an error for an unknown preset, surface a safe backend error and document the configured preset in troubleshooting.

## Webhook Registration API Shape

Add webhook:

```http
POST /accounts/{account_id}/realtime/kit/{app_id}/webhooks
```

Request body:

```json
{
  "events": ["meeting.ended"],
  "name": "RealtimeKit MVP webhook",
  "url": "https://example.com/api/realtimekit/webhook",
  "enabled": true
}
```

Documented fields:

- `events`: array of supported event names.
- `name`: webhook name.
- `url`: delivery URL.
- `enabled`: optional boolean.

Documented response shape:

```json
{
  "data": {
    "id": "webhook-uuid",
    "created_at": "2022-05-28T07:01:53.075Z",
    "enabled": true,
    "events": ["meeting.ended"],
    "name": "RealtimeKit MVP webhook",
    "updated_at": "2022-05-28T07:01:53.075Z",
    "url": "https://example.com/api/realtimekit/webhook"
  },
  "success": true
}
```

Supported event names documented by the Webhooks API:

- `meeting.started`
- `meeting.ended`
- `meeting.participantJoined`
- `meeting.participantLeft`
- `meeting.chatSynced`
- `recording.statusUpdate`
- `livestreaming.statusUpdate`
- `meeting.transcript`
- `meeting.summary`

V1 registration target:

- Register at least `meeting.ended`.
- Mention the other events in README or notes, but do not implement event-specific workflows unless trivial.

## Inbound Webhook Payload Shape

Official docs inspected for this slice document webhook registration request/response shapes and supported event names, but they do not document a concrete inbound webhook payload example for delivery to this app.

V1 receiver guidance:

- Accept JSON object payloads.
- Do not assume one exact payload shape until real delivery evidence exists.
- Extract stable fields defensively when present:
  - `event`
  - `type`
  - `meeting_id`
  - `meetingId`
  - `timestamp`
  - `created_at`
- Log safe metadata and the event type. Avoid secrets, auth tokens, raw credentials, and large/sensitive nested bodies.
- Return 2xx for accepted payloads so RealtimeKit does not treat the event as failed.
- Store real payload examples in future slice evidence after dev-remote/staging webhook testing.

## Webhook Signature Verification Status

Finding as of 2026-05-27:

- The official Webhooks API docs inspected for RealtimeKit do not document signature headers, signing algorithm, shared secret configuration, timestamp tolerance, or verification examples.
- The RealtimeKit docs index and REST API reference search did not reveal a RealtimeKit-specific webhook signature verification page.

V1 gap:

- Do not claim webhook cryptographic verification in V1 unless later official docs are found.
- Implement the webhook receiver with a TODO for signature verification and document that the current MVP accepts the risk.
- Keep the handler narrow: parse JSON, log safe lifecycle metadata, return 2xx for accepted payloads.
- Consider adding an operator-provided shared secret header as a future ADR/feature only after deciding whether it fits Cloudflare RealtimeKit webhook delivery.

## Implementation Checklist For Later Slices

- Confirm `data.token` in the typed RealtimeKit client wrapper tests.
- Map Cloudflare `data.id` from meeting creation to app response `meetingId`.
- Map Cloudflare `data.token` from participant creation to app response `authToken`.
- Generate `custom_participant_id` server-side and avoid PII.
- Keep `CLOUDFLARE_API_TOKEN` server-only.
- Keep webhook handler tolerant of unknown JSON shape until real payload evidence exists.
