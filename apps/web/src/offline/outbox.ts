import {
  openIndexedDatabase,
  requestResult,
  runStoreRequest
} from "./indexed-db.js";

export type MutationStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export interface ExpenseCreatePayload {
  payerMemberId: string;
  amount: string;
  currencyCode: string;
  expenseDate: string;
  description: string;
  splitTargets: Array<{
    type: "member" | "family";
    id: string;
  }>;
}

export interface SyncTestMutation {
  clientMutationId: string;
  tripId?: string | null;
  type: "sync.test";
  createdAt: string;
  payload: Record<string, unknown>;
  status: MutationStatus;
}

export interface ExpenseCreateMutation {
  clientMutationId: string;
  tripId: string;
  type: "expense.create";
  createdAt: string;
  payload: ExpenseCreatePayload;
  status: "pending";
}

export type OutboxMutation = SyncTestMutation | ExpenseCreateMutation;
export type NewOutboxMutation =
  | Omit<SyncTestMutation, "status">
  | Omit<ExpenseCreateMutation, "status">;

export interface Outbox {
  enqueue(mutation: NewOutboxMutation): Promise<OutboxMutation>;
  listPending(): Promise<OutboxMutation[]>;
  listPendingExpenses(tripId: string): Promise<ExpenseCreateMutation[]>;
  markSynced(clientMutationId: string): Promise<void>;
}

const STORE_NAME = "mutations";

export function createOutbox(databaseName = "owebee-outbox"): Outbox {
  const open = () =>
    openIndexedDatabase({
      name: databaseName,
      version: 1,
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, {
            keyPath: "clientMutationId"
          });
        }
      }
    });

  const withStore = <T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T> | Promise<IDBRequest<T>>
  ) =>
    runStoreRequest({
      open,
      storeName: STORE_NAME,
      mode,
      operation
    });

  return {
    async enqueue(mutation) {
      const pendingMutation: OutboxMutation = {
        ...mutation,
        status: "pending"
      } as OutboxMutation;
      if (!isOutboxMutation(pendingMutation)) {
        throw new Error("Outbox mutation is invalid");
      }
      await withStore("readwrite", (store) => store.add(pendingMutation));
      return pendingMutation;
    },

    async listPending() {
      const mutations = await withStore<unknown[]>("readonly", (store) =>
        store.getAll()
      );
      return mutations
        .filter(isOutboxMutation)
        .filter((mutation) => mutation.status === "pending");
    },

    async listPendingExpenses(tripId) {
      const mutations = await this.listPending();
      return mutations.filter(
        (mutation): mutation is ExpenseCreateMutation =>
          mutation.type === "expense.create" && mutation.tripId === tripId
      );
    },

    async markSynced(clientMutationId) {
      await withStore("readwrite", async (store) => {
        const value = await requestResult<unknown>(
          store.get(clientMutationId)
        );
        if (!isOutboxMutation(value)) {
          throw new Error(`Mutation ${clientMutationId} was not found`);
        }
        if (value.type !== "sync.test") {
          throw new Error("expense.create sync belongs to STORY-017");
        }

        return store.put({ ...value, status: "synced" });
      });
    }
  };
}

function isOutboxMutation(value: unknown): value is OutboxMutation {
  if (
    !isRecord(value) ||
    !hasText(value, "clientMutationId") ||
    !isIsoDateTime(value.createdAt) ||
    !isMutationStatus(value.status)
  ) {
    return false;
  }

  if (value.type === "sync.test") {
    return (
      (value.tripId === undefined ||
        value.tripId === null ||
        typeof value.tripId === "string") &&
      isRecord(value.payload)
    );
  }

  return (
    value.type === "expense.create" &&
    value.status === "pending" &&
    isUuid(value.clientMutationId) &&
    isUuid(value.tripId) &&
    isExpenseCreatePayload(value.payload)
  );
}

function isExpenseCreatePayload(
  value: unknown
): value is ExpenseCreatePayload {
  if (
    !isRecord(value) ||
    !isUuid(value.payerMemberId) ||
    !isPositiveDecimal(value.amount) ||
    typeof value.currencyCode !== "string" ||
    !/^[A-Z]{3}$/.test(value.currencyCode) ||
    !isRealIsoDate(value.expenseDate) ||
    typeof value.description !== "string" ||
    value.description.trim().length === 0 ||
    value.description.length > 500 ||
    !Array.isArray(value.splitTargets) ||
    value.splitTargets.length === 0
  ) {
    return false;
  }

  const keys = new Set<string>();
  for (const target of value.splitTargets) {
    if (
      !isRecord(target) ||
      (target.type !== "member" && target.type !== "family") ||
      !isUuid(target.id)
    ) {
      return false;
    }
    const key = `${target.type}:${target.id}`;
    if (keys.has(key)) return false;
    keys.add(key);
  }

  return true;
}

function isMutationStatus(value: unknown): value is MutationStatus {
  return (
    value === "pending" ||
    value === "syncing" ||
    value === "synced" ||
    value === "conflict" ||
    value === "failed"
  );
}

function isPositiveDecimal(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^(?:0|[1-9]\d*)(?:\.(\d{1,12}))?$/.test(value) &&
    /[1-9]/.test(value)
  );
}

function isRealIsoDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isIsoDateTime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function hasText(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && value[key].length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
