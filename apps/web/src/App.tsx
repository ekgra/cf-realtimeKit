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

type CreateState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "created"; meetingId: string; authToken: string }
  | { status: "meeting"; meetingId: string; authToken: string }
  | { status: "error"; message: string };

export function App() {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [createState, setCreateState] = useState<CreateState>({
    status: "idle",
  });

  const isCreating = createState.status === "creating";
  const meetingId =
    createState.status === "created" || createState.status === "meeting"
      ? createState.meetingId
      : "";

  useEffect(() => {
    if (createState.status !== "created") {
      return;
    }

    let isCurrent = true;

    initMeeting({ authToken: createState.authToken })
      .then((loadedMeeting) => {
        if (!isCurrent) {
          return;
        }

        if (!loadedMeeting) {
          throw new Error("Meeting UI could not be initialized. Try again.");
        }

        setCreateState({
          status: "meeting",
          meetingId: createState.meetingId,
          authToken: createState.authToken,
        });
      })
      .catch((error) => {
        if (!isCurrent) {
          return;
        }

        setCreateState({
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
  }, [createState, initMeeting]);

  async function handleCreateMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    const trimmedTitle = title.trim();

    if (!trimmedDisplayName) {
      setCreateState({
        status: "error",
        message: "Enter a display name before creating a meeting.",
      });
      return;
    }

    setCreateState({ status: "creating" });

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: trimmedDisplayName,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Could not create the meeting. Try again.");
      }

      const body = (await response.json()) as Partial<CreateMeetingResponse>;

      if (!body.meetingId || !body.authToken) {
        throw new Error("Meeting response was incomplete. Try again.");
      }

      setCreateState({
        status: "created",
        meetingId: body.meetingId,
        authToken: body.authToken,
      });
    } catch (error) {
      setCreateState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not create the meeting. Try again.",
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="app-title">
        <div className="summary">
          <p className="eyebrow">Cloudflare RealtimeKit Demo</p>
          <h1 id="app-title">Create meeting</h1>
          <p>
            Start a RealtimeKit meeting and keep the returned meeting ID ready for
            sharing.
          </p>
        </div>

        <form className="meeting-form" onSubmit={handleCreateMeeting}>
          <label className="field">
            <span>Display name</span>
            <input
              autoComplete="name"
              disabled={isCreating}
              name="displayName"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ada"
              value={displayName}
            />
          </label>

          <label className="field">
            <span>Meeting title</span>
            <input
              disabled={isCreating}
              name="title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Design review"
              value={title}
            />
          </label>

          <button className="primary-action" disabled={isCreating} type="submit">
            {isCreating ? "Creating..." : "Create meeting"}
          </button>
        </form>

        {createState.status === "error" ? (
          <p className="status status-error" role="alert">
            {createState.message}
          </p>
        ) : null}

        {createState.status === "created" || createState.status === "meeting" ? (
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
