export interface OutboxMutation {
  clientMutationId: string;
  type: "sync.test";
  createdAt: string;
  payload: Record<string, unknown>;
  status: "pending" | "syncing" | "synced" | "conflict" | "failed";
}

export interface Outbox {
  enqueue(mutation: Omit<OutboxMutation, "status">): Promise<OutboxMutation>;
  listPending(): Promise<OutboxMutation[]>;
  markSynced(clientMutationId: string): Promise<void>;
}

const STORE_NAME = "mutations";

export function createOutbox(databaseName = "owebee-outbox"): Outbox {
  async function withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T> | Promise<IDBRequest<T>>
  ): Promise<T> {
    const database = await openDatabase(databaseName);

    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);

      void Promise.resolve(operation(store))
        .then((request) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        })
        .catch(reject);

      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  return {
    async enqueue(mutation) {
      const pendingMutation: OutboxMutation = {
        ...mutation,
        status: "pending"
      };
      await withStore("readwrite", (store) => store.put(pendingMutation));
      return pendingMutation;
    },

    async listPending() {
      const mutations = await withStore<OutboxMutation[]>("readonly", (store) =>
        store.getAll()
      );
      return mutations.filter((mutation) => mutation.status === "pending");
    },

    async markSynced(clientMutationId) {
      await withStore("readwrite", async (store) => {
        const mutation = await requestToPromise<OutboxMutation | undefined>(
          store.get(clientMutationId)
        );
        if (!mutation) {
          throw new Error(`Mutation ${clientMutationId} was not found`);
        }

        return store.put({ ...mutation, status: "synced" });
      });
    }
  };
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "clientMutationId"
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

