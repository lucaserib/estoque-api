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

  // Domínios possíveis de autorização baseados na documentação oficial
  private static readonly AUTH_DOMAINS = [
    "https://auth.mercadolibre.com.ar", // Padrão da documentação
    "https://auth.mercadolibre.com.br", // Específico do Brasil
    "https://global-selling.mercadolibre.com", // Para Global Selling
  ];

  // URLs de configuração - você deve configurar isso no .env
  private static readonly CLIENT_ID = process.env.ML_CLIENT_ID!;
  private static readonly CLIENT_SECRET = process.env.ML_CLIENT_SECRET!;
  private static readonly REDIRECT_URI = process.env.ML_REDIRECT_URI!;

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
    // Baseado na documentação oficial, usar o domínio padrão Argentina para todos os países
    return this.AUTH_DOMAINS[0]; // auth.mercadolibre.com.ar
  }

  /**
   * Gera URL de autorização para conectar conta do ML
   * Seguindo a documentação oficial: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
   *
   * IMPORTANTE: Usando domínio padrão (.com.ar) mas especificando site_id=MLB para Brasil
   */
  static getAuthURL(state?: string): string {
    this.validateConfig();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      site_id: "MLB", // Especifica Brasil (MercadoLibre Brasil)
      ...(state && { state }), // Adiciona state apenas se fornecido
    });

    const authDomain = this.getAuthDomain();
    const authUrl = `${authDomain}/authorization?${params.toString()}`;

    console.log("URL de autorização gerada:", authUrl);
    console.log("Domínio de auth usado:", authDomain);
    console.log("Parâmetros:", {
      response_type: "code",
      client_id: this.CLIENT_ID.substring(0, 8) + "...",
      redirect_uri: this.REDIRECT_URI,
      site_id: "MLB",
      state: state ? "presente" : "ausente",
    });

    return authUrl;
  }

  /**
   * Troca código de autorização por tokens de acesso
   */
  static async exchangeCodeForToken(code: string): Promise<MLAuthResponse> {
    console.log("Trocando código por token...");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      code,
      redirect_uri: this.REDIRECT_URI,
    });

    console.log("Parâmetros da requisição:", {
      grant_type: "authorization_code",
      client_id: this.CLIENT_ID.substring(0, 8) + "...",
      redirect_uri: this.REDIRECT_URI,
      code: code.substring(0, 8) + "...",
    });

    const response = await fetch(`${this.BASE_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const responseData = await response.json();
    console.log("Resposta da troca de token:", {
      status: response.status,
      ok: response.ok,
      hasAccessToken: !!responseData.access_token,
      error: responseData.error,
    });

    if (!response.ok) {
      console.error("Erro na autenticação ML:", responseData);

      // Tratamento específico de erros conforme documentação
      if (responseData.error === "invalid_grant") {
        throw new Error(
          "Código de autorização inválido ou expirado. O código pode ter sido usado anteriormente ou expirou."
        );
      }

      if (responseData.error === "invalid_client") {
        throw new Error(
          "Credenciais da aplicação inválidas. Verifique ML_CLIENT_ID e ML_CLIENT_SECRET."
        );
      }

      if (responseData.error === "invalid_request") {
        throw new Error(
          "Requisição mal formada. Verifique os parâmetros enviados."
        );
      }

      throw new Error(
        `Erro na autenticação ML: ${
          responseData.error_description ||
          responseData.message ||
          response.statusText
        }`
      );
    }

    return responseData;
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
   * Lista todos os produtos do usuário no ML
   */
  static async getUserItems(
    accessToken: string,
    filters: MLSearchFilters = {}
  ): Promise<MLItemsResponse> {
    const params = new URLSearchParams({
      offset: (filters.offset || 0).toString(),
      limit: (filters.limit || 50).toString(),
    });

    if (filters.status) params.append("status", filters.status);
    if (filters.category) params.append("category", filters.category);

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
        `Erro ao listar produtos ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Obtém detalhes de um produto específico
   */
  static async getItem(itemId: string, accessToken?: string): Promise<MLItem> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.BASE_URL}/items/${itemId}`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter produto ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Obtém detalhes de múltiplos produtos
   */
  static async getMultipleItems(
    itemIds: string[],
    accessToken?: string
  ): Promise<MLItem[]> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const params = new URLSearchParams();
    itemIds.forEach((id) => params.append("ids", id));

    const response = await fetch(
      `${this.BASE_URL}/items?${params.toString()}`,
      {
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Erro ao obter produtos ML: ${error.message || response.statusText}`
      );
    }

    const data = await response.json();
    return data.map((item: any) => item.body);
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
  ): Promise<{ results: MLOrder[]; paging: any }> {
    const params = new URLSearchParams({
      offset: (filters.offset || 0).toString(),
      limit: (filters.limit || 50).toString(),
    });

    if (filters.seller) params.append("seller", filters.seller);
    if (filters.buyer) params.append("buyer", filters.buyer);
    if (filters.status) params.append("order.status", filters.status);
    if (filters.sort) params.append("sort", filters.sort);

    const response = await fetch(
      `${this.BASE_URL}/orders/search?${params.toString()}`,
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
        `Erro ao obter pedidos ML: ${error.message || response.statusText}`
      );
    }

    return response.json();
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
    const account = await prisma.mercadoLivreAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    // Se o token ainda não expirou, retorna o atual
    if (account.expiresAt > new Date()) {
      return account.accessToken;
    }

    // Renova o token
    try {
      const newTokens = await this.refreshAccessToken(account.refreshToken);

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

  static async saveAccount(
    userId: string,
    authResponse: MLAuthResponse,
    userInfo: MLUserInfo
  ): Promise<MercadoLivreAccount> {
    const expiresAt = new Date(Date.now() + authResponse.expires_in * 1000);

    return prisma.mercadoLivreAccount.upsert({
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
      create: {
        userId,
        mlUserId: userInfo.id.toString(),
        accessToken: authResponse.access_token,
        refreshToken: authResponse.refresh_token,
        expiresAt,
        nickname: userInfo.nickname,
        siteId: userInfo.site_id,
        isActive: true,
      },
    });
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
   * Processa webhook do ML
   */
  static async processWebhook(
    accountId: string,
    notificationData: {
      resource: string;
      user_id: string;
      topic: string;
      application_id: string;
    }
  ): Promise<void> {
    // Salvar webhook no banco
    const webhook = await prisma.mercadoLivreWebhook.create({
      data: {
        mercadoLivreAccountId: accountId,
        mlNotificationId: `${notificationData.resource}_${Date.now()}`,
        resource: notificationData.resource,
        userId: notificationData.user_id,
        topic: notificationData.topic,
        applicationId: notificationData.application_id,
        attempts: 0,
        processed: false,
      },
    });

    // Processar webhook baseado no tópico
    try {
      switch (notificationData.topic) {
        case "items":
          await this.processItemWebhook(accountId, notificationData.resource);
          break;
        case "orders":
          await this.processOrderWebhook(accountId, notificationData.resource);
          break;
        default:
          console.log(`Tópico não processado: ${notificationData.topic}`);
      }

      // Marcar como processado
      await prisma.mercadoLivreWebhook.update({
        where: { id: webhook.id },
        data: {
          processed: true,
          processedAt: new Date(),
          attempts: webhook.attempts + 1,
        },
      });
    } catch (error) {
      // Marcar erro
      await prisma.mercadoLivreWebhook.update({
        where: { id: webhook.id },
        data: {
          error: error instanceof Error ? error.message : "Erro desconhecido",
          attempts: webhook.attempts + 1,
        },
      });
      throw error;
    }
  }

  /**
   * Processa webhook de item
   */
  private static async processItemWebhook(
    accountId: string,
    resource: string
  ): Promise<void> {
    const itemId = resource.split("/").pop();
    if (!itemId) return;

    try {
      const accessToken = await this.getValidToken(accountId);
      const item = await this.getItem(itemId, accessToken);

      // Atualizar produto no banco
      await prisma.produtoMercadoLivre.updateMany({
        where: {
          mlItemId: itemId,
          mercadoLivreAccountId: accountId,
        },
        data: {
          mlTitle: item.title,
          mlPrice: Math.round(item.price * 100),
          mlAvailableQuantity: item.available_quantity,
          mlSoldQuantity: item.sold_quantity,
          mlStatus: item.status,
          mlCondition: item.condition,
          mlLastUpdated: new Date(item.last_updated),
          lastSyncAt: new Date(),
          syncStatus: "synced",
        },
      });
    } catch (error) {
      console.error(`Erro ao processar webhook do item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Processa webhook de pedido
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

      // Aqui você pode processar o pedido conforme necessário
      // Por exemplo, criar registros de venda, atualizar estoque, etc.
      console.log(`Pedido processado: ${orderId}`, order.status);
    } catch (error) {
      console.error(`Erro ao processar webhook do pedido ${orderId}:`, error);
      throw error;
    }
  }
}
