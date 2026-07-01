export const WORKSPACE_SESSION_KEY = "owebee.session.v1";

export interface WorkspaceSession {
  version: 1;
  tripId: string;
  token: string;
  tripName?: string;
}

export interface SessionStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export function parseWorkspaceSession(raw: string | null): WorkspaceSession | null {
  if (raw === null) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1) {
      return null;
    }

    const tripId = normalizedText(value.tripId);
    const token = normalizedText(value.token);
    if (!tripId || !token) {
      return null;
    }

    const tripName = normalizedText(value.tripName);
    return {
      version: 1,
      tripId,
      token,
      ...(tripName ? { tripName } : {})
    };
  } catch {
    return null;
  }
}

export function loadWorkspaceSession(
  storage: SessionStorage
): WorkspaceSession | null {
  const raw = storage.getItem(WORKSPACE_SESSION_KEY);
  const session = parseWorkspaceSession(raw);

  if (raw !== null && session === null) {
    storage.removeItem(WORKSPACE_SESSION_KEY);
  }

  return session;
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
