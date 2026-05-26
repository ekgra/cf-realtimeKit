import assert from "node:assert/strict";
import test from "node:test";
import { app, createApp } from "./app";
import type { WorkerEnv } from "./schemas/env";
import { RealtimeKitApiError } from "./services/realtimekit";

const env: WorkerEnv = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  REALTIMEKIT_APP_ID: "app-id",
  REALTIMEKIT_PRESET_NAME: "group_call_host",
  CLOUDFLARE_API_TOKEN: "server-token",
};

test("GET /health returns stable status", async () => {
  const response = await app.request("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "realtimekit-demo",
  });
});

test("POST /api/meetings returns safe create response", async () => {
  const calls: unknown[] = [];
  const app = createApp({
    createMeetingForCreator: async (options) => {
      calls.push(options);
      return {
        meetingId: "meeting-id",
        authToken: "participant-token",
      };
    },
  });

  const response = await app.request(
    "/api/meetings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: " Ada ",
        title: " Planning ",
      }),
    },
    env,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    meetingId: "meeting-id",
    authToken: "participant-token",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    env,
    input: {
      displayName: "Ada",
      title: "Planning",
    },
  });
});

test("POST /api/meetings rejects invalid body without calling service", async () => {
  let called = false;
  const app = createApp({
    createMeetingForCreator: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });

  const response = await app.request(
    "/api/meetings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Planning" }),
    },
    env,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_request",
      message: "Enter a display name before creating a meeting.",
    },
  });
  assert.equal(called, false);
});

test("POST /api/meetings rejects invalid JSON without calling service", async () => {
  let called = false;
  const app = createApp({
    createMeetingForCreator: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });

  const response = await app.request(
    "/api/meetings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    },
    env,
  );

  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("POST /api/meetings returns safe config error for missing env", async () => {
  let called = false;
  const app = createApp({
    createMeetingForCreator: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });

  const response = await app.request(
    "/api/meetings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Ada" }),
    },
    {
      ...env,
      CLOUDFLARE_API_TOKEN: "",
    },
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "server_configuration_error",
      message: "Meeting creation is not configured.",
    },
  });
  assert.equal(called, false);
});

test("POST /api/meetings returns safe upstream failure", async () => {
  const app = createApp({
    createMeetingForCreator: async () => {
      throw new RealtimeKitApiError("Failed to create RealtimeKit meeting", {
        stage: "meeting",
        status: 403,
      });
    },
  });

  const response = await app.request(
    "/api/meetings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Ada" }),
    },
    env,
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: {
      code: "realtimekit_request_failed",
      message: "Could not create the meeting. Try again later.",
    },
  });
});

test("POST /api/meetings/:meetingId/join returns safe join response", async () => {
  const calls: unknown[] = [];
  const app = createApp({
    joinMeeting: async (options) => {
      calls.push(options);
      return {
        meetingId: "meeting-id",
        authToken: "participant-token",
      };
    },
  });

  const response = await app.request(
    "/api/meetings/meeting-id/join",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: " Grace ",
      }),
    },
    env,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    meetingId: "meeting-id",
    authToken: "participant-token",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    env,
    meetingId: "meeting-id",
    input: {
      displayName: "Grace",
    },
  });
});

test("POST /api/meetings/:meetingId/join rejects invalid body without calling service", async () => {
  let called = false;
  const app = createApp({
    joinMeeting: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });

  const response = await app.request(
    "/api/meetings/meeting-id/join",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: " " }),
    },
    env,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_request",
      message: "Enter a meeting ID and display name before joining.",
    },
  });
  assert.equal(called, false);
});

test("POST /api/meetings/:meetingId/join rejects invalid JSON without calling service", async () => {
  let called = false;
  const app = createApp({
    joinMeeting: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });

  const response = await app.request(
    "/api/meetings/meeting-id/join",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    },
    env,
  );

  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("POST /api/meetings/:meetingId/join returns safe config error for missing env", async () => {
  let called = false;
  const app = createApp({
    joinMeeting: async () => {
      called = true;
      throw new Error("should not be called");
    },
  });

  const response = await app.request(
    "/api/meetings/meeting-id/join",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Grace" }),
    },
    {
      ...env,
      CLOUDFLARE_API_TOKEN: "",
    },
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "server_configuration_error",
      message: "Meeting join is not configured.",
    },
  });
  assert.equal(called, false);
});

test("POST /api/meetings/:meetingId/join returns safe upstream failure", async () => {
  const app = createApp({
    joinMeeting: async () => {
      throw new RealtimeKitApiError("Failed to create RealtimeKit participant", {
        stage: "participant",
        status: 404,
      });
    },
  });

  const response = await app.request(
    "/api/meetings/meeting-id/join",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Grace" }),
    },
    env,
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: {
      code: "realtimekit_request_failed",
      message: "Could not join the meeting. Check the meeting ID.",
    },
  });
});

test("POST /api/realtimekit/webhook accepts representative payload and logs safely", async () => {
  const loggerRecords: Record<string, unknown>[] = [];
  const app = createApp({
    logger: {
      info: (record) => loggerRecords.push(record),
      error: (record) => loggerRecords.push(record),
    },
  });

  const response = await app.request("/api/realtimekit/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "meeting.ended",
      meeting_id: "meeting-id",
      timestamp: "2026-05-27T00:00:00.000Z",
      token: "participant-token",
      nested: {
        authorization: "Bearer server-token",
        status: "ended",
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
  });
  assert.deepEqual(loggerRecords, [
    {
      event: "realtimekit_webhook_received",
      status: "accepted",
      eventType: "meeting.ended",
      meetingId: "meeting-id",
      timestamp: "2026-05-27T00:00:00.000Z",
      payload: {
        event: "meeting.ended",
        meeting_id: "meeting-id",
        timestamp: "2026-05-27T00:00:00.000Z",
        token: "[redacted]",
        nested: {
          authorization: "[redacted]",
          status: "ended",
        },
      },
    },
  ]);
  assert.equal(JSON.stringify(loggerRecords).includes("participant-token"), false);
  assert.equal(JSON.stringify(loggerRecords).includes("server-token"), false);
});

test("POST /api/realtimekit/webhook accepts unknown object payload shape", async () => {
  const loggerRecords: Record<string, unknown>[] = [];
  const app = createApp({
    logger: {
      info: (record) => loggerRecords.push(record),
      error: (record) => loggerRecords.push(record),
    },
  });

  const response = await app.request("/api/realtimekit/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      arbitrary: "value",
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(loggerRecords, [
    {
      event: "realtimekit_webhook_received",
      status: "accepted",
      payload: {
        arbitrary: "value",
      },
    },
  ]);
});

test("POST /api/realtimekit/webhook rejects invalid JSON safely", async () => {
  const loggerRecords: Record<string, unknown>[] = [];
  const app = createApp({
    logger: {
      info: (record) => loggerRecords.push(record),
      error: (record) => loggerRecords.push(record),
    },
  });

  const response = await app.request("/api/realtimekit/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_webhook_payload",
      message: "Webhook payload must be a JSON object.",
    },
  });
  assert.deepEqual(loggerRecords, [
    {
      event: "realtimekit_webhook_rejected",
      status: "invalid_payload",
    },
  ]);
});

test("POST /api/realtimekit/webhook rejects non-object JSON safely", async () => {
  const loggerRecords: Record<string, unknown>[] = [];
  const app = createApp({
    logger: {
      info: (record) => loggerRecords.push(record),
      error: (record) => loggerRecords.push(record),
    },
  });

  const response = await app.request("/api/realtimekit/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["meeting.ended"]),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(loggerRecords, [
    {
      event: "realtimekit_webhook_rejected",
      status: "invalid_payload",
    },
  ]);
});
