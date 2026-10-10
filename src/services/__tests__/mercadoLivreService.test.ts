import { describe, it, expect, vi, beforeEach } from "vitest";

const { accountState, resetAccount } = vi.hoisted(() => {
  const state = {
    id: "ml-account-1",
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
    notifyMLExpired: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/prisma", () => {
  const mercadoLivreAccount = {
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
      mercadoLivreAccount,
      $transaction: vi.fn(
        async (
          callback: (tx: {
            $executeRaw: (...args: unknown[]) => Promise<void>;
            mercadoLivreAccount: typeof mercadoLivreAccount;
          }) => Promise<unknown>
        ) =>
          callback({
            $executeRaw: vi.fn(async () => undefined),
            mercadoLivreAccount,
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
      scope: "offline_access read write",
    }),
    { status: 200 }
  );
}

describe("MercadoLivreService — Fase 5 (trava distribuída de refresh)", () => {
  beforeEach(() => {
    resetAccount();
    vi.restoreAllMocks();
  });

  it("token ainda dentro da janela de 10 minutos não dispara renovação", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const { MercadoLivreService } = await import(
      "@/services/mercadoLivreService"
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const token = await MercadoLivreService.getValidToken(accountState.id);

    expect(token).toBe("old-access");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token a menos de 10 minutos do vencimento é renovado com antecedência", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    const { MercadoLivreService } = await import(
      "@/services/mercadoLivreService"
    );
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(grantTypeOf(init)).toBe("refresh_token");
      return tokenResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await MercadoLivreService.getValidToken(accountState.id);

    expect(token).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("duas renovações simultâneas na mesma instância geram uma única chamada a /oauth/token", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    const { MercadoLivreService } = await import(
      "@/services/mercadoLivreService"
    );

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(grantTypeOf(init)).toBe("refresh_token");
      await new Promise((resolve) => setTimeout(resolve, 10));
      return tokenResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const [tokenA, tokenB] = await Promise.all([
      MercadoLivreService.getValidToken(accountState.id),
      MercadoLivreService.getValidToken(accountState.id),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokenA).toBe("new-access");
    expect(tokenB).toBe("new-access");
  });

  it("invalid_grant desativa a conta e lança MLReconnectError", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    const { MercadoLivreService, MLReconnectError } = await import(
      "@/services/mercadoLivreService"
    );

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      MercadoLivreService.getValidToken(accountState.id)
    ).rejects.toBeInstanceOf(MLReconnectError);

    expect(accountState.isActive).toBe(false);
  });

  it("erro 503 não desativa a conta e lança MLTransientError", async () => {
    resetAccount({ expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    const { MercadoLivreService, MLTransientError } = await import(
      "@/services/mercadoLivreService"
    );

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "server_error" }), {
          status: 503,
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      MercadoLivreService.getValidToken(accountState.id)
    ).rejects.toBeInstanceOf(MLTransientError);

    expect(accountState.isActive).toBe(true);
  });

  it("conta inativa lança MLReconnectError sem tentar renovar", async () => {
    resetAccount({ isActive: false });
    const { MercadoLivreService, MLReconnectError } = await import(
      "@/services/mercadoLivreService"
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      MercadoLivreService.getValidToken(accountState.id)
    ).rejects.toBeInstanceOf(MLReconnectError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
