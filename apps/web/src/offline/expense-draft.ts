import type {
  ExpenseCreateMutation,
  ExpenseCreatePayload,
  Outbox
} from "./outbox.js";
import type { WorkspaceReferenceSnapshot } from "./workspace-reference-cache.js";

export interface ExpenseDraft {
  amount: string;
  currencyCode: string;
  expenseDate: string;
  description: string;
  payerMemberId: string;
  selectedTargetKeys: string[];
}

export type ExpenseDraftField =
  | "amount"
  | "currencyCode"
  | "expenseDate"
  | "description"
  | "payerMemberId"
  | "splitTargets";

export type ExpenseDraftValidation =
  | { ok: true; payload: ExpenseCreatePayload }
  | {
      ok: false;
      errors: Partial<Record<ExpenseDraftField, string>>;
    };

export function createDefaultExpenseDraft(
  references: WorkspaceReferenceSnapshot,
  today: string
): ExpenseDraft {
  return {
    amount: "",
    currencyCode:
      references.currencies.find((currency) => currency.code === "RUB")?.code ??
      references.currencies[0]?.code ??
      "",
    expenseDate: today,
    description: "",
    payerMemberId: references.members[0]?.id ?? "",
    selectedTargetKeys: [
      ...references.members.map((member) => `member:${member.id}`),
      ...references.families.map((family) => `family:${family.id}`)
    ]
  };
}

export function validateExpenseDraft(
  draft: ExpenseDraft,
  references: WorkspaceReferenceSnapshot
): ExpenseDraftValidation {
  const errors: Partial<Record<ExpenseDraftField, string>> = {};
  const amount = normalizeAmount(draft.amount);
  const description = draft.description.trim();

  if (!amount || !isPositiveDecimal(amount, 12)) {
    errors.amount = "Введите положительную сумму не более чем с 12 знаками после запятой.";
  }

  if (
    !references.currencies.some(
      (currency) => currency.code === draft.currencyCode
    )
  ) {
    errors.currencyCode = "Выберите доступную валюту.";
  }

  if (!isRealIsoDate(draft.expenseDate)) {
    errors.expenseDate = "Укажите существующую дату расхода.";
  }

  if (description.length === 0 || description.length > 500) {
    errors.description =
      "Добавьте описание длиной от 1 до 500 символов.";
  }

  if (
    !references.members.some(
      (member) => member.id === draft.payerMemberId
    )
  ) {
    errors.payerMemberId = "Выберите активного плательщика.";
  }

  const splitTargets = parseSelectedTargets(
    draft.selectedTargetKeys,
    references
  );
  if (!splitTargets) {
    errors.splitTargets =
      "Выберите хотя бы одного действующего участника или семью без повторов.";
  }

  if (Object.keys(errors).length > 0 || !amount || !splitTargets) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      payerMemberId: draft.payerMemberId,
      amount,
      currencyCode: draft.currencyCode,
      expenseDate: draft.expenseDate,
      description,
      splitTargets
    }
  };
}

export function createOfflineExpenseSaver(options: {
  outbox: Outbox;
  createId(): string;
  now(): string;
  persistStorage?(): Promise<boolean>;
}) {
  let inFlight: Promise<ExpenseCreateMutation> | null = null;

  return function save(input: {
    tripId: string;
    payload: ExpenseCreatePayload;
  }): Promise<ExpenseCreateMutation> {
    if (inFlight) {
      return inFlight;
    }

    const clientMutationId = options.createId();
    const task = (async () => {
      const mutation = await options.outbox.enqueue({
        clientMutationId,
        tripId: input.tripId,
        type: "expense.create",
        createdAt: options.now(),
        payload: input.payload
      });

      if (mutation.type !== "expense.create") {
        throw new Error("Outbox returned an unexpected mutation type");
      }

      if (options.persistStorage) {
        try {
          void options.persistStorage().catch(() => undefined);
        } catch {
          // Persistent storage is a best-effort enhancement after durable IDB save.
        }
      }

      return mutation;
    })();

    inFlight = task;
    const clear = () => {
      if (inFlight === task) {
        inFlight = null;
      }
    };
    void task.then(clear, clear);
    return task;
  };
}

function normalizeAmount(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.includes(",") && trimmed.includes(".")) {
    return null;
  }
  if ((trimmed.match(/,/g) ?? []).length > 1) {
    return null;
  }
  return trimmed.replace(",", ".");
}

function isPositiveDecimal(value: string, maxScale: number): boolean {
  const match = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  return Boolean(
    match &&
      (match[1]?.length ?? 0) <= maxScale &&
      /[1-9]/.test(value)
  );
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function parseSelectedTargets(
  keys: string[],
  references: WorkspaceReferenceSnapshot
): ExpenseCreatePayload["splitTargets"] | null {
  if (keys.length === 0 || new Set(keys).size !== keys.length) {
    return null;
  }

  const targets: ExpenseCreatePayload["splitTargets"] = [];
  for (const key of keys) {
    const parts = key.split(":");
    if (parts.length !== 2) return null;
    const [type, id] = parts;

    if (
      type === "member" &&
      references.members.some((member) => member.id === id)
    ) {
      targets.push({ type, id });
      continue;
    }

    if (
      type === "family" &&
      references.families.some((family) => family.id === id)
    ) {
      targets.push({ type, id });
      continue;
    }

    return null;
  }

  return targets;
}
