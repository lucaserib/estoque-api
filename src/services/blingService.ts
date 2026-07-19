import { prisma } from "@/lib/prisma";

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
  nome: string;
  saldo: number;
  saldoVirtual: number;
  desconsiderar: string;
}

export interface BlingStockItem {
  id: number;
  codigo: string;
  nome: string;
  estoqueAtual?: number;
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

const TOKEN_RENEWAL_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_DELAY_MS = 350;
const MAX_RETRIES_429 = 4;

export class BlingService {
  private static readonly BASE_URL = "https://www.bling.com.br/Api/v3";
  private static readonly AUTH_URL = "https://www.bling.com.br/Api/v3/oauth";
  private static readonly CLIENT_ID = process.env.BLING_CLIENT_ID!;
  private static readonly CLIENT_SECRET = process.env.BLING_CLIENT_SECRET!;

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

  static async exchangeCodeForTokens(code: string): Promise<BlingAuthTokens> {
    const response = await fetch(`${this.AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${this.basicCredentials()}`,
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
      throw new Error(`Erro ao renovar token do Bling: ${error}`);
    }

    return response.json();
  }

  static async refreshAccountTokens(accountId: string): Promise<void> {
    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error("Conta Bling não encontrada");
    }

    let tokens: BlingAuthTokens;
    try {
      tokens = await this.refreshAccessToken(account.refreshToken);
    } catch (error) {
      if (error instanceof BlingReconnectError) {
        await prisma.blingAccount.update({
          where: { id: accountId },
          data: { isActive: false },
        });
      }
      throw error;
    }

    await prisma.blingAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
      },
    });
  }

  static async getValidToken(accountId: string): Promise<string> {
    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error("Conta Bling não encontrada");
    }

    if (!account.isActive) {
      throw new BlingReconnectError();
    }

    const msUntilExpiry =
      new Date(account.expiresAt).getTime() - Date.now();

    if (msUntilExpiry < TOKEN_RENEWAL_WINDOW_MS) {
      await this.refreshAccountTokens(accountId);
      const refreshed = await prisma.blingAccount.findUnique({
        where: { id: accountId },
      });
      if (!refreshed) {
        throw new Error("Conta Bling não encontrada");
      }
      return refreshed.accessToken;
    }

    return account.accessToken;
  }

  private static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static async apiFetch(
    path: string,
    accessToken: string,
    init?: RequestInit
  ): Promise<Response> {
    let attempt = 0;
    for (;;) {
      const response = await fetch(`${this.BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...(init?.headers || {}),
        },
      });

      if (response.status !== 429 || attempt >= MAX_RETRIES_429) {
        return response;
      }

      attempt++;
      await this.sleep(1000 * 2 ** attempt);
    }
  }

  static async getProducts(
    accessToken: string,
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
      accessToken
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar produtos do Bling: ${error}`);
    }

    const data = await response.json();
    return { data: data.data || [] };
  }

  static async getProductById(
    productId: number,
    accessToken: string
  ): Promise<BlingProduct> {
    const response = await this.apiFetch(
      `/produtos/${productId}`,
      accessToken
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar produto ${productId} do Bling: ${error}`);
    }

    const data = await response.json();
    return data.data;
  }

  static async getAllProducts(accessToken: string): Promise<BlingProduct[]> {
    const pageSize = 100;
    const allProducts: BlingProduct[] = [];
    let currentPage = 1;

    for (;;) {
      const response = await this.getProducts(
        accessToken,
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
    accessToken: string,
    productIds?: number[],
    page: number = 1,
    limit: number = 100
  ): Promise<BlingStockResponse> {
    const params = new URLSearchParams({
      pagina: page.toString(),
      limite: limit.toString(),
    });

    if (productIds && productIds.length > 0) {
      productIds.forEach((id) => {
        params.append("idsProdutos[]", id.toString());
      });
    }

    const response = await this.apiFetch(
      `/estoques/saldos?${params.toString()}`,
      accessToken
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar estoque do Bling: ${error}`);
    }

    const data = await response.json();
    return { data: data.data || [] };
  }

  static async updateProductStock(
    productId: number,
    quantity: number,
    accessToken: string
  ): Promise<void> {
    const response = await this.apiFetch(
      `/produtos/${productId}/estoques`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operacao: "B",
          quantidade: quantity,
          preco: 0,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Erro ao atualizar estoque do produto ${productId}: ${error}`
      );
    }
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
