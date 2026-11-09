import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/modules/clientes/eventos";
import { aoConectarMercadoLivre } from "@/modules/indicacao/fluxo";
import { NotificationService } from "@/services/notificationService";
import { JsonValue } from "@prisma/client/runtime/library";
import { pickMlImageUrl } from "@/lib/imageUrl";
import { fetchMlWithBackoff } from "@/lib/mlFetch";
import {
  MLAuthResponse,
  MLUserInfo,
  MLItem,
  MLItemsResponse,
  MercadoLivreAccount,
  MLError,
  MLCategory,
  MLSearchFilters,
  MLItemUpdate,
  MLOrder,
  MLSyncResult,
  MercadoLivreSyncHistory,
} from "@/types/mercadolivre";

export class MLReconnectError extends Error {
  readonly code = "ML_RECONNECT_REQUIRED";

  constructor() {
    super("Sua conexão com o Mercado Livre expirou. Reconecte para continuar.");
    this.name = "MLReconnectError";
  }
}

export class MLTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MLTransientError";
  }
}

const ML_TOKEN_RENEWAL_WINDOW_MS = 10 * 60 * 1000;
const ML_REFRESH_LOCK_TIMEOUT_MS = 15000;
const ML_REFRESH_LOCK_MAX_WAIT_MS = 10000;

type MLLockedRefreshResult =
  | { kind: "ok"; accessToken: string }
  | { kind: "reconnect" };

export class MercadoLivreService {
  private static readonly BASE_URL = "https://api.mercadolibre.com";

  private static readonly AUTH_DOMAINS = [
    "auth.mercadolivre.com.br",
    "auth.mercadolibre.com.ar",
    "auth.mercadolibre.com.mx",
  ];

  private static readonly CLIENT_ID = process.env.ML_CLIENT_ID!;
  private static readonly CLIENT_SECRET = process.env.ML_CLIENT_SECRET!;
  private static readonly REDIRECT_URI = process.env.ML_REDIRECT_URI!;

  private static codeVerifierCache = new Map<
    string,
    { verifier: string; timestamp: number }
  >();

  private static tokenRefreshPromises = new Map<string, Promise<string>>();

  private static async handleApiError(
    response: Response,
    context: string
  ): Promise<never> {
    let errorMessage = `${context}: ${response.status} ${response.statusText}`;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        errorMessage = `${context}: ${
          error.message || error.error || response.statusText
        }`;
      } else {
        const textError = await response.text();
        console.error(
          `[DEBUG] Non-JSON error response from ${context}:`,
          textError.substring(0, 200)
        );
        errorMessage = `${context}: ${response.status} ${response.statusText}`;
      }
    } catch (parseError) {
      console.error(
        `[DEBUG] Error parsing response from ${context}:`,
        parseError
      );
      errorMessage = `${context}: ${response.status} ${response.statusText}`;
    }

    throw new Error(errorMessage);
  }

  private static fetchWithBackoff(
    url: string,
    init: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    return fetchMlWithBackoff(url, init, maxRetries);
  }

  static validateConfig(): void {
    if (!this.CLIENT_ID) {
      throw new Error("ML_CLIENT_ID não configurado no arquivo .env");
    }
    if (!this.CLIENT_SECRET) {
      throw new Error("ML_CLIENT_SECRET não configurado no arquivo .env");
    }
    if (!this.REDIRECT_URI) {
      throw new Error("ML_REDIRECT_URI não configurado no arquivo .env");
    }

  }

  private static getAuthDomain(): string {
    return this.AUTH_DOMAINS[0];
  }

  static async getAuthURLWithVerifier(
    state?: string
  ): Promise<{ authUrl: string; codeVerifier: string }> {
    const codeVerifier = await this.generateCodeVerifier();
    const authUrl = await this.buildAuthURL(codeVerifier, state);
    return { authUrl, codeVerifier };
  }

  static async getAuthURL(state?: string): Promise<string> {
    const codeVerifier = await this.generateCodeVerifier();
    return this.buildAuthURL(codeVerifier, state);
  }

  private static async buildAuthURL(
    codeVerifier: string,
    state?: string
  ): Promise<string> {
    this.validateConfig();

    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    if (state) {
      this.codeVerifierCache.set(state, {
        verifier: codeVerifier,
        timestamp: Date.now(),
      });
    }

    this.cleanupCodeVerifierCache();

    const authDomain = this.getAuthDomain();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      ...(state && { state }),
    });

    const authUrl = `https://${authDomain}/authorization?${params.toString()}`;

    return authUrl;
  }

  private static async generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(32);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      const { randomBytes } = await import("crypto");
      const buffer = randomBytes(32);
      for (let i = 0; i < 32; i++) {
        array[i] = buffer[i];
      }
    }

    return this.base64UrlEncode(array);
  }

  private static async generateCodeChallenge(
    verifier: string
  ): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return this.base64UrlEncode(new Uint8Array(hash));
    } else {
      const { createHash } = await import("crypto");
      const hash = createHash("sha256").update(verifier).digest();
      return this.base64UrlEncode(hash);
    }
  }

  private static base64UrlEncode(array: Uint8Array | Buffer): string {
    let base64;
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(array).toString("base64");
    } else {
      base64 = btoa(String.fromCharCode.apply(null, Array.from(array)));
    }

    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  static async exchangeCodeForToken(
    code: string,
    state?: string,
    externalVerifier?: string
  ): Promise<MLAuthResponse> {
    try {

      let verifier: string | null = externalVerifier || null;
      if (!verifier && state) {
        verifier = this.getCodeVerifier(state);
      }

      if (!verifier) {
        console.error(
          `[ML_TOKEN] Code verifier não encontrado para state: ${state}`
        );
        throw new Error(
          "Code verifier não encontrado. Tente conectar novamente."
        );
      }

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        code,
        redirect_uri: this.REDIRECT_URI,
        code_verifier: verifier,
      });

      const url = `${this.BASE_URL}/oauth/token`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`[ML_TOKEN] Erro na resposta:`, {
          status: response.status,
          error: data.error,
          errorDescription: data.error_description,
          message: data.message,
        });
        throw new Error(
          `Erro ao trocar código por token: ${
            data.error_description || data.message || "Erro desconhecido"
          }`
        );
      }

      return data as MLAuthResponse;
    } catch (error) {
      console.error(`[ML_TOKEN] Erro ao trocar código por token:`, error);
      throw error;
    }
  }

  static async refreshAccessToken(
    refreshToken: string
  ): Promise<MLAuthResponse> {
    const response = await fetch(`${this.BASE_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorCode = error.error || "";
      if (errorCode === "invalid_grant") {
        throw new MLReconnectError();
      }
      throw new MLTransientError(
        `Erro ao renovar token ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  static async getUserInfo(accessToken: string): Promise<MLUserInfo> {
    const response = await fetch(`${this.BASE_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter dados do usuário ML: ${
          error.message || response.statusText
        }`
      );
    }

    return response.json();
  }

  static async getUserItems(
    accessToken: string,
    filters: MLSearchFilters = {}
  ): Promise<MLItemsResponse> {

    try {
      const isValid = await this.validateToken(accessToken);
      if (!isValid) {
        throw new Error("Token de acesso inválido ou expirado");
      }

      const userInfo = await this.getUserInfo(accessToken);

      const params = new URLSearchParams({
        offset: (filters.offset || 0).toString(),
        limit: (filters.limit || 50).toString(),
      });

      if (filters.status) params.append("status", filters.status);
      if (filters.category) params.append("category", filters.category);

      const url = `${this.BASE_URL}/users/${
        userInfo.id
      }/items/search?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        await this.handleApiError(response, "Erro ao obter produtos ML");
      }

      const data = await response.json();

      return data;
    } catch (error) {
      console.error("[ERROR] getUserItems failed:", error);
      throw error;
    }
  }

  static async getItem(itemId: string, accessToken?: string): Promise<MLItem> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await this.fetchWithBackoff(`${this.BASE_URL}/items?ids=${itemId}`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter produto ML: ${error.message || response.statusText}`
      );
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0 && data[0].code === 200) {
      return data[0].body;
    }

    throw new Error(`Item ${itemId} não encontrado`);
  }

  static async fetchCustosAnuncio(
    item: MLItem,
    accessToken: string,
    siteId: string,
    sellerId: string
  ): Promise<{
    mlTarifaVenda: number | null;
    mlCustoFrete: number | null;
    mlLogisticType: string | null;
  }> {
    let mlTarifaVenda: number | null = null;
    try {
      const params = new URLSearchParams({
        price: String(item.price),
        listing_type_id: item.listing_type_id || "gold_special",
      });
      if (item.category_id) {
        params.set("category_id", item.category_id);
      }

      const response = await this.fetchWithBackoff(
        `${this.BASE_URL}/sites/${siteId}/listing_prices?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const match = Array.isArray(data) ? data[0] : data;
        if (typeof match?.sale_fee_amount === "number") {
          mlTarifaVenda = Math.round(match.sale_fee_amount * 100);
        }
      }
    } catch (error) {
      console.error(
        `[CUSTOS_ANUNCIO] Erro ao buscar tarifa de venda de ${item.id}:`,
        error
      );
    }

    const mlLogisticType = item.shipping?.logistic_type ?? null;
    let mlCustoFrete: number | null = item.shipping?.free_shipping ? null : 0;

    if (item.shipping?.free_shipping) {
      try {
        const params = new URLSearchParams({
          item_id: item.id,
          item_price: String(item.price),
        });

        const response = await this.fetchWithBackoff(
          `${this.BASE_URL}/users/${sellerId}/shipping_options/free?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const listCost = data?.coverage?.all_country?.list_cost;
          if (typeof listCost === "number") {
            mlCustoFrete = Math.round(listCost * 100);
          }
        }
      } catch (error) {
        console.error(
          `[CUSTOS_ANUNCIO] Erro ao buscar frete de ${item.id}:`,
          error
        );
      }
    }

    return { mlTarifaVenda, mlCustoFrete, mlLogisticType };
  }

  static async getShipmentCost(
    shipmentId: string | number,
    accessToken: string
  ): Promise<number | null> {
    try {
      const response = await this.fetchWithBackoff(
        `${this.BASE_URL}/shipments/${shipmentId}/costs`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const senderCost = Array.isArray(data?.senders)
        ? data.senders[0]?.cost
        : undefined;

      return typeof senderCost === "number"
        ? Math.round(senderCost * 100)
        : null;
    } catch (error) {
      console.error(
        `[SHIPMENT_COST] Erro ao buscar custo do envio ${shipmentId}:`,
        error
      );
      return null;
    }
  }

  static async getFulfillmentStock(
    inventoryId: string,
    accessToken: string
  ): Promise<{
    disponivel: number;
    emTransito: number;
    indisponivel: number;
  } | null> {
    try {
      const response = await this.fetchWithBackoff(
        `${this.BASE_URL}/inventories/${inventoryId}/stock/fulfillment`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const notAvailableDetail: Array<{ status: string; quantity: number }> =
        Array.isArray(data?.not_available_detail)
          ? data.not_available_detail
          : [];

      const emTransito = notAvailableDetail
        .filter((detail) => detail.status === "transfer")
        .reduce((sum, detail) => sum + (detail.quantity || 0), 0);

      return {
        disponivel: data?.available_quantity || 0,
        emTransito,
        indisponivel: data?.not_available_quantity || 0,
      };
    } catch (error) {
      console.error(
        `[FULL_STOCK] Erro ao buscar estoque Full do inventory ${inventoryId}:`,
        error
      );
      return null;
    }
  }

  static extractRealSku(item: MLItem): string | null {
    try {
      if (item.variations && item.variations.length > 0) {
        for (const variation of item.variations) {
          if (variation.attributes) {
            const sellerSkuAttr = variation.attributes.find(
              (attr) => attr.id === "SELLER_SKU"
            );
            if (sellerSkuAttr && sellerSkuAttr.value_name) {
              return sellerSkuAttr.value_name;
            }
          }

          if (variation.seller_custom_field) {
            return variation.seller_custom_field;
          }
        }
      }

      if (item.attributes) {
        const sellerSkuAttr = item.attributes.find(
          (attr) => attr.id === "SELLER_SKU"
        );
        if (sellerSkuAttr && sellerSkuAttr.value_name) {
          return sellerSkuAttr.value_name;
        }
      }

      if (item.seller_custom_field) {
        return item.seller_custom_field;
      }

      return null;
    } catch (error) {
      console.warn(`Erro ao extrair SKU do item ${item.id}:`, error);
      return null;
    }
  }

  static async updateItemStock(
    itemId: string,
    quantity: number,
    accessToken: string,
    variationId?: string | null
  ): Promise<boolean> {
    try {

      const url = `${this.BASE_URL}/items/${itemId}`;
      const body = variationId
        ? {
            variations: [
              { id: Number(variationId), available_quantity: quantity },
            ],
          }
        : { available_quantity: quantity };

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`Erro ao atualizar estoque do item ${itemId}:`, error);
        return false;
      }

      await response.json();
      return true;
    } catch (error) {
      console.error(`Erro ao atualizar estoque do item ${itemId}:`, error);
      return false;
    }
  }

  static async searchItemsBySku(
    userId: string,
    sku: string,
    accessToken: string
  ): Promise<string[]> {
    try {
      const response = await fetch(
        `${
          this.BASE_URL
        }/users/${userId}/items/search?seller_sku=${encodeURIComponent(sku)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.warn(`Erro ao buscar por SKU ${sku}:`, error);
      return [];
    }
  }

  static async searchItemsByCustomField(
    userId: string,
    sku: string,
    accessToken: string
  ): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/users/${userId}/items/search?sku=${encodeURIComponent(
          sku
        )}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.warn(`Erro ao buscar por custom field ${sku}:`, error);
      return [];
    }
  }

  static async processWebhookEvent(webhookId: string): Promise<void> {
    const evento = await prisma.mercadoLivreWebhook.findUniqueOrThrow({
      where: { id: webhookId },
    });

    try {
      switch (evento.topic) {
        case "items":
        case "items_prices":
        case "stock-locations":
          await this.processItemWebhook(
            evento.mercadoLivreAccountId,
            evento.resource
          );
          break;

        case "orders":
        case "orders_v2":
          try {
            await this.processOrderWebhook(
              evento.mercadoLivreAccountId,
              evento.resource
            );
          } catch (erroEstoque) {
            console.error(
              `[WEBHOOK_ORDER] Erro no processamento de estoque (financeiro segue independente):`,
              erroEstoque
            );
          }
          await this.processOrderWebhookFinanceiro(
            evento.mercadoLivreAccountId,
            evento.resource
          );
          break;

        case "payments":
          await this.processPaymentWebhook(
            evento.mercadoLivreAccountId,
            evento.resource
          );
          break;

        case "shipments":
          await this.processShipmentWebhookFinanceiro(
            evento.mercadoLivreAccountId,
            evento.resource
          );
          break;

        case "claims":
          await this.processClaimWebhookFinanceiro(
            evento.mercadoLivreAccountId,
            evento.resource
          );
          break;

        default:
      }

      await prisma.mercadoLivreWebhook.update({
        where: { id: webhookId },
        data: { processed: true, processedAt: new Date(), error: null },
      });
    } catch (error) {
      console.error(`[WEBHOOK] Erro ao processar webhook ${webhookId}:`, error);
      await prisma.mercadoLivreWebhook.update({
        where: { id: webhookId },
        data: {
          error: error instanceof Error ? error.message : "Erro desconhecido",
          attempts: { increment: 1 },
        },
      });
    }
  }

  static async processItemWebhook(
    accountId: string,
    resource: string
  ): Promise<void> {
    const itemId = resource.split("/").pop();
    if (!itemId) {
      throw new Error("Item ID não encontrado no resource");
    }

    const { sincronizarAnuncioMl, atualizarEstoqueFullDosAnuncios } = await import(
      "@/modules/catalogo/anunciosMl"
    );
    const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
      where: { id: accountId },
      select: { id: true, userId: true, siteId: true, mlUserId: true },
    });
    const accessToken = await this.getValidToken(accountId);
    try {
      await sincronizarAnuncioMl(conta, accessToken, itemId);
      await atualizarEstoqueFullDosAnuncios(conta.userId, conta.id);
    } catch (error) {
      console.error(`[WEBHOOK] Erro ao processar item webhook:`, error);
      throw error;
    }
  }

  static async getMultipleItems(
    itemIds: string[],
    accessToken?: string
  ): Promise<MLItem[]> {
    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    const validIds = itemIds.filter((id) => {
      if (!id || typeof id !== "string") {
        console.warn(`[DEBUG] Invalid item ID filtered out:`, id);
        return false;
      }

      const isValid = /^ML[A-Z]\d+$/.test(id);
      if (!isValid) {
        console.warn(`[DEBUG] Item ID with invalid format filtered out:`, id);
        return false;
      }

      return true;
    });

    if (validIds.length === 0) {
      console.warn("[DEBUG] No valid item IDs found");
      return [];
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const allItems: MLItem[] = [];

    const chunks: string[][] = [];
    for (let i = 0; i < validIds.length; i += 20) {
      chunks.push(validIds.slice(i, i + 20));
    }

    for (const chunk of chunks) {

      const response = await fetch(
        `${this.BASE_URL}/items?ids=${chunk.join(",")}`,
        { headers }
      );

      if (!response.ok) {
        await this.handleApiError(response, "Erro ao obter produtos ML");
      }

      const data = await response.json();

      const validItems = data
        .filter((item: { code: number; body: MLItem }) => item.code === 200)
        .map((item: { body: MLItem }) => item.body);

      allItems.push(...validItems);
    }

    return allItems;
  }

  static async getItemsBySeller(
    sellerId: string,
    siteId: string = "MLB",
    filters: {
      category?: string;
      offset?: number;
      limit?: number;
      sort?: string;
    } = {}
  ): Promise<MLItemsResponse> {
    const params = new URLSearchParams({
      seller_id: sellerId,
      offset: (filters.offset || 0).toString(),
      limit: (filters.limit || 50).toString(),
    });

    if (filters.category) params.append("category", filters.category);
    if (filters.sort) params.append("sort", filters.sort);

    const response = await fetch(
      `${this.BASE_URL}/sites/${siteId}/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao buscar produtos por vendedor: ${
          error.message || response.statusText
        }`
      );
    }

    return response.json();
  }

  static async getItemsBySKU(
    sku: string,
    accessToken: string,
    searchType: "seller_custom_field" | "seller_sku" = "seller_sku"
  ): Promise<MLItemsResponse> {
    const params = new URLSearchParams();

    if (searchType === "seller_sku") {
      params.append("seller_sku", sku);
    } else {
      params.append("sku", sku);
    }

    const response = await fetch(
      `${this.BASE_URL}/users/me/items/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao buscar produtos por SKU: ${
          error.message || response.statusText
        }`
      );
    }

    return response.json();
  }

  static async updateItem(
    itemId: string,
    updates: MLItemUpdate,
    accessToken: string
  ): Promise<MLItem> {
    const response = await fetch(`${this.BASE_URL}/items/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao atualizar produto ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  static async getCategories(siteId: string = "MLB"): Promise<MLCategory[]> {
    const response = await fetch(
      `${this.BASE_URL}/sites/${siteId}/categories`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter categorias ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  static async getCategory(categoryId: string): Promise<MLCategory> {
    const response = await fetch(`${this.BASE_URL}/categories/${categoryId}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter categoria ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  static async getUserOrders(
    accessToken: string,
    filters: {
      seller?: string;
      buyer?: string;
      status?: string;
      offset?: number;
      limit?: number;
      sort?: string;
      dateFrom?: Date | string;
      dateTo?: Date | string;
    } = {}
  ): Promise<{
    results: MLOrder[];
    paging: { total: number; offset: number; limit: number };
  }> {
    if (!filters.seller) {
      throw new Error("Seller ID é obrigatório para buscar pedidos");
    }

    const params = new URLSearchParams({
      offset: (filters.offset || 0).toString(),
      limit: Math.min(filters.limit || 50, 50).toString(),
      seller: filters.seller,
    });

    if (filters.status && filters.status !== "all") {
      params.append("order.status", filters.status);
    }

    if (filters.sort && filters.sort !== "none") {
      params.append("sort", filters.sort);
    }

    if (filters.dateFrom) {
      params.append(
        "order.date_created.from",
        this.formatMlDateTime(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      params.append(
        "order.date_created.to",
        this.formatMlDateTime(filters.dateTo)
      );
    }

    const url = `${this.BASE_URL}/orders/search?${params.toString()}`;

    const startTime = Date.now();

    try {
      const response = await this.fetchWithBackoff(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[ML_API] Error response:`, error);
        throw new Error(
          `Erro ao obter pedidos ML: ${error.message || response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[ML_API] Request failed after ${responseTime}ms:`, error);
      throw error;
    }
  }

  private static formatMlDateTime(value: Date | string): string {
    const date = typeof value === "string" ? new Date(value) : value;
    const pad = (n: number) => n.toString().padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? "+" : "-";
    const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
    const offsetMins = pad(Math.abs(offsetMinutes) % 60);

    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000` +
      `${offsetSign}${offsetHours}:${offsetMins}`
    );
  }

  static async getOrder(
    orderId: string,
    accessToken: string
  ): Promise<MLOrder> {
    const response = await fetch(`${this.BASE_URL}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter pedido ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  static async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  static async getValidToken(accountId: string): Promise<string> {
    const account = await prisma.mercadoLivreAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    if (!account.isActive) {
      throw new MLReconnectError();
    }

    const msUntilExpiry = account.expiresAt.getTime() - Date.now();
    if (msUntilExpiry >= ML_TOKEN_RENEWAL_WINDOW_MS) {
      return account.accessToken;
    }

    return this.coalescedRefresh(accountId, account.refreshToken);
  }

  private static coalescedRefresh(
    accountId: string,
    refreshTokenAtCallTime: string
  ): Promise<string> {
    const inFlight = this.tokenRefreshPromises.get(accountId);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = this.refreshWithLock(accountId, refreshTokenAtCallTime)
      .catch(async (error) => {
        if (error instanceof MLReconnectError) {
          const account = await prisma.mercadoLivreAccount.findUnique({
            where: { id: accountId },
            select: { userId: true },
          });
          if (account) {
            await NotificationService.notifyMLExpired(account.userId);
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

  private static async refreshWithLock(
    accountId: string,
    refreshTokenAtCallTime: string
  ): Promise<string> {
    const result = await prisma.$transaction(
      async (tx): Promise<MLLockedRefreshResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`;

        const current = await tx.mercadoLivreAccount.findUniqueOrThrow({
          where: { id: accountId },
        });

        if (!current.isActive) {
          return { kind: "reconnect" };
        }

        const msUntilExpiry = current.expiresAt.getTime() - Date.now();
        if (msUntilExpiry >= ML_TOKEN_RENEWAL_WINDOW_MS) {
          return { kind: "ok", accessToken: current.accessToken };
        }

        if (current.refreshToken !== refreshTokenAtCallTime) {
          return { kind: "ok", accessToken: current.accessToken };
        }

        try {
          const tokens = await this.refreshAccessToken(current.refreshToken);
          const updated = await tx.mercadoLivreAccount.update({
            where: { id: accountId },
            data: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          });
          return { kind: "ok", accessToken: updated.accessToken };
        } catch (error) {
          if (error instanceof MLReconnectError) {
            await tx.mercadoLivreAccount.update({
              where: { id: accountId },
              data: { isActive: false },
            });
            return { kind: "reconnect" };
          }
          throw error instanceof MLTransientError
            ? error
            : new MLTransientError(
                error instanceof Error
                  ? error.message
                  : "Erro ao renovar token do Mercado Livre"
              );
        }
      },
      { timeout: ML_REFRESH_LOCK_TIMEOUT_MS, maxWait: ML_REFRESH_LOCK_MAX_WAIT_MS }
    );

    if (result.kind === "reconnect") {
      throw new MLReconnectError();
    }

    return result.accessToken;
  }

  static async saveAccount(
    userId: string,
    authResponse: MLAuthResponse,
    userInfo: MLUserInfo
  ): Promise<MercadoLivreAccount> {
    try {

      const expiresAt = new Date(Date.now() + authResponse.expires_in * 1000);

      const accountData = {
        userId,
        mlUserId: userInfo.id.toString(),
        accessToken: authResponse.access_token,
        refreshToken: authResponse.refresh_token,
        expiresAt,
        nickname: userInfo.nickname,
        siteId: userInfo.site_id,
        isActive: true,
      };

      const account = await prisma.mercadoLivreAccount.upsert({
        where: {
          userId_mlUserId: {
            userId,
            mlUserId: userInfo.id.toString(),
          },
        },
        update: {
          accessToken: authResponse.access_token,
          refreshToken: authResponse.refresh_token,
          expiresAt,
          nickname: userInfo.nickname,
          siteId: userInfo.site_id,
          isActive: true,
        },
        create: accountData,
      });

      await registrarEvento(userId, "ML_CONECTADO", { propriedades: { mlUserId: account.mlUserId, nickname: account.nickname } });
      await aoConectarMercadoLivre(userId);

      return account;
    } catch (error) {
      console.error(`[ML_SAVE] Erro ao salvar conta:`, error);
      throw error;
    }
  }

  static async getUserAccounts(userId: string): Promise<MercadoLivreAccount[]> {
    return prisma.mercadoLivreAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async disconnectAccount(
    accountId: string,
    userId: string
  ): Promise<void> {
    await prisma.mercadoLivreAccount.update({
      where: {
        id: accountId,
        userId,
      },
      data: {
        isActive: false,
      },
    });
  }

  static async createSyncHistory(
    accountId: string,
    syncType: string = "full"
  ): Promise<MercadoLivreSyncHistory> {
    return prisma.mercadoLivreSyncHistory.create({
      data: {
        mercadoLivreAccountId: accountId,
        syncType,
        status: "running",
        totalItems: 0,
        syncedItems: 0,
        newItems: 0,
        updatedItems: 0,
        errorItems: 0,
        errors: [],
        startedAt: new Date(),
      },
    });
  }

  static async updateSyncHistory(
    historyId: string,
    data: Partial<{
      status: string;
      totalItems: number;
      syncedItems: number;
      newItems: number;
      updatedItems: number;
      errorItems: number;
      errors: JsonValue;
      duration: number;
    }>
  ): Promise<MercadoLivreSyncHistory> {
    const updateData: Record<string, unknown> = { ...data };

    if (data.status === "success" || data.status === "error") {
      updateData.completedAt = new Date();
    }

    return prisma.mercadoLivreSyncHistory.update({
      where: { id: historyId },
      data: updateData,
    });
  }

  static async getSyncHistory(
    accountId: string,
    limit: number = 10
  ): Promise<MercadoLivreSyncHistory[]> {
    return prisma.mercadoLivreSyncHistory.findMany({
      where: { mercadoLivreAccountId: accountId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  private static async processOrderWebhook(
    accountId: string,
    resource: string
  ): Promise<void> {
    const orderId = resource.split("/").pop();
    if (!orderId) return;

    try {
      const accessToken = await this.getValidToken(accountId);
      const order = await this.getOrder(orderId, accessToken);

      if (
        ["paid", "delivered", "ready_to_ship", "shipped"].includes(order.status)
      ) {

        const { mlCache } = await import("@/lib/cache");
        await mlCache.invalidatePattern(`ml:${accountId}:sales`);

        for (const item of order.order_items) {
          try {
            const updated = await prisma.produtoMercadoLivre.updateMany({
              where: {
                mlItemId: item.item.id,
                mercadoLivreAccountId: accountId,
              },
              data: {
                mlSoldQuantity: {
                  increment: item.quantity,
                },
                lastSyncAt: new Date(),
              },
            });

            if (updated.count > 0) {
              await this.checkAndNotifyLowStock(
                accountId,
                item.item.id,
                item.quantity
              );
            }

          } catch (updateError) {
            console.warn(
              `[WEBHOOK_ORDER] Erro ao atualizar produto ${item.item.id}:`,
              updateError
            );
          }
        }

        await this.triggerSaleEvent(accountId, order);
      }

    } catch (error) {
      console.error(
        `[WEBHOOK_ORDER] Erro ao processar webhook do pedido ${orderId}:`,
        error
      );
      throw error;
    }
  }

  private static async processOrderWebhookFinanceiro(
    accountId: string,
    resource: string
  ): Promise<void> {
    const orderId = resource.split("/").pop();
    if (!orderId) return;

    try {
      const { ingerirPedidoMercadoLivre } = await import(
        "@/modules/financeiro/ingestao/sincronizador"
      );
      await ingerirPedidoMercadoLivre(accountId, orderId);
    } catch (error) {
      console.error(
        `[WEBHOOK_ORDER_FINANCEIRO] Erro ao ingerir financeiro do pedido ${orderId}:`,
        error
      );
    }
  }

  private static async checkAndNotifyLowStock(
    accountId: string,
    mlItemId: string,
    quantitySold: number
  ): Promise<void> {
    try {
      const produto = await prisma.produtoMercadoLivre.findFirst({
        where: {
          mlItemId,
          mercadoLivreAccountId: accountId,
        },
        include: {
          produto: {
            include: {
              estoques: {
                include: {
                  armazem: true,
                },
              },
            },
          },
        },
      });

      if (!produto || !produto.produto) return;

      const estoqueTotal =
        produto.produto?.estoques?.reduce(
          (total, estoque) => total + estoque.quantidade,
          0
        ) || 0;

      const estoqueSeguranca =
        produto.produto?.estoques?.[0]?.estoqueSeguranca || 10;
      const limiteAlerta = Math.max(5, Math.round(estoqueSeguranca * 0.2));

      if (estoqueTotal <= limiteAlerta) {

        await this.createStockAlert(
          accountId,
          produto,
          estoqueTotal,
          quantitySold
        );
      }

      if (produto.mlAvailableQuantity > estoqueTotal + 2) {

        const accessToken = await this.getValidToken(accountId);
        await this.updateItemStock(mlItemId, estoqueTotal, accessToken);
      }
    } catch (error) {
      console.error(`[STOCK_CHECK] Erro ao verificar estoque baixo:`, error);
    }
  }

  private static async createStockAlert(
    accountId: string,
    produto: { mlItemId: string; mlTitle: string; produto?: { sku?: string } | null },
    estoqueAtual: number,
    quantidadeVendida: number
  ): Promise<void> {
    try {
      const alert = {
        accountId,
        mlItemId: produto.mlItemId,
        productName: produto.mlTitle,
        productSku: produto.produto?.sku,
        currentStock: estoqueAtual,
        quantitySold: quantidadeVendida,
        alertLevel:
          estoqueAtual <= 2
            ? "critical"
            : estoqueAtual <= 5
            ? "warning"
            : "info",
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`[STOCK_ALERT] Erro ao criar alerta:`, error);
    }
  }

  private static async triggerSaleEvent(
    accountId: string,
    order: {
      id: string | number;
      total_amount: number;
      status: string;
      date_created: string;
      order_items: Array<{
        item: { id: string; title: string };
        quantity: number;
        unit_price: number;
      }>;
    }
  ): Promise<void> {
    try {
      const saleEvent = {
        accountId,
        orderId: order.id,
        totalAmount: order.total_amount,
        itemCount: order.order_items.length,
        status: order.status,
        timestamp: new Date(order.date_created),
        items: order.order_items.map((item) => ({
          mlItemId: item.item.id,
          title: item.item.title,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.unit_price * item.quantity,
        })),
      };

    } catch (error) {
      console.error(`[SALE_EVENT] Erro ao processar evento de venda:`, error);
    }
  }

  private static async resolverPedidoDoPagamento(
    accountId: string,
    paymentId: string
  ): Promise<string | null> {
    try {
      const accessToken = await this.getValidToken(accountId);
      const resposta = await fetchMlWithBackoff(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
      );
      if (!resposta.ok) return null;

      const dados = (await resposta.json()) as { order?: { id?: string | number } };
      return dados.order?.id != null ? String(dados.order.id) : null;
    } catch (erro) {
      console.error(`[WEBHOOK_PAYMENT] Erro ao resolver pedido do pagamento ${paymentId}:`, erro);
      return null;
    }
  }

  private static async resolverPedidoDoEnvio(
    accountId: string,
    shipmentId: string
  ): Promise<string | null> {
    try {
      const accessToken = await this.getValidToken(accountId);
      const resposta = await fetchMlWithBackoff(
        `${this.BASE_URL}/shipments/${shipmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
      );
      if (!resposta.ok) return null;

      const dados = (await resposta.json()) as { order_id?: string | number };
      return dados.order_id != null ? String(dados.order_id) : null;
    } catch (erro) {
      console.error(`[WEBHOOK_SHIPMENT] Erro ao resolver pedido do envio ${shipmentId}:`, erro);
      return null;
    }
  }

  private static async resolverPedidoDaClaim(
    accountId: string,
    claimId: string
  ): Promise<string | null> {
    try {
      const accessToken = await this.getValidToken(accountId);
      const resposta = await fetchMlWithBackoff(
        `${this.BASE_URL}/post-purchase/v1/claims/${claimId}`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
      );
      if (!resposta.ok) return null;

      const dados = (await resposta.json()) as { resource?: string; resource_id?: string | number };
      if (dados.resource && dados.resource !== "order") return null;
      return dados.resource_id != null ? String(dados.resource_id) : null;
    } catch (erro) {
      console.error(`[WEBHOOK_CLAIM] Erro ao resolver pedido da claim ${claimId}:`, erro);
      return null;
    }
  }

  private static async processShipmentWebhookFinanceiro(
    accountId: string,
    resource: string
  ): Promise<void> {
    const shipmentId = resource.split("/").pop();
    if (!shipmentId) return;

    try {
      const orderId = await this.resolverPedidoDoEnvio(accountId, shipmentId);
      if (!orderId) return;

      const { ingerirPedidoMercadoLivre } = await import(
        "@/modules/financeiro/ingestao/sincronizador"
      );
      await ingerirPedidoMercadoLivre(accountId, orderId);
    } catch (erro) {
      console.error(`[WEBHOOK_SHIPMENT_FINANCEIRO] Erro ao reingerir pedido do envio ${shipmentId}:`, erro);
    }
  }

  private static async processClaimWebhookFinanceiro(
    accountId: string,
    resource: string
  ): Promise<void> {
    const claimId = resource.split("/").pop();
    if (!claimId) return;

    try {
      const orderId = await this.resolverPedidoDaClaim(accountId, claimId);
      if (!orderId) return;

      const { ingerirPedidoMercadoLivre } = await import(
        "@/modules/financeiro/ingestao/sincronizador"
      );
      await ingerirPedidoMercadoLivre(accountId, orderId);
    } catch (erro) {
      console.error(`[WEBHOOK_CLAIM_FINANCEIRO] Erro ao reingerir pedido da claim ${claimId}:`, erro);
    }
  }

  private static async processPaymentWebhook(
    accountId: string,
    resource: string
  ): Promise<void> {
    try {

      const { mlCache } = await import("@/lib/cache");
      await mlCache.delete(`orders:${accountId}:recent`);
      await mlCache.delete(`metrics:${accountId}:dashboard`);

      const paymentId = resource.split("/").pop();
      if (paymentId) {
        const orderId = await this.resolverPedidoDoPagamento(accountId, paymentId);
        if (orderId) {
          const { ingerirPedidoMercadoLivre } = await import(
            "@/modules/financeiro/ingestao/sincronizador"
          );
          await ingerirPedidoMercadoLivre(accountId, orderId).catch((erro) =>
            console.error(`[WEBHOOK_PAYMENT_FINANCEIRO] Erro ao reingerir pedido ${orderId}:`, erro)
          );
        }
      }

    } catch (error) {
      console.error(
        `[WEBHOOK_PAYMENT] Erro ao processar webhook de pagamento:`,
        error
      );
      throw error;
    }
  }

  static async getSalesStats(
    accessToken: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<{
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    period: string;
  }> {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append("date_from", filters.dateFrom);
    if (filters.dateTo) params.append("date_to", filters.dateTo);

    const response = await fetch(
      `${
        this.BASE_URL
      }/orders/search?seller=me&order.status=paid&${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Erro ao buscar estatísticas de vendas: ${response.statusText}`
      );
    }

    const data = await response.json();
    const orders: Array<{ total_amount?: number }> = data.results || [];

    const totalSales = orders.length;
    const totalRevenue = orders.reduce((sum: number, order) => {
      return sum + (order.total_amount || 0);
    }, 0);
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    return {
      totalSales,
      totalRevenue,
      averageTicket,
      period: `${filters.dateFrom || "início"} a ${filters.dateTo || "hoje"}`,
    };
  }

  static async getSellerFinancialInfo(
    accessToken: string,
    sellerId: string
  ): Promise<{
    accountBalance: number;
    pendingBalance: number;
    availableBalance: number;
    totalBalance: number;
    currency: string;
    lastUpdate: string;
  }> {
    throw new Error(
      "Saldo financeiro real não está disponível via API do Mercado Livre nesta integração"
    );
  }

  static async getSellerMetrics(accessToken: string): Promise<{
    totalListings: number;
    activeListings: number;
    pausedListings: number;
    totalViews: number;
    totalQuestions: number;
    reputationLevel: string;
    reputationScore: number;
    powerSellerStatus: string | null;
    completedTransactions: number;
    canceledTransactions: number;
  }> {
    try {

      const userInfo = await this.getUserInfo(accessToken);

      const activeItems = await this.getUserItems(accessToken, {
        status: "active",
        limit: 1,
      });

      const pausedItems = await this.getUserItems(accessToken, {
        status: "paused",
        limit: 1,
      });

      const allItems = await this.getUserItems(accessToken, {
        limit: 1,
      });

      const reputation = userInfo.seller_reputation || {};
      const transactions = reputation.transactions || {};

      return {
        totalListings: allItems.paging?.total || 0,
        activeListings: activeItems.paging?.total || 0,
        pausedListings: pausedItems.paging?.total || 0,
        totalViews: 0,
        totalQuestions: 0,
        reputationLevel: reputation.level_id || "novo_usuario",
        reputationScore: reputation.transactions?.ratings?.positive || 0,
        powerSellerStatus: reputation.power_seller_status,
        completedTransactions: transactions.completed || 0,
        canceledTransactions: transactions.canceled || 0,
      };
    } catch (error) {
      console.error("Erro ao obter métricas do vendedor:", error);
      return {
        totalListings: 0,
        activeListings: 0,
        pausedListings: 0,
        totalViews: 0,
        totalQuestions: 0,
        reputationLevel: "novo_usuario",
        reputationScore: 0,
        powerSellerStatus: null,
        completedTransactions: 0,
        canceledTransactions: 0,
      };
    }
  }

  static async getStockInfo(accessToken: string): Promise<{
    totalProducts: number;
    totalStock: number;
    lowStockProducts: Array<{
      id: string;
      title: string;
      availableQuantity: number;
      price: number;
      status: string;
      condition: string;
      sellerSku?: string;
    }>;
    outOfStockProducts: Array<{
      id: string;
      title: string;
      price: number;
      status: string;
      condition: string;
      sellerSku?: string;
    }>;
    lowStockThreshold: number;
  }> {
    try {

      const items = await this.getUserItems(accessToken, {
        status: "active",
        limit: 50,
      });

      if (!items.results || items.results.length === 0) {
        return {
          totalProducts: 0,
          totalStock: 0,
          lowStockProducts: [],
          outOfStockProducts: [],
          lowStockThreshold: 5,
        };
      }

      const itemDetails = await this.getMultipleItems(
        items.results,
        accessToken
      );

      const lowStockThreshold = 5;
      let totalStock = 0;

      const lowStockProducts = itemDetails
        .filter((item) => {
          totalStock += item.available_quantity;
          return (
            item.available_quantity > 0 &&
            item.available_quantity <= lowStockThreshold
          );
        })
        .map((item) => ({
          id: item.id,
          title: item.title,
          availableQuantity: item.available_quantity,
          price: item.price,
          status: item.status,
          condition: item.condition,
          sellerSku: item.seller_custom_field || undefined,
        }));

      const outOfStockProducts = itemDetails
        .filter((item) => item.available_quantity === 0)
        .map((item) => ({
          id: item.id,
          title: item.title,
          price: item.price,
          status: item.status,
          condition: item.condition,
          sellerSku: item.seller_custom_field || undefined,
        }));

      return {
        totalProducts: itemDetails.length,
        totalStock,
        lowStockProducts,
        outOfStockProducts,
        lowStockThreshold,
      };
    } catch (error) {
      console.error("Erro ao obter informações de estoque:", error);
      return {
        totalProducts: 0,
        totalStock: 0,
        lowStockProducts: [],
        outOfStockProducts: [],
        lowStockThreshold: 5,
      };
    }
  }

  static async getShippingInfo(accessToken: string): Promise<{
    mercadoEnviosEnabled: boolean;
    freeShippingEnabled: boolean;
    totalShippingMethods: number;
    shippingMethods: Array<{
      id: string;
      name: string;
      enabled: boolean;
      cost?: number;
    }>;
    averageShippingCost: number;
    freeShippingProductsCount: number;
  }> {
    try {

      const items = await this.getUserItems(accessToken, {
        status: "active",
        limit: 20,
      });

      if (!items.results || items.results.length === 0) {
        return {
          mercadoEnviosEnabled: false,
          freeShippingEnabled: false,
          totalShippingMethods: 0,
          shippingMethods: [],
          averageShippingCost: 0,
          freeShippingProductsCount: 0,
        };
      }

      const itemDetails = await this.getMultipleItems(
        items.results.slice(0, 10),
        accessToken
      );

      let mercadoEnviosCount = 0;
      let freeShippingCount = 0;
      let totalShippingCost = 0;
      let itemsWithShippingCost = 0;

      itemDetails.forEach((item) => {
        if (
          item.shipping?.mode === "me2" ||
          item.shipping?.tags?.includes("mandatory_free_shipping")
        ) {
          mercadoEnviosCount++;
        }

        if (item.shipping?.free_shipping === true) {
          freeShippingCount++;
        }

        if (item.price && !item.shipping?.free_shipping) {
          const estimatedShipping = item.price * 0.1;
          totalShippingCost += estimatedShipping;
          itemsWithShippingCost++;
        }
      });

      const hasMercadoEnvios = mercadoEnviosCount > 0;
      const hasFreeShipping = freeShippingCount > 0;
      const averageShippingCost =
        itemsWithShippingCost > 0
          ? totalShippingCost / itemsWithShippingCost
          : 0;

      return {
        mercadoEnviosEnabled: hasMercadoEnvios,
        freeShippingEnabled: hasFreeShipping,
        totalShippingMethods: hasMercadoEnvios ? 2 : 1,
        shippingMethods: [
          {
            id: "me2",
            name: "Mercado Envios",
            enabled: hasMercadoEnvios,
          },
          {
            id: "custom",
            name: "Envio Personalizado",
            enabled: !hasMercadoEnvios,
          },
        ],
        averageShippingCost,
        freeShippingProductsCount: freeShippingCount,
      };
    } catch (error) {
      console.error("Erro ao obter informações de envio:", error);
      return {
        mercadoEnviosEnabled: false,
        freeShippingEnabled: false,
        totalShippingMethods: 0,
        shippingMethods: [],
        averageShippingCost: 0,
        freeShippingProductsCount: 0,
      };
    }
  }

  static async getSalesPerformance(
    accessToken: string,
    sellerId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    conversionRate: number;
    topSellingProducts: Array<{
      id: string;
      title: string;
      soldQuantity: number;
      revenue: number;
    }>;
    salesTrend: string;
    period: string;
  }> {
    try {

      if (!dateFrom) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFrom = thirtyDaysAgo.toISOString().split("T")[0];
      }

      if (!dateTo) {
        dateTo = new Date().toISOString().split("T")[0];
      }

      const paidOrders = await this.getUserOrders(accessToken, {
        seller: sellerId,
        status: "paid",
        limit: 50,
        sort: "date_desc",
      });

      const orders = paidOrders.results || [];
      const totalSales = orders.length;
      const totalRevenue = orders.reduce((sum, order) => {
        return sum + (order.total_amount || 0);
      }, 0);
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      const activeItems = await this.getUserItems(accessToken, {
        status: "active",
        limit: 50,
      });

      const itemDetails = await this.getMultipleItems(
        activeItems.results?.slice(0, 10) || [],
        accessToken
      );

      const topSellingProducts = itemDetails
        .filter((item) => item.sold_quantity > 0)
        .sort((a, b) => b.sold_quantity - a.sold_quantity)
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          title: item.title,
          soldQuantity: item.sold_quantity,
          revenue: item.price * item.sold_quantity,
        }));

      const totalViews = itemDetails.reduce(
        (sum, item) => sum + (item.sold_quantity || 0) * 10,
        0
      );
      const conversionRate =
        totalViews > 0 ? (totalSales / totalViews) * 100 : 0;

      const salesTrend = totalSales > averageTicket ? "crescendo" : "estável";

      return {
        totalSales,
        totalRevenue,
        averageTicket,
        conversionRate,
        topSellingProducts,
        salesTrend,
        period: `${dateFrom} até ${dateTo}`,
      };
    } catch (error) {
      console.error("Erro ao obter dados de performance de vendas:", error);
      return {
        totalSales: 0,
        totalRevenue: 0,
        averageTicket: 0,
        conversionRate: 0,
        topSellingProducts: [],
        salesTrend: "estável",
        period: "N/A",
      };
    }
  }

  static async syncProductsBySKU(
    accessToken: string,
    accountId: string
  ): Promise<{
    matched: number;
    unmatched: number;
    total: number;
    results: Array<{
      mlItemId: string;
      localProductId?: string;
      sku: string;
      title: string;
      status: "matched" | "unmatched";
    }>;
  }> {

    try {
      const isValid = await this.validateToken(accessToken);
      if (!isValid) {
        throw new Error(
          "Token de acesso inválido ou expirado. Reconecte a conta do Mercado Livre."
        );
      }

      const validToken = await this.getValidToken(accountId);

      const allMLItems: string[] = [];
      let offset = 0;
      const limit = 50;
      let hasMore = true;

      while (hasMore && offset < 1000) {

        const itemsResponse = await this.getUserItems(validToken, {
          offset,
          limit,
          status: "active",
        });

        if (itemsResponse.results && itemsResponse.results.length > 0) {
          allMLItems.push(...itemsResponse.results);
          offset += limit;

          const total = itemsResponse.paging?.total || 0;
          hasMore = offset < total;

        } else {
          hasMore = false;
        }
      }

      if (allMLItems.length === 0) {
        return {
          matched: 0,
          unmatched: 0,
          total: 0,
          results: [],
        };
      }

      const itemDetails: MLItem[] = [];
      for (let i = 0; i < allMLItems.length; i += 20) {
        const batch = allMLItems.slice(i, i + 20);

        try {
          const batchDetails = await this.getMultipleItems(batch, validToken);
          itemDetails.push(...batchDetails);
        } catch (batchError) {
          console.error(
            `[ERROR] Failed to process batch ${i}-${i + 20}:`,
            batchError
          );
        }
      }

      const results: Array<{
        mlItemId: string;
        localProductId?: string;
        sku: string;
        title: string;
        status: "matched" | "unmatched";
      }> = [];

      let matched = 0;
      let unmatched = 0;

      for (const mlItem of itemDetails) {
        let sku = mlItem.seller_custom_field;

        if (!sku) {
          const skuAttribute = mlItem.attributes?.find(
            (attr) => attr.id === "SELLER_SKU"
          );
          sku = skuAttribute?.value_name || undefined;
        }

        if (sku) {
          const localProduct = await this.findLocalProductBySKU(sku);

          if (localProduct) {
            results.push({
              mlItemId: mlItem.id,
              localProductId: localProduct.id,
              sku,
              title: mlItem.title,
              status: "matched",
            });
            matched++;
          } else {
            results.push({
              mlItemId: mlItem.id,
              sku,
              title: mlItem.title,
              status: "unmatched",
            });
            unmatched++;
          }
        } else {
          results.push({
            mlItemId: mlItem.id,
            sku: "N/A",
            title: mlItem.title,
            status: "unmatched",
          });
          unmatched++;
        }
      }

      return {
        matched,
        unmatched,
        total: results.length,
        results,
      };
    } catch (error) {
      console.error("[ERROR] SKU sync failed:", error);
      throw error;
    }
  }

  private static async findLocalProductBySKU(
    sku: string
  ): Promise<{ id: string } | null> {
    try {
      const produto = await prisma.produto.findFirst({
        where: { sku },
        select: { id: true },
      });
      return produto;
    } catch (error) {
      console.error("Erro ao buscar produto local por SKU:", error);
      return null;
    }
  }

  private static cleanupCodeVerifierCache(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;

    for (const [key, value] of this.codeVerifierCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.codeVerifierCache.delete(key);
      }
    }
  }

  private static getCodeVerifier(state: string): string | null {
    const cached = this.codeVerifierCache.get(state);
    if (cached) {
      this.codeVerifierCache.delete(state);
      return cached.verifier;
    }
    return null;
  }

  static async syncStock(
    accessToken: string,
    accountId: string,
    mappings: Array<{
      mlItemId: string;
      localProductId: string;
      syncDirection: "ml_to_local" | "local_to_ml" | "bidirectional";
    }>
  ): Promise<{
    success: boolean;
    syncedItems: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let syncedItems = 0;

    try {
      for (const mapping of mappings) {
        try {
          const mlItem = await this.getItem(mapping.mlItemId, accessToken);

          const localProduct = await prisma.produto.findUnique({
            where: { id: mapping.localProductId },
            include: {
              estoques: {
                include: { armazem: true },
              },
            },
          });

          if (!localProduct) {
            errors.push(
              `Produto local não encontrado: ${mapping.localProductId}`
            );
            continue;
          }

          const totalLocalStock = localProduct.estoques.reduce(
            (total, estoque) => total + estoque.quantidade,
            0
          );

          if (
            mapping.syncDirection === "local_to_ml" ||
            mapping.syncDirection === "bidirectional"
          ) {
            try {
              await this.updateItem(
                mapping.mlItemId,
                {
                  available_quantity: totalLocalStock,
                },
                accessToken
              );

            } catch (updateError) {
              errors.push(
                `Erro ao atualizar ML ${mapping.mlItemId}: ${updateError}`
              );
              continue;
            }
          }

          if (
            mapping.syncDirection === "ml_to_local" ||
            mapping.syncDirection === "bidirectional"
          ) {
            const difference = Math.abs(
              mlItem.available_quantity - totalLocalStock
            );
            if (difference > 0) {
            }
          }

          syncedItems++;
        } catch (itemError) {
          errors.push(
            `Erro ao sincronizar item ${mapping.mlItemId}: ${itemError}`
          );
        }
      }

      return {
        success: errors.length === 0,
        syncedItems,
        errors,
      };
    } catch (error) {
      console.error("Erro geral na sincronização de estoque:", error);
      return {
        success: false,
        syncedItems,
        errors: [...errors, `Erro geral: ${error}`],
      };
    }
  }
}
