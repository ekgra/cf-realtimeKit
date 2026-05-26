import { z } from "zod";
import type { WorkerEnv } from "../schemas/env";
import type {
  CreateMeetingRequest,
  CreateMeetingResponse,
  JoinMeetingRequest,
} from "../schemas/meetings";

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type IdFactory = () => string;

type SafeLogger = {
  info: (record: Record<string, unknown>) => void;
  error: (record: Record<string, unknown>) => void;
};

type CreateMeetingOptions = {
  env: WorkerEnv;
  input: CreateMeetingRequest;
  fetcher?: Fetcher;
  idFactory?: IdFactory;
  logger?: SafeLogger;
};

type JoinMeetingOptions = {
  env: WorkerEnv;
  meetingId: string;
  input: JoinMeetingRequest;
  fetcher?: Fetcher;
  idFactory?: IdFactory;
  logger?: SafeLogger;
};

const cloudflareMeetingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().min(1),
  }),
});

const cloudflareParticipantResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().min(1),
  }),
});

export class RealtimeKitApiError extends Error {
  constructor(
    message: string,
    readonly details: { status?: number; stage: "meeting" | "participant" },
  ) {
    super(message);
    this.name = "RealtimeKitApiError";
  }
}

const defaultLogger: SafeLogger = {
  info: (record) => console.info(JSON.stringify(record)),
  error: (record) => console.error(JSON.stringify(record)),
};

export async function createRealtimeKitMeetingForCreator({
  env,
  input,
  fetcher = fetch,
  idFactory = () => crypto.randomUUID(),
  logger = defaultLogger,
}: CreateMeetingOptions): Promise<CreateMeetingResponse> {
  logger.info({
    event: "meeting_create_requested",
    has_title: input.title !== undefined,
  });

  const meeting = await createMeeting({ env, input, fetcher, logger });
  const participant = await createParticipant({
    env,
    meetingId: meeting.id,
    displayName: input.displayName,
    customParticipantId: idFactory(),
    fetcher,
    logger,
  });

  return {
    meetingId: meeting.id,
    authToken: participant.token,
  };
}

export async function joinRealtimeKitMeeting({
  env,
  meetingId,
  input,
  fetcher = fetch,
  idFactory = () => crypto.randomUUID(),
  logger = defaultLogger,
}: JoinMeetingOptions): Promise<CreateMeetingResponse> {
  logger.info({
    event: "meeting_join_requested",
  });

  const participant = await createParticipant({
    env,
    meetingId,
    displayName: input.displayName,
    customParticipantId: idFactory(),
    fetcher,
    logger,
  });

  return {
    meetingId,
    authToken: participant.token,
  };
}

async function createMeeting({
  env,
  input,
  fetcher,
  logger,
}: {
  env: WorkerEnv;
  input: CreateMeetingRequest;
  fetcher: Fetcher;
  logger: SafeLogger;
}): Promise<{ id: string }> {
  const body = input.title === undefined ? {} : { title: input.title };
  const response = await fetcher(realtimeKitUrl(env, "meetings"), {
    method: "POST",
    headers: cloudflareHeaders(env),
    body: JSON.stringify(body),
  });

  const json = await readJson(response);

  if (!response.ok) {
    logCloudflareFailure(logger, "meeting", response.status);
    throw new RealtimeKitApiError("Failed to create RealtimeKit meeting", {
      stage: "meeting",
      status: response.status,
    });
  }

  const parsed = cloudflareMeetingResponseSchema.safeParse(json);

  if (!parsed.success) {
    logCloudflareFailure(logger, "meeting", response.status);
    throw new RealtimeKitApiError("Unexpected RealtimeKit meeting response", {
      stage: "meeting",
      status: response.status,
    });
  }

  return { id: parsed.data.data.id };
}

async function createParticipant({
  env,
  meetingId,
  displayName,
  customParticipantId,
  fetcher,
  logger,
}: {
  env: WorkerEnv;
  meetingId: string;
  displayName: string;
  customParticipantId: string;
  fetcher: Fetcher;
  logger: SafeLogger;
}): Promise<{ token: string }> {
  const response = await fetcher(
    realtimeKitUrl(env, `meetings/${encodeURIComponent(meetingId)}/participants`),
    {
      method: "POST",
      headers: cloudflareHeaders(env),
      body: JSON.stringify({
        custom_participant_id: customParticipantId,
        preset_name: env.REALTIMEKIT_PRESET_NAME,
        name: displayName,
      }),
    },
  );

  const json = await readJson(response);

  if (!response.ok) {
    logCloudflareFailure(logger, "participant", response.status);
    throw new RealtimeKitApiError("Failed to create RealtimeKit participant", {
      stage: "participant",
      status: response.status,
    });
  }

  const parsed = cloudflareParticipantResponseSchema.safeParse(json);

  if (!parsed.success) {
    logCloudflareFailure(logger, "participant", response.status);
    throw new RealtimeKitApiError(
      "Unexpected RealtimeKit participant response",
      {
        stage: "participant",
        status: response.status,
      },
    );
  }

  return { token: parsed.data.data.token };
}

function realtimeKitUrl(env: WorkerEnv, path: string): string {
  return `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(
    env.CLOUDFLARE_ACCOUNT_ID,
  )}/realtime/kit/${encodeURIComponent(env.REALTIMEKIT_APP_ID)}/${path}`;
}

function cloudflareHeaders(env: WorkerEnv): HeadersInit {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function logCloudflareFailure(
  logger: SafeLogger,
  stage: "meeting" | "participant",
  status: number,
): void {
  logger.error({
    event: "cloudflare_realtimekit_request_failed",
    stage,
    status,
  });
}
