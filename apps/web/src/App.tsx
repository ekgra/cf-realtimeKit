import { type FormEvent, useEffect, useState } from "react";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";

type CreateMeetingResponse = {
  meetingId: string;
  authToken: string;
};

type MeetingState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "joining" }
  | { status: "ready"; meetingId: string; authToken: string }
  | { status: "meeting"; meetingId: string; authToken: string }
  | { status: "error"; message: string };

export function App() {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [joinMeetingId, setJoinMeetingId] = useState("");
  const [meetingState, setMeetingState] = useState<MeetingState>({
    status: "idle",
  });

  const isBusy =
    meetingState.status === "creating" || meetingState.status === "joining";
  const meetingId =
    meetingState.status === "ready" || meetingState.status === "meeting"
      ? meetingState.meetingId
      : "";

  useEffect(() => {
    if (meetingState.status !== "ready") {
      return;
    }

    let isCurrent = true;

    initMeeting({ authToken: meetingState.authToken })
      .then((loadedMeeting) => {
        if (!isCurrent) {
          return;
        }

        if (!loadedMeeting) {
          throw new Error("Meeting UI could not be initialized. Try again.");
        }

        setMeetingState({
          status: "meeting",
          meetingId: meetingState.meetingId,
          authToken: meetingState.authToken,
        });
      })
      .catch((error) => {
        if (!isCurrent) {
          return;
        }

        setMeetingState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Meeting UI could not be initialized. Try again.",
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [meetingState, initMeeting]);

  async function handleCreateMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    const trimmedTitle = title.trim();

    if (!trimmedDisplayName) {
      setMeetingState({
        status: "error",
        message: "Enter a display name before creating a meeting.",
      });
      return;
    }

    setMeetingState({ status: "creating" });

    try {
      const body = await postMeeting("/api/meetings", {
        displayName: trimmedDisplayName,
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
      });

      setMeetingState({
        status: "ready",
        meetingId: body.meetingId,
        authToken: body.authToken,
      });
      setJoinMeetingId(body.meetingId);
    } catch (error) {
      setMeetingState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not create the meeting. Try again.",
      });
    }
  }

  async function handleJoinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    const trimmedMeetingId = joinMeetingId.trim();

    if (!trimmedDisplayName || !trimmedMeetingId) {
      setMeetingState({
        status: "error",
        message: "Enter a meeting ID and display name before joining.",
      });
      return;
    }

    setMeetingState({ status: "joining" });

    try {
      const body = await postMeeting(
        `/api/meetings/${encodeURIComponent(trimmedMeetingId)}/join`,
        {
          displayName: trimmedDisplayName,
        },
      );

      setMeetingState({
        status: "ready",
        meetingId: body.meetingId,
        authToken: body.authToken,
      });
      setJoinMeetingId(body.meetingId);
    } catch (error) {
      setMeetingState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not join the meeting. Check the meeting ID.",
      });
    }
  }

  async function postMeeting(
    url: string,
    payload: Record<string, string>,
  ): Promise<CreateMeetingResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Meeting request failed. Try again.");
    }

    const body = (await response.json()) as Partial<CreateMeetingResponse>;

    if (!body.meetingId || !body.authToken) {
      throw new Error("Meeting response was incomplete. Try again.");
    }

    return {
      meetingId: body.meetingId,
      authToken: body.authToken,
    };
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="app-title">
        <div className="summary">
          <p className="eyebrow">Cloudflare RealtimeKit Demo</p>
          <h1 id="app-title">Create or join meeting</h1>
          <p>
            Start a RealtimeKit meeting or join one by pasting an existing
            meeting ID.
          </p>
        </div>

        <div className="meeting-panel">
          <label className="field">
            <span>Display name</span>
            <input
              autoComplete="name"
              disabled={isBusy}
              name="displayName"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ada"
              value={displayName}
            />
          </label>

          <div className="meeting-actions">
            <form className="meeting-form" onSubmit={handleCreateMeeting}>
              <label className="field">
                <span>Meeting title</span>
                <input
                  disabled={isBusy}
                  name="title"
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Design review"
                  value={title}
                />
              </label>

              <button
                className="primary-action"
                disabled={isBusy}
                type="submit"
              >
                {meetingState.status === "creating"
                  ? "Creating..."
                  : "Create meeting"}
              </button>
            </form>

            <form className="meeting-form" onSubmit={handleJoinMeeting}>
              <label className="field">
                <span>Meeting ID</span>
                <input
                  disabled={isBusy}
                  name="meetingId"
                  onChange={(event) => setJoinMeetingId(event.target.value)}
                  placeholder="Paste meeting ID"
                  value={joinMeetingId}
                />
              </label>

              <button
                className="primary-action secondary-action"
                disabled={isBusy}
                type="submit"
              >
                {meetingState.status === "joining"
                  ? "Joining..."
                  : "Join meeting"}
              </button>
            </form>
          </div>
        </div>

        {meetingState.status === "error" ? (
          <p className="status status-error" role="alert">
            {meetingState.message}
          </p>
        ) : null}

        {meetingState.status === "ready" || meetingState.status === "meeting" ? (
          <section className="meeting-result" aria-label="Created meeting">
            <div>
              <span>Meeting ID</span>
              <strong>{meetingId}</strong>
            </div>
            {meeting ? null : <p>Preparing meeting UI...</p>}
          </section>
        ) : null}
      </section>

      {meeting ? (
        <section className="meeting-stage" aria-label="RealtimeKit meeting">
          <RealtimeKitProvider value={meeting}>
            <RtkMeeting
              leaveOnUnmount={true}
              meeting={meeting}
              mode="fill"
              showSetupScreen={true}
            />
          </RealtimeKitProvider>
        </section>
      ) : null}
    </main>
  );
}
