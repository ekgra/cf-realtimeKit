import { z } from "zod";

const optionalTrimmedTitle = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().max(120, "title must be at most 120 characters").optional());

export const createMeetingRequestSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "displayName is required")
      .max(100, "displayName must be at most 100 characters"),
    title: optionalTrimmedTitle,
  })
  .strict()
  .transform(({ displayName, title }) => {
    if (title === undefined) {
      return { displayName };
    }

    return { displayName, title };
  });

export type CreateMeetingRequest = z.infer<typeof createMeetingRequestSchema>;

export const createMeetingResponseSchema = z
  .object({
    meetingId: z.string().trim().min(1, "meetingId is required"),
    authToken: z.string().trim().min(1, "authToken is required"),
  })
  .strict();

export type CreateMeetingResponse = z.infer<typeof createMeetingResponseSchema>;
