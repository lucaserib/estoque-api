import { describe, it, expect, vi, beforeEach } from "vitest";

const { accountState, resetAccount } = vi.hoisted(() => {
  const state = {
    id: "bling-1",
    userId: "user-1",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    isActive: true,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };

  const reset = (overrides: Partial<typeof state> = {}) => {
    state.accessToken = "old-access";
    state.refreshToken = "old-refresh";
    state.isActive = true;
    state.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    Object.assign(state, overrides);
  };

  return { accountState: state, resetAccount: reset };
});

vi.mock("@/services/notificationService", () => ({
  NotificationService: {
    notifyBlingExpired: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/prisma", () => {
  const blingAccount = {
    findUniqueOrThrow: vi.fn(async () => ({ ...accountState })),
    findUnique: vi.fn(async () => ({ ...accountState })),
    update: vi.fn(
      async ({ data }: { data: Partial<typeof accountState> }) => {
        Object.assign(accountState, data);
        return { ...accountState };
      }
    ),
  };

  return {
    prisma: {
      blingAccount,
      $transaction: vi.fn(
        async (
          callback: (tx: {
            $executeRaw: (...args: unknown[]) => Promise<void>;
            blingAccount: typeof blingAccount;
          }) => Promise<unknown>
        ) =>
          callback({
            $executeRaw: vi.fn(async () => undefined),
            blingAccount,
          })
      ),
    },
  };
});

function grantTypeOf(init?: RequestInit): string | null {
  const params = new URLSearchParams(init?.body as string);
  return params.get("grant_type");
}

function tokenResponse(expiresIn = 21600) {
  return new Response(
    JSON.stringify({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: expiresIn,
      token_type: "bearer",
      scope: "produtos",
    }),
    { status: 200 }
  );
}

describe("BlingService — Fase 1 (JWT e trava de refresh)", () => {
  beforeEach(() => {
    resetAccount();
    vi.restoreAllMocks();
  });

  it("envia enable-jwt:1 na troca do código de autorização", async () => {
    const { BlingService } = await import("@/services/blingService");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      tokenResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    await BlingService.exchangeCodeForTokens("auth-code-123");

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["enable-jwt"]).toBe("1");
  });

  it("envia enable-jwt:1 na renovação por refresh_token", async () => {
    const { BlingService } = await import("@/services/blingService");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      tokenResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    await BlingService.refreshAccessToken("some-refresh-token");

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["enable-jwt"]).toBe("1");
  });

  it("envia enable-jwt:1 em toda chamada de API autenticada", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const { BlingService } = await import("@/services/blingService");
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ data: [] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await BlingService.getProducts(accountState.id);

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["enable-jwt"]).toBe("1");
  });

  it("duas renovações simultâneas na mesma instância geram uma única chamada a /oauth/token", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    const { BlingService } = await import("@/services/blingService");

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(grantTypeOf(init)).toBe("refresh_token");
      await new Promise((resolve) => setTimeout(resolve, 10));
      return tokenResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const [tokenA, tokenB] = await Promise.all([
      BlingService.getValidToken(accountState.id),
      BlingService.getValidToken(accountState.id),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokenA).toBe("new-access");
    expect(tokenB).toBe("new-access");
  });

  it("invalid_grant desativa a conta e lança BlingReconnectError", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    const { BlingService, BlingReconnectError } = await import(
      "@/services/blingService"
    );

    const fetchMock = vi.fn(
      async () => new Response("invalid_grant", { status: 400 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      BlingService.getValidToken(accountState.id)
    ).rejects.toBeInstanceOf(BlingReconnectError);

    expect(accountState.isActive).toBe(false);
  });

  it("erro 503 não desativa a conta e lança BlingTransientError", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    const { BlingService, BlingTransientError } = await import(
      "@/services/blingService"
    );

    const fetchMock = vi.fn(
      async () => new Response("Service Unavailable", { status: 503 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      BlingService.getValidToken(accountState.id)
    ).rejects.toBeInstanceOf(BlingTransientError);

    expect(accountState.isActive).toBe(true);
  });
});
