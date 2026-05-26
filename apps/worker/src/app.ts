import { Hono } from "hono";
import { validateWorkerEnv } from "./schemas/env";
import { createMeetingRequestSchema } from "./schemas/meetings";
import {
  createRealtimeKitMeetingForCreator,
  RealtimeKitApiError,
} from "./services/realtimekit";

type Bindings = {
  CLOUDFLARE_ACCOUNT_ID: string;
  REALTIMEKIT_APP_ID: string;
  REALTIMEKIT_PRESET_NAME: string;
  CLOUDFLARE_API_TOKEN: string;
};

type CreateMeetingService = typeof createRealtimeKitMeetingForCreator;

type AppDependencies = {
  createMeetingForCreator?: CreateMeetingService;
};

export function createApp({
  createMeetingForCreator = createRealtimeKitMeetingForCreator,
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
