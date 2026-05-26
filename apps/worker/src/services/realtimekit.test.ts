import assert from "node:assert/strict";
import test from "node:test";
import {
  createRealtimeKitMeetingForCreator,
  joinRealtimeKitMeeting,
  RealtimeKitApiError,
} from "./realtimekit";
import type { WorkerEnv } from "../schemas/env";

const env: WorkerEnv = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  REALTIMEKIT_APP_ID: "app-id",
  REALTIMEKIT_PRESET_NAME: "group_call_host",
  CLOUDFLARE_API_TOKEN: "server-token",
};

type FetchCall = {
  input: string;
  init: RequestInit | undefined;
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

test("createRealtimeKitMeetingForCreator creates meeting and participant", async () => {
  const calls: FetchCall[] = [];
  const loggerRecords: Record<string, unknown>[] = [];
  const fetcher = async (input: string, init?: RequestInit) => {
    calls.push({ input, init });

    if (calls.length === 1) {
      return jsonResponse({
        success: true,
        data: {
          id: "meeting-id",
        },
      });
    }

    return jsonResponse({
      success: true,
      data: {
        token: "participant-token",
      },
    });
  };

  const result = await createRealtimeKitMeetingForCreator({
    env,
    input: {
      displayName: "Ada",
      title: "Design review",
    },
    fetcher,
    idFactory: () => "participant-id",
    logger: {
      info: (record) => loggerRecords.push(record),
      error: (record) => loggerRecords.push(record),
    },
  });

  assert.deepEqual(result, {
    meetingId: "meeting-id",
    authToken: "participant-token",
  });

  assert.equal(calls.length, 2);
  assert.equal(
    calls[0]?.input,
    "https://api.cloudflare.com/client/v4/accounts/account-id/realtime/kit/app-id/meetings",
  );
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(await bodyJson(calls[0]?.init), {
    title: "Design review",
  });

  assert.equal(
    calls[1]?.input,
    "https://api.cloudflare.com/client/v4/accounts/account-id/realtime/kit/app-id/meetings/meeting-id/participants",
  );
  assert.deepEqual(await bodyJson(calls[1]?.init), {
    custom_participant_id: "participant-id",
    preset_name: "group_call_host",
    name: "Ada",
  });

  assert.equal(getHeader(calls[0]?.init, "Authorization"), "Bearer server-token");
  assert.equal(getHeader(calls[1]?.init, "Authorization"), "Bearer server-token");
  assert.equal(getHeader(calls[0]?.init, "Content-Type"), "application/json");
  assert.deepEqual(loggerRecords, [
    {
      event: "meeting_create_requested",
      has_title: true,
    },
  ]);
});

test("createRealtimeKitMeetingForCreator omits title when absent", async () => {
  const calls: FetchCall[] = [];
  const fetcher = async (input: string, init?: RequestInit) => {
    calls.push({ input, init });

    if (calls.length === 1) {
      return jsonResponse({ success: true, data: { id: "meeting-id" } });
    }

    return jsonResponse({ success: true, data: { token: "participant-token" } });
  };

  await createRealtimeKitMeetingForCreator({
    env,
    input: { displayName: "Ada" },
    fetcher,
    idFactory: () => "participant-id",
    logger: noopLogger,
  });

  assert.deepEqual(await bodyJson(calls[0]?.init), {});
});

test("createRealtimeKitMeetingForCreator returns safe error on meeting failure", async () => {
  const loggerRecords: Record<string, unknown>[] = [];
  const fetcher = async () =>
    jsonResponse({ success: false, errors: [{ message: "nope" }] }, { status: 403 });

  await assert.rejects(
    () =>
      createRealtimeKitMeetingForCreator({
        env,
        input: { displayName: "Ada" },
        fetcher,
        idFactory: () => "participant-id",
        logger: {
          info: (record) => loggerRecords.push(record),
          error: (record) => loggerRecords.push(record),
        },
      }),
    (error) => {
      assert.equal(error instanceof RealtimeKitApiError, true);
      assert.equal((error as RealtimeKitApiError).message, "Failed to create RealtimeKit meeting");
      assert.deepEqual((error as RealtimeKitApiError).details, {
        stage: "meeting",
        status: 403,
      });
      assert.equal(JSON.stringify(error).includes("server-token"), false);
      return true;
    },
  );

  assert.deepEqual(loggerRecords, [
    { event: "meeting_create_requested", has_title: false },
    {
      event: "cloudflare_realtimekit_request_failed",
      stage: "meeting",
      status: 403,
    },
  ]);
});

test("createRealtimeKitMeetingForCreator returns safe error on participant failure", async () => {
  const fetcher = async (_input: string, _init?: RequestInit) => {
    if (_input.endsWith("/meetings")) {
      return jsonResponse({ success: true, data: { id: "meeting-id" } });
    }

    return jsonResponse({ success: false }, { status: 500 });
  };

  await assert.rejects(
    () =>
      createRealtimeKitMeetingForCreator({
        env,
        input: { displayName: "Ada" },
        fetcher,
        idFactory: () => "participant-id",
        logger: noopLogger,
      }),
    (error) => {
      assert.equal(error instanceof RealtimeKitApiError, true);
      assert.equal(
        (error as RealtimeKitApiError).message,
        "Failed to create RealtimeKit participant",
      );
      assert.deepEqual((error as RealtimeKitApiError).details, {
        stage: "participant",
        status: 500,
      });
      assert.equal(JSON.stringify(error).includes("server-token"), false);
      return true;
    },
  );
});

test("createRealtimeKitMeetingForCreator fails safely on unexpected token shape", async () => {
  const fetcher = async (_input: string, _init?: RequestInit) => {
    if (_input.endsWith("/meetings")) {
      return jsonResponse({ success: true, data: { id: "meeting-id" } });
    }

    return jsonResponse({ success: true, data: { authToken: "wrong-field" } });
  };

  await assert.rejects(
    () =>
      createRealtimeKitMeetingForCreator({
        env,
        input: { displayName: "Ada" },
        fetcher,
        idFactory: () => "participant-id",
        logger: noopLogger,
      }),
    /Unexpected RealtimeKit participant response/,
  );
});

test("joinRealtimeKitMeeting adds participant to provided meeting", async () => {
  const calls: FetchCall[] = [];
  const loggerRecords: Record<string, unknown>[] = [];
  const fetcher = async (input: string, init?: RequestInit) => {
    calls.push({ input, init });

    return jsonResponse({
      success: true,
      data: {
        token: "participant-token",
      },
    });
  };

  const result = await joinRealtimeKitMeeting({
    env,
    meetingId: "existing-meeting-id",
    input: { displayName: "Grace" },
    fetcher,
    idFactory: () => "participant-id",
    logger: {
      info: (record) => loggerRecords.push(record),
      error: (record) => loggerRecords.push(record),
    },
  });

  assert.deepEqual(result, {
    meetingId: "existing-meeting-id",
    authToken: "participant-token",
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.input,
    "https://api.cloudflare.com/client/v4/accounts/account-id/realtime/kit/app-id/meetings/existing-meeting-id/participants",
  );
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(await bodyJson(calls[0]?.init), {
    custom_participant_id: "participant-id",
    preset_name: "group_call_host",
    name: "Grace",
  });
  assert.equal(getHeader(calls[0]?.init, "Authorization"), "Bearer server-token");
  assert.deepEqual(loggerRecords, [
    {
      event: "meeting_join_requested",
    },
  ]);
});

test("joinRealtimeKitMeeting URL-encodes provided meeting ID", async () => {
  const calls: FetchCall[] = [];
  const fetcher = async (input: string, init?: RequestInit) => {
    calls.push({ input, init });

    return jsonResponse({ success: true, data: { token: "participant-token" } });
  };

  await joinRealtimeKitMeeting({
    env,
    meetingId: "meeting id/with slash",
    input: { displayName: "Grace" },
    fetcher,
    idFactory: () => "participant-id",
    logger: noopLogger,
  });

  assert.equal(
    calls[0]?.input,
    "https://api.cloudflare.com/client/v4/accounts/account-id/realtime/kit/app-id/meetings/meeting%20id%2Fwith%20slash/participants",
  );
});

test("joinRealtimeKitMeeting returns safe error on participant failure", async () => {
  const loggerRecords: Record<string, unknown>[] = [];
  const fetcher = async () =>
    jsonResponse({ success: false, errors: [{ message: "nope" }] }, { status: 404 });

  await assert.rejects(
    () =>
      joinRealtimeKitMeeting({
        env,
        meetingId: "missing-meeting",
        input: { displayName: "Grace" },
        fetcher,
        idFactory: () => "participant-id",
        logger: {
          info: (record) => loggerRecords.push(record),
          error: (record) => loggerRecords.push(record),
        },
      }),
    (error) => {
      assert.equal(error instanceof RealtimeKitApiError, true);
      assert.equal(
        (error as RealtimeKitApiError).message,
        "Failed to create RealtimeKit participant",
      );
      assert.deepEqual((error as RealtimeKitApiError).details, {
        stage: "participant",
        status: 404,
      });
      assert.equal(JSON.stringify(error).includes("server-token"), false);
      return true;
    },
  );

  assert.deepEqual(loggerRecords, [
    {
      event: "meeting_join_requested",
    },
    {
      event: "cloudflare_realtimekit_request_failed",
      stage: "participant",
      status: 404,
    },
  ]);
});

async function bodyJson(init: RequestInit | undefined): Promise<unknown> {
  const body = init?.body;
  if (typeof body !== "string") {
    throw new Error("Expected JSON string body");
  }

  return JSON.parse(body);
}

function getHeader(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

const noopLogger = {
  info: () => undefined,
  error: () => undefined,
};
