import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/services/notificationService";
import { normalizeImageUrl } from "@/lib/imageUrl";

export interface BlingProduct {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  precoCusto?: number;
  tipo: string;
  situacao: string;
  formato: string;
  descricaoCurta?: string;
  descricaoComplementar?: string;
  unidade?: string;
  pesoBruto?: number;
  pesoLiquido?: number;
  estoque?: {
    saldoFisicoTotal?: number;
    saldoVirtualTotal?: number;
  };
  gtin?: string;
  gtinEmbalagem?: string;
  actionEstoque?: string;
  dimensoes?: {
    largura: number;
    altura: number;
    profundidade: number;
    unidadeMedida: number;
  };
  imagemURL?: string;
  midia?: {
    imagens?: {
      internas?: Array<{ linkMiniatura?: string }>;
      externas?: Array<{ link?: string }>;
      imagensURL?: string[];
    };
  };
}

export interface BlingProductsResponse {
  data: BlingProduct[];
}

export interface BlingAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface BlingStockDeposit {
  id: number;
  saldoFisico: number;
  saldoVirtual: number;
}

export interface BlingStockItem {
  produto: { id: number };
  saldoFisicoTotal: number;
  saldoVirtualTotal: number;
  depositos: BlingStockDeposit[];
}

export interface BlingStockResponse {
  data: BlingStockItem[];
}

export class BlingReconnectError extends Error {
  readonly code = "BLING_RECONNECT_REQUIRED";

  constructor() {
    super("Sua conexão com o Bling expirou. Reconecte para continuar.");
    this.name = "BlingReconnectError";
  }
}

export class BlingTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlingTransientError";
  }
}

type TokenFormat = "jwt" | "opaco";

const BLING_JWT_HEADER = { "enable-jwt": "1" } as const;
const TOKEN_RENEWAL_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_DELAY_MS = 350;
const MAX_RETRIES_429 = 4;
const REFRESH_LOCK_TIMEOUT_MS = 15000;
const REFRESH_LOCK_MAX_WAIT_MS = 10000;

type LockedRefreshResult =
  | { kind: "ok"; accessToken: string }
  | { kind: "reconnect" };

export class BlingService {
  private static readonly BASE_URL = "https://www.bling.com.br/Api/v3";
  private static readonly AUTH_URL = "https://www.bling.com.br/Api/v3/oauth";
  private static readonly CLIENT_ID = process.env.BLING_CLIENT_ID!;
  private static readonly CLIENT_SECRET = process.env.BLING_CLIENT_SECRET!;
  private static tokenRefreshPromises = new Map<string, Promise<string>>();

  static getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.CLIENT_ID,
      state,
    });

    return `${this.AUTH_URL}/authorize?${params.toString()}`;
  }

  private static basicCredentials(): string {
    return Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString(
      "base64"
    );
  }

  static detectTokenFormat(token: string): TokenFormat {
    return token.split(".").length === 3 ? "jwt" : "opaco";
  }

  static async exchangeCodeForTokens(code: string): Promise<BlingAuthTokens> {
    const response = await fetch(`${this.AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${this.basicCredentials()}`,
        ...BLING_JWT_HEADER,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao obter tokens do Bling: ${error}`);
    }

    return response.json();
  }

  static async refreshAccessToken(
    refreshToken: string
  ): Promise<BlingAuthTokens> {
    const response = await fetch(`${this.AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${this.basicCredentials()}`,
        ...BLING_JWT_HEADER,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (error.includes("invalid_grant")) {
        throw new BlingReconnectError();
      }
      throw new BlingTransientError(`Erro ao renovar token do Bling: ${error}`);
    }

    return response.json();
  }

  private static async refreshWithLock(
    accountId: string,
    refreshTokenAtCallTime: string,
    force: boolean
  ): Promise<string> {
    const result = await prisma.$transaction(
      async (tx): Promise<LockedRefreshResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`;

        const current = await tx.blingAccount.findUniqueOrThrow({
          where: { id: accountId },
        });

        if (!current.isActive) {
          return { kind: "reconnect" };
        }

        const msUntilExpiry = current.expiresAt.getTime() - Date.now();
        if (!force && msUntilExpiry >= TOKEN_RENEWAL_WINDOW_MS) {
          return { kind: "ok", accessToken: current.accessToken };
        }

        if (current.refreshToken !== refreshTokenAtCallTime) {
          return { kind: "ok", accessToken: current.accessToken };
        }

        try {
          const tokens = await this.refreshAccessToken(current.refreshToken);
          const updated = await tx.blingAccount.update({
            where: { id: accountId },
            data: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          });
          return { kind: "ok", accessToken: updated.accessToken };
        } catch (error) {
          if (error instanceof BlingReconnectError) {
            await tx.blingAccount.update({
              where: { id: accountId },
              data: { isActive: false },
            });
            return { kind: "reconnect" };
          }
          throw error instanceof BlingTransientError
            ? error
            : new BlingTransientError(
                error instanceof Error
                  ? error.message
                  : "Erro ao renovar token do Bling"
              );
        }
      },
      { timeout: REFRESH_LOCK_TIMEOUT_MS, maxWait: REFRESH_LOCK_MAX_WAIT_MS }
    );

    if (result.kind === "reconnect") {
      throw new BlingReconnectError();
    }

    return result.accessToken;
  }

  private static coalescedRefresh(
    accountId: string,
    refreshTokenAtCallTime: string,
    force: boolean
  ): Promise<string> {
    const inFlight = this.tokenRefreshPromises.get(accountId);
    if (inFlight && !force) {
      return inFlight;
    }

    const refreshPromise = this.refreshWithLock(
      accountId,
      refreshTokenAtCallTime,
      force
    )
      .catch(async (error) => {
        if (error instanceof BlingReconnectError) {
          const account = await prisma.blingAccount.findUnique({
            where: { id: accountId },
            select: { userId: true },
          });
          if (account) {
            await NotificationService.notifyBlingExpired(account.userId);
          }
        }
        throw error;
      })
      .finally(() => {
        this.tokenRefreshPromises.delete(accountId);
      });

    this.tokenRefreshPromises.set(accountId, refreshPromise);
    return refreshPromise;
  }

  static async getValidToken(accountId: string): Promise<string> {
    const account = await prisma.blingAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    if (!account.isActive) {
      throw new BlingReconnectError();
    }

    const msUntilExpiry = account.expiresAt.getTime() - Date.now();
    if (msUntilExpiry >= TOKEN_RENEWAL_WINDOW_MS) {
      return account.accessToken;
    }

    return this.coalescedRefresh(accountId, account.refreshToken, false);
  }

  private static async forceRefreshToken(accountId: string): Promise<string> {
    const account = await prisma.blingAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    return this.coalescedRefresh(accountId, account.refreshToken, true);
  }

  static async refreshAccountTokens(accountId: string): Promise<void> {
    const account = await prisma.blingAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    await this.coalescedRefresh(accountId, account.refreshToken, false);
  }

  private static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static async rawFetch(
    path: string,
    accessToken: string,
    init?: RequestInit
  ): Promise<Response> {
    return fetch(`${this.BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...BLING_JWT_HEADER,
        ...(init?.headers || {}),
      },
    });
  }

  private static async apiFetch(
    path: string,
    accountId: string,
    init?: RequestInit
  ): Promise<Response> {
    const accessToken = await this.getValidToken(accountId);
    let response = await this.rawFetch(path, accessToken, init);

    if (response.status === 401) {
      const refreshedToken = await this.forceRefreshToken(accountId);
      response = await this.rawFetch(path, refreshedToken, init);
      if (response.status === 401) {
        throw new BlingReconnectError();
      }
    }

    let attempt = 0;
    while (response.status === 429 && attempt < MAX_RETRIES_429) {
      attempt++;
      await this.sleep(1000 * 2 ** attempt);
      const currentToken = await this.getValidToken(accountId);
      response = await this.rawFetch(path, currentToken, init);
    }

    return response;
  }

  static async getProducts(
    accountId: string,
    page: number = 1,
    limit: number = 100
  ): Promise<BlingProductsResponse> {
    const params = new URLSearchParams({
      pagina: page.toString(),
      limite: limit.toString(),
      criterio: "1",
      tipo: "P",
    });

    const response = await this.apiFetch(
      `/produtos?${params.toString()}`,
      accountId
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar produtos do Bling: ${error}`);
    }

    const data = await response.json();
    return { data: data.data || [] };
  }

  static async getProductById(
    accountId: string,
    productId: number
  ): Promise<BlingProduct> {
    const response = await this.apiFetch(`/produtos/${productId}`, accountId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar produto ${productId} do Bling: ${error}`);
    }

    const data = await response.json();
    return data.data;
  }

  static async getAllProducts(accountId: string): Promise<BlingProduct[]> {
    const pageSize = 100;
    const allProducts: BlingProduct[] = [];
    let currentPage = 1;

    for (;;) {
      const response = await this.getProducts(
        accountId,
        currentPage,
        pageSize
      );

      if (!response.data || response.data.length === 0) {
        break;
      }

      allProducts.push(...response.data);

      if (response.data.length < pageSize) {
        break;
      }

      currentPage++;
      await this.sleep(RATE_LIMIT_DELAY_MS);
    }

    return allProducts;
  }

  static async getProductsStock(
    accountId: string,
    productIds: number[],
    page: number = 1,
    limit: number = 100
  ): Promise<BlingStockResponse> {
    const params = new URLSearchParams({
      pagina: page.toString(),
      limite: limit.toString(),
    });

    productIds.forEach((id) => {
      params.append("idsProdutos[]", id.toString());
    });

    const response = await this.apiFetch(
      `/estoques/saldos?${params.toString()}`,
      accountId
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar estoque do Bling: ${error}`);
    }

    const data = await response.json();
    return { data: data.data || [] };
  }

  static async updateProductStock(
    accountId: string,
    productId: number,
    quantity: number
  ): Promise<void> {
    const response = await this.apiFetch(`/produtos/${productId}/estoques`, accountId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operacao: "B",
        quantidade: quantity,
        preco: 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Erro ao atualizar estoque do produto ${productId}: ${error}`
      );
    }
  }

  static async getCompanyId(accountId: string): Promise<string | null> {
    try {
      const response = await this.apiFetch("/empresas", accountId);
      if (!response.ok) {
        return null;
      }

      const body = await response.json();
      const empresa = Array.isArray(body?.data) ? body.data[0] : body?.data;
      const id = empresa?.id;
      return id !== undefined && id !== null ? String(id) : null;
    } catch (error) {
      console.error("Erro ao buscar dados da empresa no Bling:", error);
      return null;
    }
  }

  static extractImageUrl(product: BlingProduct): string | null {
    const candidato =
      product.midia?.imagens?.externas?.[0]?.link ||
      product.midia?.imagens?.internas?.[0]?.linkMiniatura ||
      product.midia?.imagens?.imagensURL?.[0] ||
      product.imagemURL ||
      null;

    return normalizeImageUrl(candidato);
  }

  static extractEAN(product: BlingProduct): string | null {
    return product.gtin || product.gtinEmbalagem || null;
  }

  static extractSKU(product: BlingProduct): string {
    return product.codigo;
  }

  static isProductActive(product: BlingProduct): boolean {
    return product.situacao === "A";
  }
}
