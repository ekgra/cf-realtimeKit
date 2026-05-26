import assert from "node:assert/strict";
import test from "node:test";
import {
  extractSafeWebhookMetadata,
  realtimeKitWebhookPayloadSchema,
  sanitizeWebhookPayloadForLog,
} from "./schemas/webhooks";

test("realtimeKitWebhookPayloadSchema accepts JSON object payloads", () => {
  assert.deepEqual(
    realtimeKitWebhookPayloadSchema.parse({
      event: "meeting.ended",
      meeting_id: "meeting-id",
      timestamp: "2026-05-27T00:00:00.000Z",
    }),
    {
      event: "meeting.ended",
      meeting_id: "meeting-id",
      timestamp: "2026-05-27T00:00:00.000Z",
    },
  );
});

test("realtimeKitWebhookPayloadSchema rejects non-object payloads", () => {
  assert.equal(realtimeKitWebhookPayloadSchema.safeParse(null).success, false);
  assert.equal(realtimeKitWebhookPayloadSchema.safeParse("event").success, false);
  assert.equal(realtimeKitWebhookPayloadSchema.safeParse(["event"]).success, false);
});

test("extractSafeWebhookMetadata extracts stable snake_case fields", () => {
  const payload = realtimeKitWebhookPayloadSchema.parse({
    event: " meeting.ended ",
    meeting_id: " meeting-id ",
    timestamp: " 2026-05-27T00:00:00.000Z ",
    ignored: {
      nested: true,
    },
  });

  assert.deepEqual(extractSafeWebhookMetadata(payload), {
    eventType: "meeting.ended",
    meetingId: "meeting-id",
    timestamp: "2026-05-27T00:00:00.000Z",
  });
});

test("extractSafeWebhookMetadata falls back to camelCase and created_at fields", () => {
  const payload = realtimeKitWebhookPayloadSchema.parse({
    type: "meeting.participantLeft",
    meetingId: "meeting-id",
    created_at: "2026-05-27T00:00:00.000Z",
  });

  assert.deepEqual(extractSafeWebhookMetadata(payload), {
    eventType: "meeting.participantLeft",
    meetingId: "meeting-id",
    timestamp: "2026-05-27T00:00:00.000Z",
  });
});

test("extractSafeWebhookMetadata omits unknown and token-like fields", () => {
  const payload = realtimeKitWebhookPayloadSchema.parse({
    event: "meeting.ended",
    token: "participant-token",
    authToken: "participant-token",
    authorization: "Bearer server-token",
    secret: "secret-value",
    payload: {
      meeting_id: "nested-meeting-id",
    },
  });

  assert.deepEqual(extractSafeWebhookMetadata(payload), {
    eventType: "meeting.ended",
  });
});

test("extractSafeWebhookMetadata returns empty metadata for object without stable fields", () => {
  const payload = realtimeKitWebhookPayloadSchema.parse({
    arbitrary: "value",
  });

  assert.deepEqual(extractSafeWebhookMetadata(payload), {});
});

test("sanitizeWebhookPayloadForLog preserves payload shape with redacted credentials", () => {
  const payload = realtimeKitWebhookPayloadSchema.parse({
    event: "meeting.ended",
    meeting_id: "meeting-id",
    token: "participant-token",
    authToken: "participant-token",
    authorization: "Bearer server-token",
    nested: {
      api_key: "api-key",
      safe: "value",
    },
    participants: [
      {
        name: "Ada",
        secret: "secret-value",
      },
    ],
  });

  assert.deepEqual(sanitizeWebhookPayloadForLog(payload), {
    event: "meeting.ended",
    meeting_id: "meeting-id",
    token: "[redacted]",
    authToken: "[redacted]",
    authorization: "[redacted]",
    nested: {
      api_key: "[redacted]",
      safe: "value",
    },
    participants: [
      {
        name: "Ada",
        secret: "[redacted]",
      },
    ],
  });
});

test("sanitizeWebhookPayloadForLog bounds large payload fields", () => {
  const payload = realtimeKitWebhookPayloadSchema.parse({
    longString: "x".repeat(550),
    items: Array.from({ length: 25 }, (_, index) => index),
    deep: {
      one: {
        two: {
          three: {
            four: {
              five: "too deep",
            },
          },
        },
      },
    },
  });

  const sanitized = sanitizeWebhookPayloadForLog(payload);

  assert.equal(
    sanitized.longString,
    `${"x".repeat(500)}...[truncated]`,
  );
  assert.equal((sanitized.items as unknown[]).length, 20);
  assert.deepEqual(sanitized.deep, {
    one: {
      two: {
        three: {
          four: "[max-depth]",
        },
      },
    },
  });
});
