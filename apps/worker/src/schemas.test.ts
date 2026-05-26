import assert from "node:assert/strict";
import test from "node:test";
import { EnvValidationError, validateWorkerEnv } from "./schemas/env";
import {
  createMeetingRequestSchema,
  createMeetingResponseSchema,
} from "./schemas/meetings";

const validEnv = {
  CLOUDFLARE_ACCOUNT_ID: " account-id ",
  REALTIMEKIT_APP_ID: " app-id ",
  REALTIMEKIT_PRESET_NAME: " preset-name ",
  CLOUDFLARE_API_TOKEN: " token ",
};

test("validateWorkerEnv trims required env values", () => {
  assert.deepEqual(validateWorkerEnv(validEnv), {
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    REALTIMEKIT_APP_ID: "app-id",
    REALTIMEKIT_PRESET_NAME: "preset-name",
    CLOUDFLARE_API_TOKEN: "token",
  });
});

test("validateWorkerEnv reports deterministic errors for missing or blank values", () => {
  assert.throws(
    () =>
      validateWorkerEnv({
        CLOUDFLARE_ACCOUNT_ID: "",
        REALTIMEKIT_APP_ID: "app-id",
        CLOUDFLARE_API_TOKEN: "   ",
      }),
    (error) => {
      assert.equal(error instanceof EnvValidationError, true);
      assert.deepEqual((error as EnvValidationError).issues, [
        "CLOUDFLARE_ACCOUNT_ID is required",
        "REALTIMEKIT_PRESET_NAME is required",
        "CLOUDFLARE_API_TOKEN is required",
      ]);
      return true;
    },
  );
});

test("createMeetingRequestSchema accepts and trims valid input", () => {
  assert.deepEqual(
    createMeetingRequestSchema.parse({
      displayName: " Ada ",
      title: " Design review ",
    }),
    {
      displayName: "Ada",
      title: "Design review",
    },
  );
});

test("createMeetingRequestSchema allows an omitted or blank title", () => {
  assert.deepEqual(
    createMeetingRequestSchema.parse({
      displayName: "Ada",
      title: " ",
    }),
    {
      displayName: "Ada",
    },
  );
});

test("createMeetingRequestSchema rejects missing displayName", () => {
  const result = createMeetingRequestSchema.safeParse({ title: "Planning" });

  assert.equal(result.success, false);
});

test("createMeetingRequestSchema rejects empty displayName", () => {
  const result = createMeetingRequestSchema.safeParse({ displayName: "   " });

  assert.equal(result.success, false);
});

test("createMeetingResponseSchema accepts only safe frontend response shape", () => {
  assert.deepEqual(
    createMeetingResponseSchema.parse({
      meetingId: " meeting-id ",
      authToken: " participant-token ",
    }),
    {
      meetingId: "meeting-id",
      authToken: "participant-token",
    },
  );
});
