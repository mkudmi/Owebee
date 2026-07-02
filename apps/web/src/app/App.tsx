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
import type { ExpenseFormProps } from "../components/ExpenseForm.js";
import {
  createDefaultExpenseDraft,
  createOfflineExpenseSaver,
  validateExpenseDraft,
  type ExpenseDraft,
  type ExpenseDraftField
} from "../offline/expense-draft.js";
import {
  createOutbox,
  type ExpenseCreateMutation,
  type Outbox
} from "../offline/outbox.js";
import {
  buildWorkspaceReferenceSnapshot,
  createWorkspaceReferenceCache,
  type WorkspaceReferenceCache,
  type WorkspaceReferenceSnapshot
} from "../offline/workspace-reference-cache.js";

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
  const [pendingExpenses, setPendingExpenses] = useState<
    ExpenseCreateMutation[]
  >([]);
  const [references, setReferences] =
    useState<WorkspaceReferenceSnapshot | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [draftErrors, setDraftErrors] = useState<
    Partial<Record<ExpenseDraftField, string>>
  >({});
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [localReadError, setLocalReadError] = useState<string | null>(null);
  const latestRequestId = useRef(0);
  const draftOpenRef = useRef(false);
  const latestReferencesRef =
    useRef<WorkspaceReferenceSnapshot | null>(null);
  const referenceWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const outbox = useMemo(() => createOutbox(), []);
  const referenceCache = useMemo(() => createWorkspaceReferenceCache(), []);
  const api = useMemo(
    () =>
      createOwebeeApi({
        baseUrl:
          import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"
      }),
    []
  );
  const saveExpense = useMemo(
    () =>
      createOfflineExpenseSaver({
        outbox,
        createId: createClientMutationId,
        now: () => new Date().toISOString(),
        persistStorage: requestPersistentStorage
      }),
    [outbox]
  );

  const loadWorkspace = useCallback(async () => {
    const requestId = ++latestRequestId.current;

    if (!session) {
      setState({ kind: "no-session" });
      return;
    }

    setState({ kind: "loading", session });

    const localWorkspace = await loadLocalWorkspace(
      outbox,
      referenceCache,
      session.tripId
    );
    if (requestId !== latestRequestId.current) {
      return;
    }
    setPendingExpenses(localWorkspace.pendingExpenses);
    setLocalReadError(
      localWorkspace.pendingLoadFailed
        ? "Не удалось прочитать локально сохранённые расходы. Повторите загрузку, чтобы проверить pending-операции."
        : null
    );
    const restoredReferences =
      localWorkspace.references ??
        (isExpensePreviewSession(session)
          ? createExpensePreviewReferences()
          : null);
    latestReferencesRef.current = restoredReferences;
    setReferences(restoredReferences);

    if (isExpensePreviewSession(session)) {
      setState({ kind: "empty", session });
      return;
    }

    void (async () => {
      try {
        const [participants, currencies] = await Promise.all([
          api.listParticipants(session),
          api.listCurrencies()
        ]);
        const snapshot = buildWorkspaceReferenceSnapshot(
          participants,
          currencies
        );
        const writeTask = referenceWriteQueue.current
          .catch(() => undefined)
          .then(async () => {
            if (requestId !== latestRequestId.current) return;
            try {
              await referenceCache.put(snapshot);
            } catch {
              // Valid online references remain usable for this session.
            }
            if (requestId !== latestRequestId.current) return;
            latestReferencesRef.current = snapshot;
            if (!draftOpenRef.current) {
              setReferences(snapshot);
            }
          });
        referenceWriteQueue.current = writeTask;
        await writeTask;
      } catch {
        // Cached references keep offline creation available.
      }
    })();

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
  }, [api, outbox, referenceCache, session]);

  useEffect(() => {
    if (session) {
      void loadWorkspace();
    }

    return () => {
      latestRequestId.current += 1;
    };
  }, [loadWorkspace, session]);

  const openExpenseForm = useCallback(() => {
    if (!references) return;
    draftOpenRef.current = true;
    setDraft(createDefaultExpenseDraft(references, localIsoDate(new Date())));
    setDraftErrors({});
    setStorageError(null);
    setAnnouncement(null);
  }, [references]);

  const changeDraft: ExpenseFormProps["onChange"] = useCallback(
    (field, value) => {
      setDraft((current) =>
        current ? { ...current, [field]: value } : current
      );
      setDraftErrors((current) => clearDraftError(current, field));
      setStorageError(null);
    },
    []
  );

  const toggleDraftTarget = useCallback((key: string) => {
    setDraft((current) => {
      if (!current) return current;
      const selectedTargetKeys = current.selectedTargetKeys.includes(key)
        ? current.selectedTargetKeys.filter((target) => target !== key)
        : [...current.selectedTargetKeys, key];
      return { ...current, selectedTargetKeys };
    });
    setDraftErrors((current) => clearDraftError(current, "splitTargets"));
    setStorageError(null);
  }, []);

  const submitExpense = useCallback(async () => {
    if (!session || !references || !draft || saving) return;
    const validation = validateExpenseDraft(draft, references);
    if (!validation.ok) {
      setDraftErrors(validation.errors);
      return;
    }

    setSaving(true);
    setStorageError(null);
    try {
      const mutation = await saveExpense({
        tripId: session.tripId,
        payload: validation.payload
      });
      setPendingExpenses((current) => [
        mutation,
        ...current.filter(
          (item) => item.clientMutationId !== mutation.clientMutationId
        )
      ]);
      draftOpenRef.current = false;
      setReferences(latestReferencesRef.current);
      setDraft(null);
      setDraftErrors({});
      setAnnouncement(
        "Сохранено на этом устройстве. Расход ожидает синхронизации."
      );
    } catch {
      setStorageError(
        "Не удалось сохранить расход на этом устройстве. Данные формы не потеряны — освободите место и попробуйте снова."
      );
    } finally {
      setSaving(false);
    }
  }, [draft, references, saveExpense, saving, session]);

  const expenseForm: ExpenseFormProps | null =
    draft && references
      ? {
          draft,
          references,
          errors: draftErrors,
          storageError,
          saving,
          onChange: changeDraft,
          onToggleTarget: toggleDraftTarget,
          onCancel: () => {
            if (!saving) {
              draftOpenRef.current = false;
              setReferences(latestReferencesRef.current);
              setDraft(null);
            }
          },
          onSubmit: () => void submitExpense()
        }
      : null;

  return (
    <AppShell
      state={state}
      onRetry={() => void loadWorkspace()}
      pendingExpenses={pendingExpenses}
      references={references}
      onOpenExpenseForm={openExpenseForm}
      expenseForm={expenseForm}
      announcement={announcement}
      localReadError={localReadError}
    />
  );
}

export async function loadLocalWorkspace(
  outbox: Outbox,
  referenceCache: WorkspaceReferenceCache,
  tripId: string
): Promise<{
  pendingExpenses: ExpenseCreateMutation[];
  pendingLoadFailed: boolean;
  references: WorkspaceReferenceSnapshot | null;
}> {
  const [pendingResult, referencesResult] = await Promise.allSettled([
    outbox.listPendingExpenses(tripId),
    referenceCache.get(tripId)
  ]);
  return {
    pendingExpenses:
      pendingResult.status === "fulfilled" ? pendingResult.value : [],
    pendingLoadFailed: pendingResult.status === "rejected",
    references:
      referencesResult.status === "fulfilled" ? referencesResult.value : null
  };
}

function readBrowserSession(): WorkspaceSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("expense-preview")
  ) {
    return {
      version: 1,
      tripId: "expense-preview-trip",
      token: "development-preview",
      tripName: "Поездка в Грузию"
    };
  }

  try {
    return loadWorkspaceSession(window.localStorage);
  } catch {
    return null;
  }
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clearDraftError(
  errors: Partial<Record<ExpenseDraftField, string>>,
  field: ExpenseDraftField
) {
  const next = { ...errors };
  delete next[field];
  return next;
}

export function createClientMutationId(
  randomUUID: (() => string) | null = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID.bind(globalThis.crypto)
    : null
): string {
  if (randomUUID) {
    return randomUUID();
  }
  throw new Error("Secure UUID generation is unavailable");
}

async function requestPersistentStorage(): Promise<boolean> {
  return (await globalThis.navigator?.storage?.persist?.()) ?? false;
}

function isExpensePreviewSession(session: WorkspaceSession): boolean {
  return (
    import.meta.env.DEV &&
    session.tripId === "expense-preview-trip" &&
    session.token === "development-preview"
  );
}

function createExpensePreviewReferences(): WorkspaceReferenceSnapshot {
  return {
    tripId: "expense-preview-trip",
    members: [
      { id: "member-elena", displayName: "Елена", role: "owner" },
      { id: "member-ivan", displayName: "Иван", role: "participant" }
    ],
    families: [
      {
        id: "family-ivanovy",
        displayName: "Семья Ивановых",
        shareCount: "2"
      }
    ],
    currencies: [
      {
        code: "RUB",
        displayName: "Российский рубль",
        symbol: "₽",
        minorUnits: 2
      },
      {
        code: "EUR",
        displayName: "Евро",
        symbol: "€",
        minorUnits: 2
      }
    ],
    updatedAt: new Date().toISOString()
  };
}
