import { prisma } from "@/lib/prisma";
import { JsonValue } from "@prisma/client/runtime/library";
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

export class MercadoLivreService {
  private static readonly BASE_URL = "https://api.mercadolibre.com";

  // Domínios válidos para auth OAuth
  private static readonly AUTH_DOMAINS = [
    "auth.mercadolivre.com.br",
    "auth.mercadolibre.com.ar",
    "auth.mercadolibre.com.mx",
  ];

  private static readonly CLIENT_ID = process.env.ML_CLIENT_ID!;
  private static readonly CLIENT_SECRET = process.env.ML_CLIENT_SECRET!;
  private static readonly REDIRECT_URI = process.env.ML_REDIRECT_URI!;

  // Cache para code verifiers
  private static codeVerifierCache = new Map<
    string,
    { verifier: string; timestamp: number }
  >();

  /**
   * Função auxiliar para tratar erros de resposta da API do ML
   */
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
        // Se não for JSON, tentar ler como texto para debug
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

  // Validar configurações
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

    console.log("Configurações do ML validadas:", {
      clientId: this.CLIENT_ID.substring(0, 8) + "...",
      redirectUri: this.REDIRECT_URI,
    });
  }

  /**
   * Detecta o domínio de autorização correto baseado na configuração
   */
  private static getAuthDomain(): string {
    // Usar o domínio específico do Brasil para evitar redirecionamento para site em espanhol
    return this.AUTH_DOMAINS[0]; // auth.mercadolivre.com.br
  }

  /**
   * Gera URL de autorização do ML com PKCE
   */
  static async getAuthURL(state?: string): Promise<string> {
    this.validateConfig();

    // Gerar code_verifier e code_challenge para PKCE
    const codeVerifier = await this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Salvar code_verifier associado ao state (userId)
    if (state) {
      this.codeVerifierCache.set(state, {
        verifier: codeVerifier,
        timestamp: Date.now(),
      });
      console.log(`[ML_PKCE] Code verifier salvo para state: ${state}`);
    }

    // Limpar cache antigo (mais de 10 minutos)
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

    console.log("Configurações do ML validadas:", {
      clientId: this.CLIENT_ID.substring(0, 8) + "...",
      redirectUri: this.REDIRECT_URI,
    });

    const authUrl = `https://${authDomain}/authorization?${params.toString()}`;

    console.log("URL de autorização gerada:", authUrl);
    console.log("Domínio de auth usado:", authDomain);
    console.log("Parâmetros:", {
      response_type: "code",
      client_id: this.CLIENT_ID.substring(0, 8) + "...",
      redirect_uri: this.REDIRECT_URI,
      code_challenge: codeChallenge.substring(0, 20) + "...",
      code_challenge_method: "S256",
      state: state ? "presente" : "ausente",
    });

    return authUrl;
  }

  /**
   * Gera code_verifier para PKCE
   */
  private static async generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(32);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback para Node.js
      const { randomBytes } = await import("crypto");
      const buffer = randomBytes(32);
      for (let i = 0; i < 32; i++) {
        array[i] = buffer[i];
      }
    }

    return this.base64UrlEncode(array);
  }

  /**
   * Gera code_challenge a partir do code_verifier
   */
  private static async generateCodeChallenge(
    verifier: string
  ): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      // Browser
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return this.base64UrlEncode(new Uint8Array(hash));
    } else {
      // Node.js
      const { createHash } = await import("crypto");
      const hash = createHash("sha256").update(verifier).digest();
      return this.base64UrlEncode(hash);
    }
  }

  /**
   * Codifica em base64url
   */
  private static base64UrlEncode(array: Uint8Array | Buffer): string {
    let base64;
    if (typeof Buffer !== "undefined") {
      // Node.js
      base64 = Buffer.from(array).toString("base64");
    } else {
      // Browser
      base64 = btoa(String.fromCharCode.apply(null, Array.from(array)));
    }

    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  /**
   * Troca código de autorização por tokens de acesso com PKCE
   */
  static async exchangeCodeForToken(
    code: string,
    state?: string
  ): Promise<MLAuthResponse> {
    try {
      console.log(`[ML_TOKEN] Iniciando troca de código por token`);
      console.log(`[ML_TOKEN] Código: ${code.substring(0, 20)}...`);
      console.log(`[ML_TOKEN] State: ${state}`);

      // Buscar code_verifier do cache usando o state
      let verifier: string | null = null;
      if (state) {
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

      console.log(
        `[ML_TOKEN] Code verifier encontrado: ${verifier.substring(0, 20)}...`
      );

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        code,
        redirect_uri: this.REDIRECT_URI,
        code_verifier: verifier,
      });

      console.log(`[ML_TOKEN] Parâmetros da requisição:`, {
        grant_type: "authorization_code",
        client_id: this.CLIENT_ID.substring(0, 8) + "...",
        redirect_uri: this.REDIRECT_URI,
        code: code.substring(0, 20) + "...",
        hasClientSecret: !!this.CLIENT_SECRET,
        hasCodeVerifier: !!verifier,
      });

      const url = `${this.BASE_URL}/oauth/token`;
      console.log(`[ML_TOKEN] URL da requisição: ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      console.log(`[ML_TOKEN] Status da resposta: ${response.status}`);

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

      console.log(`[ML_TOKEN] Token obtido com sucesso:`, {
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        userId: data.user_id,
        scope: data.scope,
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
      });

      return data as MLAuthResponse;
    } catch (error) {
      console.error(`[ML_TOKEN] Erro ao trocar código por token:`, error);
      throw error;
    }
  }

  /**
   * Renova token de acesso usando refresh token
   */
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
      throw new Error(
        `Erro ao renovar token ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Obtém informações do usuário autenticado
   */
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

  /**
   * Obtém produtos do usuário autenticado usando endpoint correto com USER_ID
   */
  static async getUserItems(
    accessToken: string,
    filters: MLSearchFilters = {}
  ): Promise<MLItemsResponse> {
    console.log("[DEBUG] getUserItems called with filters:", filters);
    console.log("[DEBUG] AccessToken length:", accessToken?.length);

    try {
      // Primeiro validar se o token ainda é válido
      const isValid = await this.validateToken(accessToken);
      if (!isValid) {
        throw new Error("Token de acesso inválido ou expirado");
      }

      // Obter informações do usuário para conseguir o USER_ID
      const userInfo = await this.getUserInfo(accessToken);
      console.log("[DEBUG] User info retrieved for getUserItems:", {
        id: userInfo.id,
        nickname: userInfo.nickname,
      });

      const params = new URLSearchParams({
        offset: (filters.offset || 0).toString(),
        limit: (filters.limit || 50).toString(),
      });

      if (filters.status) params.append("status", filters.status);
      if (filters.category) params.append("category", filters.category);

      // Usar o endpoint correto com USER_ID conforme documentação oficial
      const url = `${this.BASE_URL}/users/${
        userInfo.id
      }/items/search?${params.toString()}`;
      console.log("[DEBUG] Requesting URL:", url);

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
      console.log("[DEBUG] getUserItems response:", {
        total: data.paging?.total,
        results_count: data.results?.length,
      });

      return data;
    } catch (error) {
      console.error("[ERROR] getUserItems failed:", error);
      throw error;
    }
  }

  /**
   * Obtém detalhes de um produto específico usando multiget
   */
  static async getItem(itemId: string, accessToken?: string): Promise<MLItem> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Usar multiget para obter item específico conforme documentação
    const response = await fetch(`${this.BASE_URL}/items?ids=${itemId}`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter produto ML: ${error.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Multiget retorna array com estrutura [{ code: 200, body: {...} }]
    if (Array.isArray(data) && data.length > 0 && data[0].code === 200) {
      return data[0].body;
    }

    throw new Error(`Item ${itemId} não encontrado`);
  }

  /**
   * Extrai o SKU real do produto ML (seller_sku ou seller_custom_field)
   * Prioridade: 1) SELLER_SKU de variações, 2) seller_custom_field de variações,
   * 3) SELLER_SKU do item, 4) seller_custom_field do item
   */
  static extractRealSku(item: MLItem): string | null {
    try {
      // 1. Verificar SELLER_SKU nas variações primeiro
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

          // 2. seller_custom_field nas variações
          if (variation.seller_custom_field) {
            return variation.seller_custom_field;
          }
        }
      }

      // 3. SELLER_SKU nos atributos do item principal
      if (item.attributes) {
        const sellerSkuAttr = item.attributes.find(
          (attr) => attr.id === "SELLER_SKU"
        );
        if (sellerSkuAttr && sellerSkuAttr.value_name) {
          return sellerSkuAttr.value_name;
        }
      }

      // 4. seller_custom_field do item principal
      if (item.seller_custom_field) {
        return item.seller_custom_field;
      }

      return null;
    } catch (error) {
      console.warn(`Erro ao extrair SKU do item ${item.id}:`, error);
      return null;
    }
  }

  /**
   * Atualiza a quantidade em estoque de um produto no Mercado Livre
   */
  static async updateItemStock(
    itemId: string,
    quantity: number,
    accessToken: string
  ): Promise<boolean> {
    try {
      console.log(
        `[ML] Atualizando estoque do item ${itemId} para ${quantity}`
      );

      const url = `${this.BASE_URL}/items/${itemId}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          available_quantity: quantity,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`Erro ao atualizar estoque do item ${itemId}:`, error);
        return false;
      }

      const updatedItem = await response.json();
      console.log(
        `[ML] Estoque atualizado com sucesso: ${itemId} -> ${updatedItem.available_quantity}`
      );
      return true;
    } catch (error) {
      console.error(`Erro ao atualizar estoque do item ${itemId}:`, error);
      return false;
    }
  }

  /**
   * Busca produtos do usuário por SKU usando seller_sku
   */
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

  /**
   * Busca produtos do usuário por seller_custom_field
   */
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

  /**
   * Processa notificações de webhook do ML automaticamente
   */
  static async processWebhook(
    accountId: string,
    webhookData: {
      resource: string;
      user_id: string;
      topic: string;
      application_id: string;
    }
  ): Promise<void> {
    try {
      const { resource, topic } = webhookData;

      // Log do evento recebido
      console.log(`[WEBHOOK] Processando: ${topic} - ${resource}`);

      // Salvar evento no histórico
      await this.saveWebhookEvent(accountId, webhookData);

      // Processar baseado no tópico
      switch (topic) {
        case "items":
        case "items_prices":
        case "stock-locations":
          await this.processItemWebhook(accountId, resource);
          break;

        // ✅ NOVO: Processar webhooks de pedidos para vendas em tempo real
        case "orders":
          await this.processOrderWebhook(accountId, resource);
          break;

        case "payments":
          // Processar notificações de pagamento
          await this.processPaymentWebhook(accountId, resource);
          break;

        default:
          console.log(
            `[WEBHOOK] Tópico ${topic} não processado automaticamente`
          );
      }
    } catch (error) {
      console.error(`[WEBHOOK] Erro ao processar webhook:`, error);
      throw error;
    }
  }

  /**
   * Processa webhooks de itens (produtos)
   */
  static async processItemWebhook(
    accountId: string,
    resource: string
  ): Promise<void> {
    try {
      // Extrair item ID do resource (ex: /items/MLB123456789)
      const itemId = resource.split("/").pop();
      if (!itemId) {
        throw new Error("Item ID não encontrado no resource");
      }

      console.log(`[WEBHOOK] Sincronizando item ${itemId}...`);

      const accessToken = await this.getValidToken(accountId);
      const item = await this.getItem(itemId, accessToken);

      // Verificar se o produto já existe
      const existingProduct = await prisma.produtoMercadoLivre.findFirst({
        where: {
          mlItemId: itemId,
          mercadoLivreAccountId: accountId,
        },
      });

      // ✅ IMPLEMENTAÇÃO: Buscar preços promocionais usando API oficial
      let currentPrice = Math.round(item.price * 100);
      let originalPrice: number | null = null;
      let basePrice: number | null = null;
      let hasPromotion = false;
      let promotionDiscount = 0;

      try {
        // Buscar preços detalhados usando API oficial /prices
        const pricesResponse = await fetch(
          `https://api.mercadolibre.com/items/${item.id}/prices`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json();

          const standardPrice = pricesData.prices?.find(
            (p: {
              type: string;
              amount: number;
              conditions?: { context_restrictions?: string[] };
            }) =>
              p.type === "standard" &&
              p.conditions?.context_restrictions?.includes(
                "channel_marketplace"
              )
          );

          const promotionPrice = pricesData.prices?.find(
            (p: {
              type: string;
              amount: number;
              regular_amount: number;
              conditions?: { context_restrictions?: string[] };
            }) =>
              p.type === "promotion" &&
              p.conditions?.context_restrictions?.includes(
                "channel_marketplace"
              )
          );

          if (promotionPrice) {
            currentPrice = Math.round(promotionPrice.amount * 100);
            originalPrice = Math.round(promotionPrice.regular_amount * 100);
            hasPromotion = true;
            promotionDiscount = Math.round(
              ((promotionPrice.regular_amount - promotionPrice.amount) /
                promotionPrice.regular_amount) *
                100
            );
          } else if (standardPrice) {
            currentPrice = Math.round(standardPrice.amount * 100);
          }

          if (standardPrice && item.base_price) {
            basePrice = Math.round(item.base_price * 100);
          }
        }
      } catch (priceError) {
        console.error(
          `[SYNC] Erro ao buscar preços de ${item.id}:`,
          priceError
        );
        // ✅ MELHORADO: Fallback para preços básicos do item com retry
        currentPrice = Math.round(item.price * 100);
        originalPrice = item.original_price
          ? Math.round(item.original_price * 100)
          : null;
        basePrice = item.base_price ? Math.round(item.base_price * 100) : null;
        hasPromotion = originalPrice && originalPrice > currentPrice;
        if (hasPromotion && originalPrice) {
          promotionDiscount = Math.round(
            ((originalPrice - currentPrice) / originalPrice) * 100
          );
        }

        // ✅ NOVO: Programar retry para buscar preços posteriormente
        setTimeout(async () => {
          try {
            console.log(`[SYNC_RETRY] Tentando novamente buscar preços para ${item.id}`);
            await this.retryPriceSync(item.id, accessToken, accountId);
          } catch (retryError) {
            console.warn(`[SYNC_RETRY] Falha no retry de preços para ${item.id}:`, retryError);
          }
        }, 30000); // Retry após 30 segundos
      }

      console.log(
        `[PRODUTO_ML] ${item.title} - Preço: R$ ${(currentPrice / 100).toFixed(
          2
        )}${
          hasPromotion
            ? ` (Original: R$ ${(originalPrice! / 100).toFixed(
                2
              )}, Desconto: ${promotionDiscount}%)`
            : ""
        }`
      );

      const productData = {
        mlTitle: item.title,
        mlPrice: currentPrice,
        mlOriginalPrice: originalPrice, // ✅ NOVO: Preço original
        mlBasePrice: basePrice, // ✅ NOVO: Preço base
        mlHasPromotion: Boolean(hasPromotion), // ✅ CORREÇÃO: Garantir tipo boolean
        mlPromotionDiscount: hasPromotion ? promotionDiscount : null, // ✅ NOVO: % desconto
        mlAvailableQuantity: item.available_quantity,
        mlSoldQuantity: item.sold_quantity || 0,
        mlStatus: item.status,
        mlCondition: item.condition,
        mlListingType: item.listing_type_id || "gold_special",
        mlPermalink: item.permalink,
        mlThumbnail: item.thumbnail,
        mlCategoryId: item.category_id,
        mlLastUpdated: new Date(item.last_updated || new Date()),
        lastSyncAt: new Date(),
        syncStatus: "synced",
        syncError: null,
      };

      if (existingProduct) {
        // Atualizar produto existente
        await prisma.produtoMercadoLivre.update({
          where: { id: existingProduct.id },
          data: productData,
        });
        console.log(`[WEBHOOK] Produto ${itemId} atualizado via webhook`);
      } else {
        // Verificar se podemos vincular automaticamente
        const realSku = this.extractRealSku(item);
        if (realSku) {
          const account = await prisma.mercadoLivreAccount.findUnique({
            where: { id: accountId },
          });

          if (account) {
            const localProduct = await prisma.produto.findFirst({
              where: {
                sku: realSku,
                userId: account.userId,
              },
            });

            if (localProduct) {
              // Criar vinculação automática
              await prisma.produtoMercadoLivre.create({
                data: {
                  ...productData,
                  produtoId: localProduct.id,
                  mercadoLivreAccountId: accountId,
                  mlItemId: itemId,
                },
              });
              console.log(
                `[WEBHOOK] Produto ${itemId} vinculado automaticamente via SKU ${realSku}`
              );
            } else {
              console.log(
                `[WEBHOOK] Produto ${itemId} com SKU ${realSku} não encontrado localmente`
              );
            }
          }
        } else {
          console.log(
            `[WEBHOOK] Produto ${itemId} sem SKU real - aguardando vinculação manual`
          );
        }
      }
    } catch (error) {
      console.error(`[WEBHOOK] Erro ao processar item webhook:`, error);
      throw error;
    }
  }

  /**
   * Salva evento de webhook para auditoria
   */
  static async saveWebhookEvent(
    accountId: string,
    webhookData: any
  ): Promise<void> {
    try {
      await prisma.mercadoLivreWebhook.create({
        data: {
          mercadoLivreAccountId: accountId,
          mlNotificationId: `${webhookData.resource}_${Date.now()}`,
          topic: webhookData.topic,
          resource: webhookData.resource,
          userId: webhookData.user_id,
          applicationId: webhookData.application_id,
          processed: true,
          processedAt: new Date(),
          attempts: 1,
        },
      });
    } catch (error) {
      console.error("Erro ao salvar evento de webhook:", error);
    }
  }

  /**
   * Obtém detalhes de múltiplos produtos usando multiget
   */
  static async getMultipleItems(
    itemIds: string[],
    accessToken?: string
  ): Promise<MLItem[]> {
    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    // Filtrar e validar IDs
    const validIds = itemIds.filter((id) => {
      if (!id || typeof id !== "string") {
        console.warn(`[DEBUG] Invalid item ID filtered out:`, id);
        return false;
      }

      // Verificar se o ID parece válido (formato MLB seguido de números)
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

    console.log(`[DEBUG] Getting details for ${validIds.length} valid items`);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const allItems: MLItem[] = [];

    // Dividir em chunks de 20 itens (limite da API)
    const chunks: string[][] = [];
    for (let i = 0; i < validIds.length; i += 20) {
      chunks.push(validIds.slice(i, i + 20));
    }

    for (const chunk of chunks) {
      console.log(`[DEBUG] Fetching items batch: ${chunk.join(",")}`);

      const response = await fetch(
        `${this.BASE_URL}/items?ids=${chunk.join(",")}`,
        { headers }
      );

      console.log(
        `[DEBUG] Response status: ${
          response.status
        }, Content-Type: ${response.headers.get("content-type")}`
      );

      if (!response.ok) {
        await this.handleApiError(response, "Erro ao obter produtos ML");
      }

      const data = await response.json();

      // Filtrar apenas items com sucesso
      const validItems = data
        .filter((item: { code: number; body: MLItem }) => item.code === 200)
        .map((item: { body: MLItem }) => item.body);

      allItems.push(...validItems);
    }

    return allItems;
  }

  /**
   * Busca itens por seller_id usando endpoint público
   */
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

  /**
   * Busca itens por SKU do vendedor
   */
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

  /**
   * Atualiza um produto no ML
   */
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

  /**
   * Busca categorias do ML
   */
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

  /**
   * Obtém detalhes de uma categoria específica
   */
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

  /**
   * Obtém pedidos do usuário
   */
  static async getUserOrders(
    accessToken: string,
    filters: {
      seller?: string;
      buyer?: string;
      status?: string;
      offset?: number;
      limit?: number;
      sort?: string;
    } = {}
  ): Promise<{
    results: MLOrder[];
    paging: { total: number; offset: number; limit: number };
  }> {
    // ✅ CORREÇÃO CRÍTICA: Usar endpoint correto da API ML
    console.log(`[ML_API] getUserOrders called with filters:`, {
      offset: filters.offset || 0,
      limit: filters.limit || 50,
      status: filters.status || "all",
      sort: filters.sort || "none",
      hasSeller: !!filters.seller,
      hasBuyer: !!filters.buyer,
    });

    // ✅ ENDPOINT CORRETO: Usar /orders/search COM seller obrigatório
    if (!filters.seller) {
      throw new Error("Seller ID é obrigatório para buscar pedidos");
    }

    const params = new URLSearchParams({
      offset: (filters.offset || 0).toString(),
      limit: Math.min(filters.limit || 50, 50).toString(), // ML limita a 50
      seller: filters.seller, // ✅ OBRIGATÓRIO: seller sempre presente
    });

    // ✅ STATUS CORRETO: order.status para filtrar status
    if (filters.status && filters.status !== "all") {
      params.append("order.status", filters.status);
    }

    // ✅ SORT CORRETO: date_desc para mais recentes primeiro
    if (filters.sort && filters.sort !== "none") {
      params.append("sort", filters.sort);
    }

    const url = `${this.BASE_URL}/orders/search?${params.toString()}`;
    console.log(`[ML_API] Requesting: ${url}`);

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Token completo para a requisição
          Accept: "application/json",
        },
      });

      const responseTime = Date.now() - startTime;
      console.log(
        `[ML_API] Response received in ${responseTime}ms, status: ${response.status}`
      );

      if (!response.ok) {
        const error = await response.json();
        console.error(`[ML_API] Error response:`, error);
        throw new Error(
          `Erro ao obter pedidos ML: ${error.message || response.statusText}`
        );
      }

      const data = await response.json();

      // ✅ LOGGING: Estatísticas da resposta
      console.log(
        `[ML_API] Success - Found ${data.results?.length || 0} orders, total: ${
          data.paging?.total || 0
        }`
      );

      if (data.results && data.results.length > 0) {
        const statusBreakdown = data.results.reduce(
          (acc: Record<string, number>, order: any) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
          },
          {}
        );
        console.log(`[ML_API] Status breakdown:`, statusBreakdown);
      }

      return data;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[ML_API] Request failed after ${responseTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Obtém detalhes de um pedido específico
   */
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

  /**
   * Verifica se um token ainda é válido
   */
  static async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtém ou renova token válido para uma conta
   */
  static async getValidToken(accountId: string): Promise<string> {
    console.log("[DEBUG] getValidToken called for accountId:", accountId);

    const account = await prisma.mercadoLivreAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    console.log("[DEBUG] Account found:", {
      id: account.id,
      mlUserId: account.mlUserId,
      nickname: account.nickname,
      isActive: account.isActive,
      expiresAt: account.expiresAt,
      tokenValid: account.expiresAt > new Date(),
    });

    // Se o token ainda não expirou, retorna o atual
    if (account.expiresAt > new Date()) {
      console.log("[DEBUG] Token still valid, returning current token");
      return account.accessToken;
    }

    console.log("[DEBUG] Token expired, attempting to refresh");

    // Renova o token
    try {
      const newTokens = await this.refreshAccessToken(account.refreshToken);

      console.log("[DEBUG] Token refreshed successfully");

      // Atualiza no banco
      await prisma.mercadoLivreAccount.update({
        where: { id: accountId },
        data: {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        },
      });

      return newTokens.access_token;
    } catch (error) {
      console.log(
        "[DEBUG] Failed to refresh token, marking account as inactive:",
        error
      );

      // Se não conseguir renovar, marca conta como inativa
      await prisma.mercadoLivreAccount.update({
        where: { id: accountId },
        data: { isActive: false },
      });

      throw new Error(
        "Token expirado e não foi possível renovar. Reconecte a conta do Mercado Livre."
      );
    }
  }

  /**
   * Salva conta do ML no banco
   */
  static async saveAccount(
    userId: string,
    authResponse: MLAuthResponse,
    userInfo: MLUserInfo
  ): Promise<MercadoLivreAccount> {
    try {
      console.log(`[ML_SAVE] Iniciando salvamento da conta`);
      console.log(`[ML_SAVE] userId: ${userId}`);
      console.log(`[ML_SAVE] ML userInfo:`, {
        id: userInfo.id,
        nickname: userInfo.nickname,
        siteId: userInfo.site_id,
        email: userInfo.email,
        firstName: userInfo.first_name,
        lastName: userInfo.last_name,
      });
      console.log(`[ML_SAVE] authResponse:`, {
        hasAccessToken: !!authResponse.access_token,
        hasRefreshToken: !!authResponse.refresh_token,
        expiresIn: authResponse.expires_in,
        userId: authResponse.user_id,
      });

      const expiresAt = new Date(Date.now() + authResponse.expires_in * 1000);
      console.log(`[ML_SAVE] Token expira em: ${expiresAt}`);

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

      console.log(`[ML_SAVE] Dados da conta para upsert:`, accountData);

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

      console.log(`[ML_SAVE] Conta salva com sucesso:`, {
        id: account.id,
        nickname: account.nickname,
        siteId: account.siteId,
        mlUserId: account.mlUserId,
        isActive: account.isActive,
      });

      return account;
    } catch (error) {
      console.error(`[ML_SAVE] Erro ao salvar conta:`, error);
      throw error;
    }
  }

  /**
   * Lista contas do ML de um usuário
   */
  static async getUserAccounts(userId: string): Promise<MercadoLivreAccount[]> {
    return prisma.mercadoLivreAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Remove conexão com conta do ML
   */
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

  /**
   * Cria histórico de sincronização
   */
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

  /**
   * Atualiza histórico de sincronização
   */
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

  /**
   * Busca histórico de sincronizações
   */
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

  /**
   * Processa webhook de pedido - ✅ MELHORADO para vendas em tempo real
   */
  private static async processOrderWebhook(
    accountId: string,
    resource: string
  ): Promise<void> {
    const orderId = resource.split("/").pop();
    if (!orderId) return;

    try {
      const accessToken = await this.getValidToken(accountId);
      const order = await this.getOrder(orderId, accessToken);

      console.log(
        `[WEBHOOK_ORDER] Processando pedido: ${orderId} - Status: ${order.status}`
      );

      // ✅ NOVO: Invalidar cache de vendas quando houver novos pedidos
      if (
        ["paid", "delivered", "ready_to_ship", "shipped"].includes(order.status)
      ) {
        console.log(
          `[WEBHOOK_ORDER] Pedido confirmado - invalidando cache de vendas`
        );

        // ✅ MELHORADO: Usar sistema de cache inteligente
        const { mlCache } = await import("@/lib/cache");
        mlCache.invalidateSales(accountId);

        // ✅ NOVO: Atualizar quantidade vendida e disparar notificações
        for (const item of order.order_items) {
          try {
            // Atualizar produto ML
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

            // ✅ NOVO: Verificar se produto precisa de restock
            if (updated.count > 0) {
              await this.checkAndNotifyLowStock(accountId, item.item.id, item.quantity);
            }

            console.log(
              `[WEBHOOK_ORDER] Atualizada quantidade vendida: ${item.item.id} +${item.quantity}`
            );
          } catch (updateError) {
            console.warn(
              `[WEBHOOK_ORDER] Erro ao atualizar produto ${item.item.id}:`,
              updateError
            );
          }
        }

        // ✅ NOVO: Disparar evento de nova venda
        await this.triggerSaleEvent(accountId, order);
      }

      console.log(`[WEBHOOK_ORDER] Pedido ${orderId} processado com sucesso`);
    } catch (error) {
      console.error(
        `[WEBHOOK_ORDER] Erro ao processar webhook do pedido ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * ✅ NOVO: Verifica estoque baixo e dispara notificações
   */
  private static async checkAndNotifyLowStock(
    accountId: string,
    mlItemId: string,
    quantitySold: number
  ): Promise<void> {
    try {
      // Buscar produto com estoque atual
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

      // Calcular estoque total local
      const estoqueTotal = produto.produto.estoques.reduce(
        (total, estoque) => total + estoque.quantidade,
        0
      );

      // Verificar se estoque está baixo (menos de 5 unidades ou 20% do estoque de segurança)
      const estoqueSeguranca = produto.produto.estoqueSeguranca || 10;
      const limiteAlerta = Math.max(5, Math.round(estoqueSeguranca * 0.2));

      if (estoqueTotal <= limiteAlerta) {
        console.log(
          `[STOCK_ALERT] Estoque baixo detectado: ${produto.mlTitle} - ${estoqueTotal} unidades`
        );

        // ✅ NOVO: Criar alerta de estoque baixo
        await this.createStockAlert(accountId, produto, estoqueTotal, quantitySold);
      }

      // ✅ NOVO: Se estoque ML for maior que local, sincronizar
      if (produto.mlAvailableQuantity > estoqueTotal + 2) {
        console.log(
          `[STOCK_SYNC] Sincronizando estoque: ML=${produto.mlAvailableQuantity} > Local=${estoqueTotal}`
        );

        const accessToken = await this.getValidToken(accountId);
        await this.updateItemStock(mlItemId, estoqueTotal, accessToken);
      }
    } catch (error) {
      console.error(`[STOCK_CHECK] Erro ao verificar estoque baixo:`, error);
    }
  }

  /**
   * ✅ NOVO: Cria alerta de estoque baixo
   */
  private static async createStockAlert(
    accountId: string,
    produto: any,
    estoqueAtual: number,
    quantidadeVendida: number
  ): Promise<void> {
    try {
      // Por enquanto, apenas log. Pode ser expandido para notificações por email/SMS
      const alert = {
        accountId,
        mlItemId: produto.mlItemId,
        productName: produto.mlTitle,
        productSku: produto.produto?.sku,
        currentStock: estoqueAtual,
        quantitySold: quantidadeVendida,
        alertLevel: estoqueAtual <= 2 ? 'critical' : estoqueAtual <= 5 ? 'warning' : 'info',
        timestamp: new Date().toISOString(),
      };

      console.log(`[STOCK_ALERT] Alerta criado:`, alert);

      // ✅ TODO: Implementar sistema de notificações (email, webhook, etc.)
      // await this.sendStockNotification(alert);
    } catch (error) {
      console.error(`[STOCK_ALERT] Erro ao criar alerta:`, error);
    }
  }

  /**
   * ✅ NOVO: Dispara evento de nova venda para métricas
   */
  private static async triggerSaleEvent(
    accountId: string,
    order: any
  ): Promise<void> {
    try {
      const saleEvent = {
        accountId,
        orderId: order.id,
        totalAmount: order.total_amount,
        itemCount: order.order_items.length,
        status: order.status,
        timestamp: new Date(order.date_created),
        items: order.order_items.map((item: any) => ({
          mlItemId: item.item.id,
          title: item.item.title,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.unit_price * item.quantity,
        })),
      };

      console.log(`[SALE_EVENT] Nova venda registrada:`, {
        orderId: saleEvent.orderId,
        totalAmount: saleEvent.totalAmount,
        itemCount: saleEvent.itemCount,
      });

      // ✅ TODO: Expandir para analytics em tempo real
      // await this.updateRealTimeMetrics(saleEvent);
    } catch (error) {
      console.error(`[SALE_EVENT] Erro ao processar evento de venda:`, error);
    }
  }

  /**
   * ✅ NOVO: Processa webhook de pagamento
   */
  private static async processPaymentWebhook(
    accountId: string,
    resource: string
  ): Promise<void> {
    try {
      console.log(`[WEBHOOK_PAYMENT] Processando pagamento: ${resource}`);

      // Invalidar cache quando há mudanças de pagamento
      const { mlCache } = await import("@/lib/cache");
      mlCache.delete(`orders:${accountId}:recent`);
      mlCache.delete(`metrics:${accountId}:dashboard`);

      console.log(
        `[WEBHOOK_PAYMENT] Cache invalidado por mudança de pagamento`
      );
    } catch (error) {
      console.error(
        `[WEBHOOK_PAYMENT] Erro ao processar webhook de pagamento:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtém estatísticas de vendas do usuário
   */
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
    // ✅ CORREÇÃO: Ticket médio já está correto aqui (valor total ÷ número de pedidos)
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    return {
      totalSales,
      totalRevenue,
      averageTicket,
      period: `${filters.dateFrom || "início"} a ${filters.dateTo || "hoje"}`,
    };
  }

  /**
   * Obtém informações financeiras detalhadas do vendedor
   */
  static async getSellerFinancialInfo(accessToken: string, sellerId: string): Promise<{
    accountBalance: number;
    pendingBalance: number;
    availableBalance: number;
    totalBalance: number;
    currency: string;
    lastUpdate: string;
  }> {
    try {
      console.log("[DEBUG] Getting financial info with correct ML endpoints");

      // Obter informações básicas do usuário primeiro
      const userInfo = await this.getUserInfo(accessToken);
      console.log("[DEBUG] User info retrieved:", {
        id: userInfo.id,
        nickname: userInfo.nickname,
        country_id: userInfo.country_id,
      });

      // Determinar moeda baseada no país
      const currency =
        userInfo.country_id === "BR"
          ? "BRL"
          : userInfo.country_id === "AR"
          ? "ARS"
          : userInfo.country_id === "MX"
          ? "MXN"
          : "BRL";

      // Tentar obter informações de vendas recentes para estimar valores
      try {
        const recentOrders = await this.getUserOrders(accessToken, {
          seller: sellerId,
          limit: 50,
          status: "paid",
        });

        const totalRevenue = recentOrders.results.reduce((sum, order) => {
          return sum + (order.total_amount || 0);
        }, 0);

        // Simular dados financeiros baseados em vendas recentes
        const estimatedPending = totalRevenue * 0.1; // 10% pendente
        const estimatedAvailable = totalRevenue * 0.8; // 80% disponível
        const estimatedTotal = estimatedPending + estimatedAvailable;

        return {
          accountBalance: estimatedTotal,
          pendingBalance: estimatedPending,
          availableBalance: estimatedAvailable,
          totalBalance: estimatedTotal,
          currency,
          lastUpdate: new Date().toISOString(),
        };
      } catch (orderError) {
        console.warn(
          "[DEBUG] Could not fetch orders for financial estimation:",
          orderError
        );
        // Retornar valores padrão se não conseguir obter pedidos
        return {
          accountBalance: 0,
          pendingBalance: 0,
          availableBalance: 0,
          totalBalance: 0,
          currency,
          lastUpdate: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error("Erro ao obter informações financeiras:", error);
      return {
        accountBalance: 0,
        pendingBalance: 0,
        availableBalance: 0,
        totalBalance: 0,
        currency: "BRL",
        lastUpdate: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtém métricas detalhadas do vendedor
   */
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
      console.log("[DEBUG] Getting comprehensive seller metrics");

      // Obter informações do usuário
      const userInfo = await this.getUserInfo(accessToken);

      // Obter listagens ativas
      const activeItems = await this.getUserItems(accessToken, {
        status: "active",
        limit: 1,
      });

      // Obter listagens pausadas
      const pausedItems = await this.getUserItems(accessToken, {
        status: "paused",
        limit: 1,
      });

      // Obter total de listagens
      const allItems = await this.getUserItems(accessToken, {
        limit: 1,
      });

      // Extrair dados de reputação
      const reputation = userInfo.seller_reputation || {};
      const transactions = reputation.transactions || {};

      return {
        totalListings: allItems.paging?.total || 0,
        activeListings: activeItems.paging?.total || 0,
        pausedListings: pausedItems.paging?.total || 0,
        totalViews: 0, // Requer API específica não disponível publicamente
        totalQuestions: 0, // Requer API específica não disponível publicamente
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

  /**
   * Obtém informações detalhadas de estoque com produtos específicos
   */
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
      console.log("[DEBUG] Getting comprehensive stock info");

      // Obter todos os produtos ativos do usuário
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

      // Obter detalhes dos produtos em lotes
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

  /**
   * Obtém informações detalhadas de envio e logística
   */
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
      console.log("[DEBUG] Getting comprehensive shipping info");

      // Obter uma amostra de produtos para verificar configurações de envio
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

      // Obter detalhes dos produtos
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

        // Estimar custo de envio baseado no preço do produto
        if (item.price && !item.shipping?.free_shipping) {
          const estimatedShipping = item.price * 0.1; // 10% do preço como estimativa
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

  /**
   * Obtém informações de vendas e performance
   */
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
      console.log("[DEBUG] Getting sales performance data");

      // Definir período padrão se não fornecido
      if (!dateFrom) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFrom = thirtyDaysAgo.toISOString().split("T")[0];
      }

      if (!dateTo) {
        dateTo = new Date().toISOString().split("T")[0];
      }

      // ✅ CORREÇÃO: Obter pedidos pagos COM seller ID obrigatório
      const paidOrders = await this.getUserOrders(accessToken, {
        seller: sellerId,
        status: "paid",
        limit: 50,
        sort: "date_desc", // Mais recentes primeiro
      });

      const orders = paidOrders.results || [];
      const totalSales = orders.length;
      const totalRevenue = orders.reduce((sum, order) => {
        return sum + (order.total_amount || 0);
      }, 0);
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Obter produtos para calcular conversion rate
      const activeItems = await this.getUserItems(accessToken, {
        status: "active",
        limit: 50,
      });

      const itemDetails = await this.getMultipleItems(
        activeItems.results?.slice(0, 10) || [],
        accessToken
      );

      // Calcular produtos mais vendidos
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

      // Calcular taxa de conversão aproximada
      const totalViews = itemDetails.reduce(
        (sum, item) => sum + (item.sold_quantity || 0) * 10,
        0
      ); // Estimativa: 10 views por venda
      const conversionRate =
        totalViews > 0 ? (totalSales / totalViews) * 100 : 0;

      // Determinar tendência de vendas
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

  /**
   * Obtém taxas e comissões detalhadas do marketplace
   */
  static async getMarketplaceFees(
    accessToken: string,
    categoryId?: string
  ): Promise<{
    listingFee: number;
    saleFee: number;
    paymentFee: number;
    shippingFee: number;
    totalFeeRate: number;
    category: string;
    currency: string;
    estimatedFeesOnPrice: (price: number) => {
      listingFee: number;
      saleFee: number;
      paymentFee: number;
      totalFees: number;
      netAmount: number;
    };
  }> {
    try {
      console.log("[DEBUG] Getting marketplace fees and commissions");

      // Obter informações do usuário para determinar o site
      const userInfo = await this.getUserInfo(accessToken);
      const currency =
        userInfo.country_id === "BR"
          ? "BRL"
          : userInfo.country_id === "AR"
          ? "ARS"
          : userInfo.country_id === "MX"
          ? "MXN"
          : "BRL";

      // Taxas padrão do Mercado Livre (baseadas na documentação oficial)
      const fees = {
        listingFee: 0, // Taxa de publicação (geralmente grátis para vendedores básicos)
        saleFee: 0.12, // Taxa de venda padrão de 12% para produtos gerais
        paymentFee: 0.049, // Taxa de processamento de pagamento ~4.9%
        shippingFee: 0, // Taxa de envio (varia por produto)
        totalFeeRate: 0.169, // Total aproximado de 16.9%
        category: categoryId || "Geral",
        currency,
      };

      // Função para calcular taxas em um preço específico
      const estimatedFeesOnPrice = (price: number) => {
        const listingFee = fees.listingFee * price;
        const saleFee = fees.saleFee * price;
        const paymentFee = fees.paymentFee * price;
        const totalFees = listingFee + saleFee + paymentFee;
        const netAmount = price - totalFees;

        return {
          listingFee,
          saleFee,
          paymentFee,
          totalFees,
          netAmount,
        };
      };

      return {
        ...fees,
        estimatedFeesOnPrice,
      };
    } catch (error) {
      console.error("Erro ao obter taxas do marketplace:", error);

      // Retornar taxas padrão em caso de erro
      const defaultFees = {
        listingFee: 0,
        saleFee: 0.12,
        paymentFee: 0.049,
        shippingFee: 0,
        totalFeeRate: 0.169,
        category: categoryId || "Geral",
        currency: "BRL",
      };

      return {
        ...defaultFees,
        estimatedFeesOnPrice: (price: number) => ({
          listingFee: 0,
          saleFee: price * 0.12,
          paymentFee: price * 0.049,
          totalFees: price * 0.169,
          netAmount: price * 0.831,
        }),
      };
    }
  }

  /**
   * Sincroniza produtos locais com produtos do ML usando SKU com validação de token
   */
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
    console.log("[DEBUG] Starting SKU sync for account:", accountId);

    try {
      // Verificar se o token é válido antes de continuar
      const isValid = await this.validateToken(accessToken);
      if (!isValid) {
        throw new Error(
          "Token de acesso inválido ou expirado. Reconecte a conta do Mercado Livre."
        );
      }

      // Obter token válido (renovado se necessário)
      const validToken = await this.getValidToken(accountId);

      // Obter todos os produtos do ML do usuário usando o método corrigido
      const allMLItems: string[] = [];
      let offset = 0;
      const limit = 50;
      let hasMore = true;

      // Buscar todos os produtos paginando
      while (hasMore && offset < 1000) {
        // Limite de segurança
        console.log(
          `[DEBUG] Fetching items page: offset=${offset}, limit=${limit}`
        );

        const itemsResponse = await this.getUserItems(validToken, {
          offset,
          limit,
          status: "active",
        });

        if (itemsResponse.results && itemsResponse.results.length > 0) {
          allMLItems.push(...itemsResponse.results);
          offset += limit;

          // Verificar se há mais páginas
          const total = itemsResponse.paging?.total || 0;
          hasMore = offset < total;

          console.log(
            `[DEBUG] Page processed: ${itemsResponse.results.length} items, total so far: ${allMLItems.length}`
          );
        } else {
          hasMore = false;
        }
      }

      console.log(`[DEBUG] Found ${allMLItems.length} ML items total`);

      if (allMLItems.length === 0) {
        return {
          matched: 0,
          unmatched: 0,
          total: 0,
          results: [],
        };
      }

      // Obter detalhes completos dos items em lotes de 20 (limite da API)
      const itemDetails: MLItem[] = [];
      for (let i = 0; i < allMLItems.length; i += 20) {
        const batch = allMLItems.slice(i, i + 20);
        console.log(
          `[DEBUG] Processing batch ${Math.floor(i / 20) + 1}/${Math.ceil(
            allMLItems.length / 20
          )}: ${batch.length} items`
        );

        try {
          const batchDetails = await this.getMultipleItems(batch, validToken);
          itemDetails.push(...batchDetails);
          console.log(
            `[DEBUG] Batch processed successfully: ${batchDetails.length} items`
          );
        } catch (batchError) {
          console.error(
            `[ERROR] Failed to process batch ${i}-${i + 20}:`,
            batchError
          );
          // Continuar com os próximos lotes mesmo se um falhar
        }
      }

      console.log(
        `[DEBUG] Total item details retrieved: ${itemDetails.length}`
      );

      // Processar cada item para sincronização por SKU
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
        // Procurar SKU no seller_custom_field ou nos atributos
        let sku = mlItem.seller_custom_field;

        if (!sku) {
          // Procurar nos atributos SELLER_SKU
          const skuAttribute = mlItem.attributes?.find(
            (attr) => attr.id === "SELLER_SKU"
          );
          sku = skuAttribute?.value_name;
        }

        if (sku) {
          // Tentar encontrar produto local por SKU
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

      console.log(
        `[DEBUG] SKU sync completed: ${matched} matched, ${unmatched} unmatched`
      );

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

  /**
   * Busca produto local por SKU
   */
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

  /**
   * Limpa code_verifiers antigos do cache
   */
  private static cleanupCodeVerifierCache(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutos

    for (const [key, value] of this.codeVerifierCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.codeVerifierCache.delete(key);
      }
    }
  }

  /**
   * Busca code_verifier do cache
   */
  private static getCodeVerifier(state: string): string | null {
    const cached = this.codeVerifierCache.get(state);
    if (cached) {
      // Remover do cache após uso
      this.codeVerifierCache.delete(state);
      console.log(
        `[ML_PKCE] Code verifier encontrado e removido para state: ${state}`
      );
      return cached.verifier;
    }
    console.log(`[ML_PKCE] Code verifier não encontrado para state: ${state}`);
    return null;
  }

  /**
   * ✅ NOVO: Retry para sincronização de preços
   */
  private static async retryPriceSync(
    itemId: string,
    accessToken: string,
    accountId: string,
    maxRetries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[PRICE_RETRY] Tentativa ${attempt}/${maxRetries} para item ${itemId}`);

        // Buscar preços detalhados usando API oficial /prices
        const pricesResponse = await fetch(
          `https://api.mercadolibre.com/items/${itemId}/prices`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json();

          // Processar dados de preço
          const standardPrice = pricesData.prices?.find(
            (p: any) =>
              p.type === "standard" &&
              p.conditions?.context_restrictions?.includes("channel_marketplace")
          );

          const promotionPrice = pricesData.prices?.find(
            (p: any) =>
              p.type === "promotion" &&
              p.conditions?.context_restrictions?.includes("channel_marketplace")
          );

          let currentPrice, originalPrice, hasPromotion = false, promotionDiscount = 0;

          if (promotionPrice) {
            currentPrice = Math.round(promotionPrice.amount * 100);
            originalPrice = Math.round(promotionPrice.regular_amount * 100);
            hasPromotion = true;
            promotionDiscount = Math.round(
              ((promotionPrice.regular_amount - promotionPrice.amount) /
                promotionPrice.regular_amount) *
                100
            );
          } else if (standardPrice) {
            currentPrice = Math.round(standardPrice.amount * 100);
          }

          if (currentPrice) {
            // Atualizar no banco de dados
            await prisma.produtoMercadoLivre.updateMany({
              where: {
                mlItemId: itemId,
                mercadoLivreAccountId: accountId,
              },
              data: {
                mlPrice: currentPrice,
                mlOriginalPrice: originalPrice || null,
                mlHasPromotion: hasPromotion,
                mlPromotionDiscount: hasPromotion ? promotionDiscount : null,
                lastSyncAt: new Date(),
                syncStatus: "synced",
              },
            });

            console.log(`[PRICE_RETRY] Preços atualizados com sucesso para ${itemId}`);
            return; // Sucesso, sair do loop
          }
        }

        throw new Error(`Resposta inválida da API de preços (${pricesResponse.status})`);
      } catch (error) {
        console.warn(`[PRICE_RETRY] Tentativa ${attempt} falhou para ${itemId}:`, error);

        if (attempt === maxRetries) {
          console.error(`[PRICE_RETRY] Todas as tentativas falharam para ${itemId}`);

          // Marcar como erro no banco
          await prisma.produtoMercadoLivre.updateMany({
            where: {
              mlItemId: itemId,
              mercadoLivreAccountId: accountId,
            },
            data: {
              syncStatus: "error",
              syncError: `Erro ao buscar preços após ${maxRetries} tentativas`,
              lastSyncAt: new Date(),
            },
          });
        } else {
          // Aguardar antes da próxima tentativa (backoff exponencial)
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  /**
   * Sincroniza estoque entre ML e sistema local
   */
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
          // Buscar dados do ML
          const mlItem = await this.getItem(mapping.mlItemId, accessToken);

          // Buscar dados locais
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

          // Calcular estoque total local
          const totalLocalStock = localProduct.estoques.reduce(
            (total, estoque) => total + estoque.quantidade,
            0
          );

          // Sincronizar baseado na direção
          if (
            mapping.syncDirection === "local_to_ml" ||
            mapping.syncDirection === "bidirectional"
          ) {
            // Atualizar estoque no ML
            try {
              await this.updateItem(
                mapping.mlItemId,
                {
                  available_quantity: totalLocalStock,
                },
                accessToken
              );

              console.log(
                `Estoque sincronizado ML <- Local: ${mapping.mlItemId} = ${totalLocalStock}`
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
            // Atualizar estoque local (apenas se houver diferença significativa)
            const difference = Math.abs(
              mlItem.available_quantity - totalLocalStock
            );
            if (difference > 0) {
              console.log(
                `Diferença de estoque detectada: ML=${mlItem.available_quantity}, Local=${totalLocalStock}`
              );
              // Implementar lógica de atualização do estoque local se necessário
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
