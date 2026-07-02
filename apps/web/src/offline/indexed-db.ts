export function openIndexedDatabase(options: {
  name: string;
  version: number;
  upgrade(database: IDBDatabase): void;
}): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(options.name, options.version);
    let settled = false;
    let upgradeError: unknown = null;

    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.onupgradeneeded = () => {
      try {
        options.upgrade(request.result);
      } catch (error) {
        upgradeError = error;
        request.transaction?.abort();
      }
    };
    request.onblocked = () => {
      rejectOnce(new Error(`IndexedDB ${options.name} upgrade is blocked`));
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      rejectOnce(
        upgradeError ??
          request.error ??
          new Error(`IndexedDB ${options.name} open failed`)
      );
    };
  });
}

export async function runStoreRequest<T>(options: {
  open(): Promise<IDBDatabase>;
  storeName: string;
  mode: IDBTransactionMode;
  operation(store: IDBObjectStore): IDBRequest<T> | Promise<IDBRequest<T>>;
}): Promise<T> {
  const database = await options.open();

  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    let store: IDBObjectStore;

    try {
      transaction = database.transaction(options.storeName, options.mode);
      store = transaction.objectStore(options.storeName);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    let requestCompleted = false;
    let requestResult: T;
    let finished = false;
    let operationError: unknown = null;

    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      database.close();
      reject(error);
    };

    transaction.oncomplete = () => {
      if (finished) return;
      if (!requestCompleted) {
        fail(new Error("IndexedDB transaction completed without a result"));
        return;
      }
      finished = true;
      database.close();
      resolve(requestResult);
    };
    transaction.onerror = () => {
      operationError ??=
        transaction.error ?? new Error("IndexedDB transaction failed");
    };
    transaction.onabort = () => {
      fail(
        operationError ??
          transaction.error ??
          new Error("IndexedDB transaction was aborted")
      );
    };

    void Promise.resolve()
      .then(() => options.operation(store))
      .then((request) => {
        request.onsuccess = () => {
          requestCompleted = true;
          requestResult = request.result;
        };
        request.onerror = () => {
          operationError =
            request.error ?? new Error("IndexedDB request failed");
        };
      })
      .catch((error: unknown) => {
        operationError = error;
        try {
          transaction.abort();
        } catch {
          // The transaction may already be inactive after a synchronous request error.
          fail(error);
        }
      });
  });
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}
