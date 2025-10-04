import { prisma } from "@/lib/prisma";

// ==================== TYPES ====================

export interface BlingProduct {
  id: number;
  nome: string;
  codigo: string; // SKU
  preco: number;
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
  gtin?: string; // EAN principal
  gtinEmbalagem?: string; // EAN embalagem
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
  metadata?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  };
}

export interface BlingAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // segundos
  token_type: string;
  scope: string;
}

// ==================== BLING SERVICE ====================

export class BlingService {
  private static readonly BASE_URL = "https://www.bling.com.br/Api/v3";
  private static readonly AUTH_URL = "https://www.bling.com.br/Api/v3/oauth";
  private static readonly CLIENT_ID = process.env.BLING_CLIENT_ID!;
  private static readonly CLIENT_SECRET = process.env.BLING_CLIENT_SECRET!;
  private static readonly REDIRECT_URI = process.env.BLING_REDIRECT_URI!;

  // ==================== AUTH METHODS ====================

  /**
   * Gera URL de autorização OAuth do Bling
   */
  static getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.CLIENT_ID,
      state,
    });

    return `${this.AUTH_URL}/authorize?${params.toString()}`;
  }

  /**
   * Troca código de autorização por tokens de acesso
   */
  static async exchangeCodeForTokens(
    code: string
  ): Promise<BlingAuthTokens> {
    // Bling requer Basic Auth (client_id:client_secret em base64)
    const credentials = Buffer.from(
      `${this.CLIENT_ID}:${this.CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(`${this.AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${credentials}`,
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

  /**
   * Renova access token usando refresh token
   */
  static async refreshAccessToken(
    refreshToken: string
  ): Promise<BlingAuthTokens> {
    // Bling requer Basic Auth (client_id:client_secret em base64)
    const credentials = Buffer.from(
      `${this.CLIENT_ID}:${this.CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(`${this.AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao renovar token do Bling: ${error}`);
    }

    return response.json();
  }

  /**
   * Obtém token válido (renova se necessário)
   */
  static async getValidToken(accountId: string): Promise<string> {
    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error("Conta Bling não encontrada");
    }

    const now = new Date();
    const expiresAt = new Date(account.expiresAt);

    // Se token expira em menos de 5 minutos, renovar
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log("[BLING] Token expirando, renovando...");

      const tokens = await this.refreshAccessToken(account.refreshToken);

      // Atualizar tokens no banco
      await prisma.blingAccount.update({
        where: { id: accountId },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });

      return tokens.access_token;
    }

    return account.accessToken;
  }

  // ==================== PRODUTOS ====================

  /**
   * Lista produtos do Bling com paginação
   */
  static async getProducts(
    accessToken: string,
    page: number = 1,
    limit: number = 100
  ): Promise<BlingProductsResponse> {
    const params = new URLSearchParams({
      pagina: page.toString(),
      limite: limit.toString(),
      criterio: "1", // 1 = ID, 2 = Nome
      tipo: "P", // P = Produto, S = Serviço
    });

    console.log(`[BLING] Buscando produtos - Página ${page}, Limite ${limit}`);

    const response = await fetch(
      `${this.BASE_URL}/produtos?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar produtos do Bling: ${error}`);
    }

    const data = await response.json();

    // A API do Bling retorna { data: [...] }
    return {
      data: data.data || [],
      metadata: {
        totalItems: data.data?.length || 0,
        totalPages: 1,
        currentPage: page,
        itemsPerPage: limit,
      },
    };
  }

  /**
   * Busca produto específico por ID
   */
  static async getProductById(
    productId: number,
    accessToken: string
  ): Promise<BlingProduct> {
    const response = await fetch(`${this.BASE_URL}/produtos/${productId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar produto ${productId} do Bling: ${error}`);
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Busca todos os produtos (com paginação automática)
   */
  static async getAllProducts(accessToken: string): Promise<BlingProduct[]> {
    const allProducts: BlingProduct[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getProducts(accessToken, currentPage, 100);

      if (response.data && response.data.length > 0) {
        allProducts.push(...response.data);
        currentPage++;

        if (response.data.length < 100) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Delay para não sobrecarregar API
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`[BLING] ${allProducts.length} produtos encontrados`);
    return allProducts;
  }

  /**
   * Atualiza estoque de um produto no Bling
   */
  static async updateProductStock(
    productId: number,
    quantity: number,
    accessToken: string
  ): Promise<void> {
    const response = await fetch(
      `${this.BASE_URL}/produtos/${productId}/estoques`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          operacao: "B", // B = Balanço (ajuste direto)
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

  // ==================== HELPERS ====================

  /**
   * Extrai EAN do produto Bling (gtin ou gtinEmbalagem)
   */
  static extractEAN(product: BlingProduct): string | null {
    return product.gtin || product.gtinEmbalagem || null;
  }

  /**
   * Extrai SKU do produto Bling
   */
  static extractSKU(product: BlingProduct): string {
    return product.codigo;
  }

  /**
   * Verifica se produto está ativo no Bling
   */
  static isProductActive(product: BlingProduct): boolean {
    return product.situacao === "A"; // A = Ativo, I = Inativo
  }

  /**
   * Formata preço do Bling (já vem em centavos)
   */
  static formatPrice(price: number): number {
    return Math.round(price * 100); // Converter para centavos se necessário
  }
}
