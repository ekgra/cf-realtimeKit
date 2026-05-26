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
