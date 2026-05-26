import { z } from "zod";

const webhookPayloadObjectSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => !Array.isArray(value), {
    message: "webhook payload must be an object",
  });

export const realtimeKitWebhookPayloadSchema = z.preprocess((value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value;
}, webhookPayloadObjectSchema);

export type RealtimeKitWebhookPayload = z.infer<
  typeof realtimeKitWebhookPayloadSchema
>;

export type SafeWebhookMetadata = {
  eventType?: string;
  meetingId?: string;
  timestamp?: string;
};

const REDACTED_VALUE = "[redacted]";
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 50;
const MAX_DEPTH = 4;

/*
  Keep the metadata allow-list explicit so stable log fields stay queryable.
  Full shape discovery uses sanitizeWebhookPayloadForLog below.
*/
export function extractSafeWebhookMetadata(
  payload: RealtimeKitWebhookPayload,
): SafeWebhookMetadata {
  const metadata: SafeWebhookMetadata = {};
  const eventType = firstString(payload.event, payload.type);
  const meetingId = firstString(payload.meeting_id, payload.meetingId);
  const timestamp = firstString(payload.timestamp, payload.created_at);

  if (eventType !== undefined) {
    metadata.eventType = eventType;
  }

  if (meetingId !== undefined) {
    metadata.meetingId = meetingId;
  }

  if (timestamp !== undefined) {
    metadata.timestamp = timestamp;
  }

  return metadata;
}

export function sanitizeWebhookPayloadForLog(
  payload: RealtimeKitWebhookPayload,
): Record<string, unknown> {
  return sanitizeObject(payload, 0);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return undefined;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return "[max-depth]";
    }

    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) {
      return "[max-depth]";
    }

    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }

  return String(value);
}

function sanitizeObject(
  value: Record<string, unknown>,
  depth: number,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    output[key] = isSensitiveKey(key)
      ? REDACTED_VALUE
      : sanitizeValue(nestedValue, depth);
  }

  return output;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return (
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("authorization") ||
    normalized.includes("password") ||
    normalized === "api_key" ||
    normalized === "apikey" ||
    normalized.endsWith("_key")
  );
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}
