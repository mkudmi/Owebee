import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createOwebeeApi,
  WorkspaceApiError
} from "../api/owebee-api.js";
import {
  loadWorkspaceSession,
  type WorkspaceSession
} from "./session.js";
import {
  AppShell,
  type WorkspaceViewState
} from "../components/AppShell.js";

export function createInitialWorkspaceState(
  session: WorkspaceSession | null
): WorkspaceViewState {
  return session ? { kind: "loading", session } : { kind: "no-session" };
}

export function App() {
  const [session] = useState(readBrowserSession);
  const [state, setState] = useState<WorkspaceViewState>(() =>
    createInitialWorkspaceState(session)
  );
  const latestRequestId = useRef(0);
  const api = useMemo(
    () =>
      createOwebeeApi({
        baseUrl:
          import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"
      }),
    []
  );

  const loadExpenses = useCallback(async () => {
    const requestId = ++latestRequestId.current;

    if (!session) {
      setState({ kind: "no-session" });
      return;
    }

    setState({ kind: "loading", session });

    try {
      const page = await api.listRecentExpenses(session);
      if (requestId !== latestRequestId.current) {
        return;
      }
      setState(
        page.items.length > 0
          ? { kind: "ready", session, expenses: page.items }
          : { kind: "empty", session }
      );
    } catch (error) {
      if (requestId !== latestRequestId.current) {
        return;
      }
      setState({
        kind: "error",
        session,
        message:
          error instanceof WorkspaceApiError
            ? error.message
            : "Не удалось загрузить расходы. Попробуйте снова."
      });
    }
  }, [api, session]);

  useEffect(() => {
    if (session) {
      void loadExpenses();
    }

    return () => {
      latestRequestId.current += 1;
    };
  }, [loadExpenses, session]);

  return <AppShell state={state} onRetry={() => void loadExpenses()} />;
}

function readBrowserSession(): WorkspaceSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return loadWorkspaceSession(window.localStorage);
  } catch {
    return null;
  }
}
