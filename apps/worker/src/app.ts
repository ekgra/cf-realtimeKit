import { Hono } from "hono";
import { validateWorkerEnv } from "./schemas/env";
import {
  createMeetingRequestSchema,
  joinMeetingRequestSchema,
  meetingIdPathSchema,
} from "./schemas/meetings";
import {
  extractSafeWebhookMetadata,
  realtimeKitWebhookPayloadSchema,
  sanitizeWebhookPayloadForLog,
} from "./schemas/webhooks";
import {
  createRealtimeKitMeetingForCreator,
  joinRealtimeKitMeeting,
  RealtimeKitApiError,
} from "./services/realtimekit";

type Bindings = {
  CLOUDFLARE_ACCOUNT_ID: string;
  REALTIMEKIT_APP_ID: string;
  REALTIMEKIT_PRESET_NAME: string;
  CLOUDFLARE_API_TOKEN: string;
};

type CreateMeetingService = typeof createRealtimeKitMeetingForCreator;
type JoinMeetingService = typeof joinRealtimeKitMeeting;
type SafeLogger = {
  info: (record: Record<string, unknown>) => void;
  error: (record: Record<string, unknown>) => void;
};

type AppDependencies = {
  createMeetingForCreator?: CreateMeetingService;
  joinMeeting?: JoinMeetingService;
  logger?: SafeLogger;
};

const defaultLogger: SafeLogger = {
  info: (record) => console.info(JSON.stringify(record)),
  error: (record) => console.error(JSON.stringify(record)),
};

export function createApp({
  createMeetingForCreator = createRealtimeKitMeetingForCreator,
  joinMeeting = joinRealtimeKitMeeting,
  logger = defaultLogger,
}: AppDependencies = {}) {
  const app = new Hono<{ Bindings: Bindings }>();

  app.get("/health", (context) => {
    return context.json({
      ok: true,
      service: "realtimekit-demo",
    });
  });

  app.post("/api/meetings", async (context) => {
    const body = await readJsonBody(context.req.raw);
    const parsedBody = createMeetingRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return context.json(
        {
          error: {
            code: "invalid_request",
            message: "Enter a display name before creating a meeting.",
          },
        },
        400,
      );
    }

    try {
      const env = validateWorkerEnv(context.env);
      const result = await createMeetingForCreator({
        env,
        input: parsedBody.data,
      });

      return context.json(result);
    } catch (error) {
      if (error instanceof RealtimeKitApiError) {
        return context.json(
          {
            error: {
              code: "realtimekit_request_failed",
              message: "Could not create the meeting. Try again later.",
            },
          },
          502,
        );
      }

      return context.json(
        {
          error: {
            code: "server_configuration_error",
            message: "Meeting creation is not configured.",
          },
        },
        500,
      );
    }
  });

  app.post("/api/meetings/:meetingId/join", async (context) => {
    const parsedMeetingId = meetingIdPathSchema.safeParse(
      context.req.param("meetingId"),
    );
    const body = await readJsonBody(context.req.raw);
    const parsedBody = joinMeetingRequestSchema.safeParse(body);

    if (!parsedMeetingId.success || !parsedBody.success) {
      return context.json(
        {
          error: {
            code: "invalid_request",
            message: "Enter a meeting ID and display name before joining.",
          },
        },
        400,
      );
    }

    try {
      const env = validateWorkerEnv(context.env);
      const result = await joinMeeting({
        env,
        meetingId: parsedMeetingId.data,
        input: parsedBody.data,
      });

      return context.json(result);
    } catch (error) {
      if (error instanceof RealtimeKitApiError) {
        return context.json(
          {
            error: {
              code: "realtimekit_request_failed",
              message: "Could not join the meeting. Check the meeting ID.",
            },
          },
          502,
        );
      }

      return context.json(
        {
          error: {
            code: "server_configuration_error",
            message: "Meeting join is not configured.",
          },
        },
        500,
      );
    }
  });

  app.post("/api/realtimekit/webhook", async (context) => {
    const body = await readJsonBody(context.req.raw);
    const parsedBody = realtimeKitWebhookPayloadSchema.safeParse(body);

    if (!parsedBody.success) {
      logger.error({
        event: "realtimekit_webhook_rejected",
        status: "invalid_payload",
      });

      return context.json(
        {
          error: {
            code: "invalid_webhook_payload",
            message: "Webhook payload must be a JSON object.",
          },
        },
        400,
      );
    }

    /*
      TODO: Implement RealtimeKit webhook signature verification if official
      docs publish clear headers and algorithm. Current docs inspected for V1
      do not clearly document signature verification.
    */
    const metadata = extractSafeWebhookMetadata(parsedBody.data);
    const payload = sanitizeWebhookPayloadForLog(parsedBody.data);

    logger.info({
      event: "realtimekit_webhook_received",
      status: "accepted",
      ...metadata,
      payload,
    });

    return context.json({
      ok: true,
    });
  });

  return app;
}

export const app = createApp();

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
