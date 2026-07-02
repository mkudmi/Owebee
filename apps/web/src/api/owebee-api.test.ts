import { describe, expect, it, vi } from "vitest";
import { createOwebeeApi, WorkspaceApiError } from "./owebee-api.js";

const session = {
  version: 1 as const,
  tripId: "trip/id",
  token: "private-token",
  tripName: "Georgia 2026"
};
const referenceSession = {
  ...session,
  tripId: "00000000-0000-0000-0000-000000000100"
};

describe("Owebee API client", () => {
  it("loads recent expenses with an encoded trip and bearer session", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: "expense-1",
              payer: { id: "member-1", displayName: "Елена" },
              creator: { id: "member-1", displayName: "Елена" },
              originalAmount: "48.20",
              originalCurrencyCode: "EUR",
              convertedAmount: "4458.50",
              baseCurrencyCode: "RUB",
              expenseDate: "2026-07-01",
              description: "Ужин",
              rateSnapshot: {
                rate: "92.5",
                rateDate: "2026-07-01",
                source: "cbr",
                isManual: false
              },
              splitTargets: []
            }
          ],
          nextCursor: null
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000/",
      fetchImpl
    });

    const result = await api.listRecentExpenses(session);

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/trips/trip%2Fid/expenses?limit=5",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer private-token"
        },
        signal: expect.any(AbortSignal)
      })
    );
    expect(result.items[0]).toMatchObject({
      id: "expense-1",
      description: "Ужин",
      payer: { displayName: "Елена" }
    });
  });

  it("maps unauthorized responses without exposing the response body", async () => {
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn(async () =>
        new Response("private server details", { status: 401 })
      )
    });

    await expect(api.listRecentExpenses(session)).rejects.toMatchObject({
      name: "WorkspaceApiError",
      kind: "unauthorized",
      message: "Сессия больше не действует."
    });
  });

  it("maps network failures to a recoverable unavailable error", async () => {
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn(async () => {
        throw new TypeError("private network details");
      })
    });

    await expect(api.listRecentExpenses(session)).rejects.toEqual(
      new WorkspaceApiError(
        "unavailable",
        "Не удалось загрузить расходы. Проверьте соединение и попробуйте снова."
      )
    );
  });

  it("maps server failures without exposing the response body", async () => {
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn(async () =>
        new Response("private server details", { status: 500 })
      )
    });

    await expect(api.listRecentExpenses(session)).rejects.toMatchObject({
      name: "WorkspaceApiError",
      kind: "unavailable",
      message: "Не удалось загрузить расходы. Попробуйте снова."
    });
  });

  it("times out a request that never completes", async () => {
    vi.useFakeTimers();
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      requestTimeoutMs: 50,
      fetchImpl: vi.fn(
        async (_input, init) =>
          await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            );
          })
      )
    });

    const request = api.listRecentExpenses(session);
    const expectation = expect(request).rejects.toMatchObject({
      kind: "unavailable"
    });
    await vi.advanceTimersByTimeAsync(50);

    await expectation;
    vi.useRealTimers();
  });

  it("rejects an invalid success payload", async () => {
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn(async () =>
        new Response(JSON.stringify({ items: "wrong" }), { status: 200 })
      )
    });

    await expect(api.listRecentExpenses(session)).rejects.toMatchObject({
      kind: "invalid-response"
    });
  });

  it("rejects an invalid expense date before render", async () => {
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: "expense-1",
                payer: { id: "member-1", displayName: "Елена" },
                originalAmount: "48.20",
                originalCurrencyCode: "EUR",
                convertedAmount: "4458.50",
                baseCurrencyCode: "RUB",
                expenseDate: "2026-02-30",
                description: "Ужин"
              }
            ],
            nextCursor: null
          }),
          { status: 200 }
        )
      )
    });

    await expect(api.listRecentExpenses(session)).rejects.toMatchObject({
      kind: "invalid-response"
    });
  });

  it("loads participants and currencies for offline form references", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tripId: referenceSession.tripId,
            members: [
              {
                id: "00000000-0000-0000-0000-000000000010",
                displayName: "Елена",
                email: "private@example.com",
                role: "participant",
                status: "active"
              }
            ],
            families: [
              {
                id: "00000000-0000-0000-0000-000000000020",
                tripId: referenceSession.tripId,
                displayName: "Семья Ивановых",
                shareCount: "2",
                status: "active"
              }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
            ]
          }),
          { status: 200 }
        )
      );
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl
    });

    const participants = await api.listParticipants(referenceSession);
    const currencies = await api.listCurrencies();

    expect(participants.members[0]).toMatchObject({
      id: "00000000-0000-0000-0000-000000000010",
      status: "active"
    });
    expect(currencies.map((currency) => currency.code)).toEqual(["RUB", "EUR"]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `http://localhost:4000/api/v1/trips/${referenceSession.tripId}/participants`,
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer private-token"
        }
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/currencies",
      expect.objectContaining({
        headers: { Accept: "application/json" }
      })
    );
  });

  it("rejects malformed participant and currency reference payloads", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tripId: "00000000-0000-0000-0000-000000000200",
            members: [],
            families: []
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            currencies: [
              {
                code: "EURO",
                displayName: "Wrong",
                symbol: null,
                minorUnits: 2
              }
            ]
          }),
          { status: 200 }
        )
      );
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl
    });

    await expect(api.listParticipants(referenceSession)).rejects.toMatchObject({
      kind: "invalid-response"
    });
    await expect(api.listCurrencies()).rejects.toMatchObject({
      kind: "invalid-response"
    });
  });

  it("rejects non-UUID and duplicate reference identifiers", async () => {
    const member = {
      id: "00000000-0000-0000-0000-000000000010",
      displayName: "Елена",
      email: null,
      role: "participant",
      status: "active"
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tripId: referenceSession.tripId,
            members: [{ ...member, id: "member-1" }],
            families: []
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tripId: referenceSession.tripId,
            members: [member, member],
            families: []
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            currencies: [
              {
                code: "RUB",
                displayName: "Рубль",
                symbol: "₽",
                minorUnits: 2
              },
              {
                code: "RUB",
                displayName: "Дубликат",
                symbol: null,
                minorUnits: 2
              }
            ]
          }),
          { status: 200 }
        )
      );
    const api = createOwebeeApi({
      baseUrl: "http://localhost:4000",
      fetchImpl
    });

    await expect(api.listParticipants(referenceSession)).rejects.toMatchObject({
      kind: "invalid-response"
    });
    await expect(api.listParticipants(referenceSession)).rejects.toMatchObject({
      kind: "invalid-response"
    });
    await expect(api.listCurrencies()).rejects.toMatchObject({
      kind: "invalid-response"
    });
  });
});
