import { expect, test, type Page } from "@playwright/test";

test.describe("offline expense interactions", () => {
  test("retains the draft on storage failure, retries once, and survives reload without duplicates", async ({
    page
  }) => {
    await openExpenseForm(page);
    await expect(page.locator("#expense-amount")).toBeFocused();

    await page.locator("#expense-amount").fill("48.20");
    await page.locator("#expense-description").fill("Ужин offline");
    await failNextOutboxOpen(page);

    await page.getByRole("button", { name: "Добавить 48.20 RUB" }).click();

    const errorSummary = page.locator(".form-error-summary");
    await expect(errorSummary).toContainText("Данные формы не потеряны");
    await expect(errorSummary).toBeFocused();
    await expect(page.locator("#expense-amount")).toHaveValue("48.20");
    await expect(page.locator("#expense-description")).toHaveValue(
      "Ужин offline"
    );

    await restoreIndexedDb(page);
    await page
      .getByRole("button", { name: "Добавить 48.20 RUB" })
      .dblclick();

    await expect(page.getByText("Сохранено на этом устройстве.")).toBeVisible();
    await expect(page.getByText("Ужин offline", { exact: true })).toHaveCount(1);
    await expect(page.locator(".sync-badge-pending")).toHaveCount(1);

    await page.reload();

    await expect(page.getByText("Ужин offline", { exact: true })).toHaveCount(1);
    await expect(page.locator(".sync-badge-pending")).toHaveCount(1);
  });

  test("keeps the form inside the supported viewport", async ({ page }, testInfo) => {
    await openExpenseForm(page);

    const metrics = await page.evaluate(() => {
      const form = document.querySelector<HTMLElement>(".expense-form-page");
      if (!form) throw new Error("Expense form was not rendered");
      const bounds = form.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        formLeft: bounds.left,
        formRight: bounds.right,
        formWidth: bounds.width
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.formLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.formRight).toBeLessThanOrEqual(metrics.viewportWidth);
    if (testInfo.project.name === "desktop-chrome") {
      expect(metrics.formWidth).toBeLessThanOrEqual(760);
    }
  });
});

async function openExpenseForm(page: Page) {
  await page.goto("/?expense-preview", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Добавить расход" }).click();
  await expect(page.getByRole("heading", { name: "Добавить расход" })).toBeVisible();
}

async function failNextOutboxOpen(page: Page) {
  await page.evaluate(() => {
    const original = window.indexedDB;
    Object.defineProperty(window, "__owebeeOriginalIndexedDb", {
      configurable: true,
      value: original
    });
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: new Proxy(original, {
        get(target, property, receiver) {
          if (property !== "open") {
            const value = Reflect.get(target, property, receiver);
            return typeof value === "function" ? value.bind(target) : value;
          }
          return (name: string, version?: number) => {
            if (name !== "owebee-outbox") {
              return target.open(name, version);
            }
            const request = {
              error: new DOMException("Storage unavailable", "QuotaExceededError"),
              onblocked: null,
              onerror: null,
              onsuccess: null,
              onupgradeneeded: null,
              result: undefined,
              transaction: null
            } as unknown as IDBOpenDBRequest;
            queueMicrotask(() => request.onerror?.(new Event("error")));
            return request;
          };
        }
      })
    });
  });
}

async function restoreIndexedDb(page: Page) {
  await page.evaluate(() => {
    const original = (
      window as Window & { __owebeeOriginalIndexedDb?: IDBFactory }
    ).__owebeeOriginalIndexedDb;
    if (!original) throw new Error("Original IndexedDB was not captured");
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: original
    });
    delete (
      window as Window & { __owebeeOriginalIndexedDb?: IDBFactory }
    ).__owebeeOriginalIndexedDb;
  });
}
