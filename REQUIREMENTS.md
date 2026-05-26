You are helping me build a minimal Cloudflare RealtimeKit WebRTC demo app.

Goal:
Build a small end-to-end web app that lets users create/join an audio-video meeting using Cloudflare RealtimeKit, with webhook support for meeting lifecycle events.

Context:
I want to understand Cloudflare RealtimeKit from first principles by building a working prototype. Do not over-engineer. V1 should use the built-in RealtimeKit UI component rather than a fully custom video UI.

Tech stack:
- Frontend: React + Vite + TypeScript
- Backend: Cloudflare Workers + Hono
- Validation: Zod
- Package manager: pnpm
- Optional persistence: D1 only if useful; otherwise start with in-memory/logging
- Deployment target: Cloudflare Workers/Pages-compatible structure

Important:
- Do not expose the Cloudflare API token in the browser.
- All Cloudflare RealtimeKit API calls requiring secrets must happen server-side.
- Use current Cloudflare RealtimeKit official docs. Do not assume old Dyte package names unless the docs explicitly say they are still valid.
- Prefer the official RealtimeKit React packages:
  - @cloudflare/realtimekit-react
  - @cloudflare/realtimekit-react-ui
- First verify the latest API shape from the docs/examples before coding.
- Keep the first version simple and working.

Functional requirements:

1. Documentation discovery
   - Inspect official Cloudflare RealtimeKit docs and examples.
   - Create `docs/realtimekit-notes.md` explaining:
     - What RealtimeKit is
     - How it relates to WebRTC, SFU, STUN/TURN at a high level
     - What the frontend SDK does
     - What the backend API must do
     - How auth tokens / participant tokens are created
     - What webhooks are available and which ones this app uses

2. App flow
   - User opens the app.
   - User enters:
     - display name
     - optional room/meeting title
   - User clicks "Create meeting" or "Join meeting".
   - Frontend calls backend.
   - Backend creates or fetches a RealtimeKit meeting using Cloudflare API.
   - Backend creates/adds participant/auth token using the correct RealtimeKit API.
   - Backend returns only safe frontend data, especially the RealtimeKit auth token needed by the SDK.
   - Frontend initializes RealtimeKit client using the auth token.
   - Frontend renders the built-in `RtkMeeting` UI component.

3. Backend routes
   Implement these routes:

   - `GET /health`
     Returns basic health status.

   - `POST /api/meetings`
     Creates a new RealtimeKit meeting.
     Request body:
       {
         "title": "string optional",
         "displayName": "string"
       }
     Response:
       {
         "meetingId": "...",
         "authToken": "..."
       }

   - `POST /api/meetings/:meetingId/join`
     Adds/creates a participant for an existing meeting and returns frontend auth token.
     Request body:
       {
         "displayName": "string"
       }

   - `POST /api/realtimekit/webhook`
     Receives RealtimeKit webhook events.
     For V1, log the event type, meeting id, timestamp, and payload.
     If webhook signature verification is documented, implement it.
     If verification details are not clear, add a TODO and document the gap.

4. Webhook registration
   - Add a script or documented curl command to register a webhook for at least:
     - `meeting.ended`
   - If docs show additional useful events like recording/transcription/summary status, mention them in notes but do not implement unless trivial.
   - Use env vars:
     - `CLOUDFLARE_ACCOUNT_ID`
     - `REALTIMEKIT_APP_ID`
     - `CLOUDFLARE_API_TOKEN`
     - `PUBLIC_BASE_URL`

5. Frontend UX
   - Simple clean UI.
   - States:
     - idle
     - creating/joining
     - in meeting
     - error
   - Show useful error messages.
   - Do not hardcode auth tokens in frontend.
   - Keep the UI minimal: this is a learning prototype, not production polish.

6. Env/config
   - Provide `.env.example`
   - Provide Wrangler config example.
   - Document local dev setup.
   - Document how to expose local webhook endpoint using a tunnel if needed.

7. Tests
   - Add lightweight tests for:
     - request validation
     - backend route behavior with mocked Cloudflare API calls
     - webhook handler accepts and logs expected event payload
   - Do not spend too much time on exhaustive testing in V1.

8. Deliverables
   - Working repo structure
   - README with:
     - setup steps
     - required Cloudflare permissions
     - local dev
     - deployment
     - webhook registration
     - common troubleshooting
   - `docs/realtimekit-notes.md`
   - Minimal working frontend and backend

Suggested repo structure:

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
wrangler.jsonc or wrangler.toml

Implementation approach:
1. First inspect docs/examples and write the notes file.
2. Then scaffold the monorepo.
3. Then implement backend RealtimeKit client wrapper.
4. Then implement backend routes.
5. Then implement frontend using built-in RealtimeKit UI.
6. Then implement webhook receiver.
7. Then add README and test coverage.
8. Run typecheck/tests and fix issues.

Be careful:
- Do not invent API endpoints. Verify from official docs.
- Do not put Cloudflare API token in frontend.
- Keep V1 small.
- Prefer a working vertical slice over a fancy incomplete implementation.