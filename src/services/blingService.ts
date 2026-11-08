import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/services/notificationService";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { throttleBlingRequest } from "@/lib/blingRateLimiter";

export interface BlingProductSupplierRef {
  id: number;
}

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
  marca?: string;
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
  variacoes?: Array<{ id: number; codigo?: string; nome?: string }>;
  estrutura?: {
    componentes?: Array<{
      produto: BlingProductSupplierRef;
      quantidade: number;
    }>;
  };
}

export interface BlingImageInfo {
  url: string;
  temporaria: boolean;
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

export interface BlingDeposit {
  id: number;
  descricao: string;
  padrao: boolean;
}

export interface BlingProductSupplier {
  fornecedor: { id: number };
  codigo?: string;
  precoCusto?: number;
  precoCompra?: number;
  padrao: boolean;
}

export interface BlingContact {
  id: number;
  nome: string;
  numeroDocumento?: string;
  telefone?: string;
  email?: string;
}

export interface BlingContaFinanceira {
  id: number;
  vencimento: string;
  valor: number;
  situacao: number;
  saldo?: number;
  dataEmissao?: string;
  numeroDocumento?: string;
  contato?: { id: number; nome?: string };
  categoria?: { id: number };
  dataPagamento?: string;
  historico?: string;
}

export interface BlingCategoriaReceitaDespesa {
  id: number;
  descricao: string;
  tipo: number;
}

export interface BlingPedidoVenda {
  id: number;
  numero: string;
  data: string;
  total: number;
  situacao?: { id: number; valor?: number };
  loja?: { id: number };
  contato?: { id: number; nome?: string };
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

export type BlingOAuthMotivo =
  | "credenciais_invalidas"
  | "codigo_invalido"
  | "redirect_uri_divergente"
  | "bling_indisponivel"
  | "desconhecido";

function classificarErroOAuth(status: number, corpo: string): BlingOAuthMotivo {
  const texto = corpo.toLowerCase();
  if (status >= 500) return "bling_indisponivel";
  if (texto.includes("invalid_client") || status === 401) return "credenciais_invalidas";
  if (texto.includes("redirect")) return "redirect_uri_divergente";
  if (texto.includes("invalid_grant") || texto.includes("expired") || texto.includes("invalid_request")) {
    return "codigo_invalido";
  }
  return "desconhecido";
}

export class BlingOAuthError extends Error {
  readonly status: number;
  readonly motivo: BlingOAuthMotivo;
  readonly detalhe: string;

  constructor(status: number, corpo: string) {
    const motivo = classificarErroOAuth(status, corpo);
    super(`Bling recusou a troca do código de autorização (${status}, ${motivo})`);
    this.name = "BlingOAuthError";
    this.status = status;
    this.motivo = motivo;
    this.detalhe = corpo.slice(0, 500);
  }
}

export class BlingRateLimitError extends Error {
  constructor() {
    super("O Bling está limitando as requisições. Tente novamente em alguns instantes.");
    this.name = "BlingRateLimitError";
  }
}

export class BlingApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string, mensagem: string) {
    super(mensagem || `Erro ao chamar a API do Bling (${status}) em ${endpoint}`);
    this.name = "BlingApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

const ESCOPO_POR_RECURSO: Array<[RegExp, string]> = [
  [/^\/(estoques|depositos)/, "Estoques e depósitos (leitura)"],
  [/^\/produtos\/fornecedores/, "Produtos — fornecedores (leitura)"],
  [/^\/produtos/, "Produtos (leitura)"],
  [/^\/contatos/, "Contatos (leitura)"],
  [/^\/(contas|categorias|formas-pagamentos)/, "Financeiro — contas a pagar/receber (leitura)"],
  [/^\/pedidos/, "Pedidos de venda (leitura)"],
  [/^\/empresas/, "Dados básicos da empresa"],
  [/^\/nfe/, "Notas fiscais (leitura)"],
];

export class BlingEscopoError extends Error {
  readonly code = "BLING_ESCOPO_INSUFICIENTE";
  readonly escopo: string;

  constructor(path: string) {
    const recurso = path.split("?")[0];
    const escopo = ESCOPO_POR_RECURSO.find(([padrao]) => padrao.test(recurso))?.[1] ?? recurso;
    super(
      `O Bling não deu permissão para "${escopo}". No Bling, abra Central de extensões → Área do integrador → app Skubo → Escopos, marque "${escopo}", salve e depois clique em Reconectar Bling em Integrações.`
    );
    this.name = "BlingEscopoError";
    this.escopo = escopo;
  }
}

export function escopoFaltandoDe(erro: unknown): string | null {
  if (erro instanceof BlingEscopoError) return erro.escopo;
  if (erro instanceof BlingApiError && erro.status === 403) {
    const recurso = erro.endpoint.split("?")[0];
    return ESCOPO_POR_RECURSO.find(([padrao]) => padrao.test(recurso))?.[1] ?? null;
  }
  return null;
}

type TokenFormat = "jwt" | "opaco";

export function companyIdDoJwt(token: string): string | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const id = claims.company_id ?? claims.companyId;
    return typeof id === "number" || (typeof id === "string" && id.length > 0) ? String(id) : null;
  } catch {
    return null;
  }
}

const BLING_JWT_HEADER = { "enable-jwt": "1" } as const;
const TOKEN_RENEWAL_WINDOW_MS = 10 * 60 * 1000;
const PAGE_DELAY_MS = 100;
const MAX_RETRIES_429 = 4;
const MAX_CONSECUTIVE_ERRORS = 20;
const REFRESH_LOCK_TIMEOUT_MS = 15000;
const REFRESH_LOCK_MAX_WAIT_MS = 10000;

type LockedRefreshResult =
  | { kind: "ok"; accessToken: string }
  | { kind: "reconnect" };

export class BlingService {
  private static readonly BASE_URL = "https://api.bling.com.br/Api/v3";
  private static readonly AUTH_URL = "https://www.bling.com.br/Api/v3/oauth";
  private static readonly TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";
  private static get CLIENT_ID(): string {
    return process.env.BLING_CLIENT_ID?.trim() ?? "";
  }
  private static get CLIENT_SECRET(): string {
    return process.env.BLING_CLIENT_SECRET?.trim() ?? "";
  }
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
    const response = await fetch(this.TOKEN_URL, {
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
      const corpo = await response.text();
      throw new BlingOAuthError(response.status, corpo);
    }

    const tokens = (await response.json()) as BlingAuthTokens;
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new BlingOAuthError(response.status, "resposta_sem_tokens");
    }

    return tokens;
  }

  static async refreshAccessToken(
    refreshToken: string
  ): Promise<BlingAuthTokens> {
    const response = await fetch(this.TOKEN_URL, {
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

  private static async requestRaw(
    path: string,
    accountId: string,
    init?: RequestInit
  ): Promise<Response> {
    await throttleBlingRequest(accountId);
    const accessToken = await this.getValidToken(accountId);
    let response = await this.rawFetch(path, accessToken, init);

    if (response.status === 401) {
      const refreshedToken = await this.forceRefreshToken(accountId);
      await throttleBlingRequest(accountId);
      response = await this.rawFetch(path, refreshedToken, init);
      if (response.status === 401) {
        throw new BlingReconnectError();
      }
    }

    let attempt = 0;
    while (response.status === 429 && attempt < MAX_RETRIES_429) {
      attempt++;
      const retryAfterHeader = response.headers.get("Retry-After");
      const waitMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : 1000 * 2 ** attempt + Math.random() * 250;
      await this.sleep(waitMs);
      await throttleBlingRequest(accountId);
      const currentToken = await this.getValidToken(accountId);
      response = await this.rawFetch(path, currentToken, init);
    }

    if (response.status === 429) {
      throw new BlingRateLimitError();
    }

    if (!response.ok) {
      const mensagem = await response.text();
      if (mensagem.includes("insufficient_scope")) throw new BlingEscopoError(path);
      throw new BlingApiError(response.status, path, mensagem);
    }

    return response;
  }

  private static async requestJson<T>(
    path: string,
    accountId: string,
    init?: RequestInit
  ): Promise<T> {
    const response = await this.requestRaw(path, accountId, init);
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  static async getProducts(
    accountId: string,
    page: number = 1,
    limit: number = 100,
    dataAlteracaoInicial?: string
  ): Promise<BlingProductsResponse> {
    const params = new URLSearchParams({
      pagina: page.toString(),
      limite: limit.toString(),
      criterio: "5",
      tipo: "P",
    });

    if (dataAlteracaoInicial) {
      params.set("dataAlteracaoInicial", dataAlteracaoInicial);
    }

    const data = await this.requestJson<{ data?: BlingProduct[] }>(
      `/produtos?${params.toString()}`,
      accountId
    );

    return { data: data.data || [] };
  }

  static async getContasPagar(
    accountId: string,
    page: number = 1,
    limit: number = 100,
    dataInicial?: string
  ): Promise<BlingContaFinanceira[]> {
    const params = new URLSearchParams({ pagina: String(page), limite: String(limit) });
    if (dataInicial) params.set("dataInicialVencimento", dataInicial);
    const data = await this.requestJson<{ data?: BlingContaFinanceira[] }>(
      `/contas/pagar?${params.toString()}`,
      accountId
    );
    return data.data ?? [];
  }

  static async getContasReceber(
    accountId: string,
    page: number = 1,
    limit: number = 100,
    dataInicial?: string
  ): Promise<BlingContaFinanceira[]> {
    const params = new URLSearchParams({ pagina: String(page), limite: String(limit) });
    if (dataInicial) params.set("dataInicialVencimento", dataInicial);
    const data = await this.requestJson<{ data?: BlingContaFinanceira[] }>(
      `/contas/receber?${params.toString()}`,
      accountId
    );
    return data.data ?? [];
  }

  static async getCategoriasReceitasDespesas(
    accountId: string
  ): Promise<BlingCategoriaReceitaDespesa[]> {
    const data = await this.requestJson<{ data?: BlingCategoriaReceitaDespesa[] }>(
      `/categorias/receitas-despesas`,
      accountId
    );
    return data.data ?? [];
  }

  static async getPedidosVendas(
    accountId: string,
    page: number = 1,
    limit: number = 100,
    dataInicial?: string
  ): Promise<BlingPedidoVenda[]> {
    const params = new URLSearchParams({ pagina: String(page), limite: String(limit) });
    if (dataInicial) params.set("dataInicial", dataInicial);
    const data = await this.requestJson<{ data?: BlingPedidoVenda[] }>(
      `/pedidos/vendas?${params.toString()}`,
      accountId
    );
    return data.data ?? [];
  }

  static async buscarProdutos(accountId: string, termo: string, limite = 20): Promise<BlingProduct[]> {
    const limpo = termo.trim();
    if (!limpo) return [];
    const base = { pagina: "1", limite: String(limite), criterio: "2", tipo: "T" };
    const consultas: URLSearchParams[] = [];
    if (!/\s/.test(limpo)) {
      const porCodigo = new URLSearchParams(base);
      porCodigo.append("codigos[]", limpo);
      consultas.push(porCodigo);
    }
    consultas.push(new URLSearchParams({ ...base, nome: limpo }));

    const vistos = new Map<number, BlingProduct>();
    for (const params of consultas) {
      const data = await this.requestJson<{ data?: BlingProduct[] }>(`/produtos?${params.toString()}`, accountId);
      for (const produto of data.data ?? []) {
        if (!vistos.has(produto.id)) vistos.set(produto.id, produto);
      }
      if (vistos.size >= limite) break;
    }
    return [...vistos.values()].slice(0, limite);
  }

  static async getProductById(
    accountId: string,
    productId: number
  ): Promise<BlingProduct> {
    const data = await this.requestJson<{ data: BlingProduct }>(
      `/produtos/${productId}`,
      accountId
    );
    return data.data;
  }

  static async getAllProducts(
    accountId: string,
    dataAlteracaoInicial?: string
  ): Promise<BlingProduct[]> {
    const pageSize = 100;
    const allProducts: BlingProduct[] = [];
    let currentPage = 1;
    let consecutiveErrors = 0;

    for (;;) {
      let response: BlingProductsResponse;
      try {
        response = await this.getProducts(
          accountId,
          currentPage,
          pageSize,
          dataAlteracaoInicial
        );
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          throw error;
        }
        await this.sleep(PAGE_DELAY_MS);
        continue;
      }

      if (!response.data || response.data.length === 0) {
        break;
      }

      allProducts.push(...response.data);

      if (response.data.length < pageSize) {
        break;
      }

      currentPage++;
      await this.sleep(PAGE_DELAY_MS);
    }

    return allProducts;
  }

  static async getProductsStock(
    accountId: string,
    productIds: number[]
  ): Promise<BlingStockResponse> {
    const params = new URLSearchParams({ pagina: "1", limite: "100" });
    productIds.forEach((id) => {
      params.append("idsProdutos[]", id.toString());
    });

    const data = await this.requestJson<{ data?: BlingStockItem[] }>(
      `/estoques/saldos?${params.toString()}`,
      accountId
    );

    return { data: data.data || [] };
  }

  static async getStockForProducts(
    accountId: string,
    productIds: number[]
  ): Promise<BlingStockItem[]> {
    const batchSize = 50;
    const allStock: BlingStockItem[] = [];

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const { data } = await this.getProductsStock(accountId, batch);
      allStock.push(...data);

      if (i + batchSize < productIds.length) {
        await this.sleep(PAGE_DELAY_MS);
      }
    }

    return allStock;
  }

  static async getDeposits(accountId: string): Promise<BlingDeposit[]> {
    const data = await this.requestJson<{ data?: BlingDeposit[] }>(
      "/depositos",
      accountId
    );
    return data.data || [];
  }

  static async getProductSuppliers(
    accountId: string,
    produtoId: number
  ): Promise<BlingProductSupplier[]> {
    const params = new URLSearchParams({ idProduto: produtoId.toString() });
    const data = await this.requestJson<{ data?: BlingProductSupplier[] }>(
      `/produtos/fornecedores?${params.toString()}`,
      accountId
    );
    return data.data || [];
  }

  static async getContact(
    accountId: string,
    contatoId: number
  ): Promise<BlingContact> {
    const data = await this.requestJson<{ data: BlingContact }>(
      `/contatos/${contatoId}`,
      accountId
    );
    return data.data;
  }

  static async updateProductStock(
    accountId: string,
    produtoId: number,
    depositoId: number,
    quantidade: number
  ): Promise<void> {
    await this.requestRaw("/estoques", accountId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        produto: { id: produtoId },
        deposito: { id: depositoId },
        operacao: "B",
        quantidade,
        observacoes: "Ajuste Skubo",
      }),
    });
  }

  static async listarNotasFiscaisSaida(
    accountId: string,
    filtros: { pagina: number; dataEmissaoInicial: string; dataEmissaoFinal: string; limite?: number }
  ): Promise<Array<Record<string, unknown>>> {
    const params = new URLSearchParams({
      pagina: String(filtros.pagina),
      limite: String(filtros.limite ?? 100),
      tipo: "1",
      dataEmissaoInicial: filtros.dataEmissaoInicial,
      dataEmissaoFinal: filtros.dataEmissaoFinal,
    });
    const data = await this.requestJson<{ data?: Array<Record<string, unknown>> }>(`/nfe?${params.toString()}`, accountId);
    return data.data ?? [];
  }

  static async obterNotaFiscal(accountId: string, id: string): Promise<Record<string, unknown> | null> {
    const data = await this.requestJson<{ data?: Record<string, unknown> }>(`/nfe/${encodeURIComponent(id)}`, accountId);
    return data.data ?? null;
  }

  static async verificarEscopos(accountId: string): Promise<string[]> {
    const testes: Array<[string, string]> = [
      ["/produtos?pagina=1&limite=1", "Produtos (leitura)"],
      ["/produtos/fornecedores?pagina=1&limite=1", "Produtos — fornecedores (leitura)"],
      ["/contatos?pagina=1&limite=1", "Contatos (leitura)"],
      ["/depositos", "Estoques e depósitos (leitura)"],
      ["/nfe?pagina=1&limite=1", "Notas fiscais (leitura)"],
      ["/empresas/me/dados-basicos", "Dados básicos da empresa"],
    ];
    const faltando: string[] = [];
    for (const [caminho, escopo] of testes) {
      try {
        await this.requestJson(caminho, accountId);
      } catch (error) {
        if (error instanceof BlingEscopoError) faltando.push(escopo);
        else if (error instanceof BlingApiError && error.status === 403) faltando.push(escopo);
        else if (error instanceof BlingReconnectError) throw error;
      }
    }
    return faltando;
  }

  static async getCompanyId(accountId: string): Promise<string | null> {
    try {
      const body = await this.requestJson<{ data?: unknown }>(
        "/empresas/me/dados-basicos",
        accountId
      );
      const empresa = Array.isArray(body?.data) ? body.data[0] : body?.data;
      const id = (empresa as { id?: unknown } | undefined)?.id;
      return id !== undefined && id !== null ? String(id) : null;
    } catch (error) {
      if (!(error instanceof BlingEscopoError)) {
        console.error("Erro ao buscar dados da empresa no Bling:", error);
      }
      return null;
    }
  }

  static async companyIdDoToken(accountId: string): Promise<string | null> {
    try {
      return companyIdDoJwt(await this.getValidToken(accountId));
    } catch {
      return null;
    }
  }

  static async produtoPertenceAConta(accountId: string, produtoId: string): Promise<boolean> {
    const id = Number(produtoId);
    if (!Number.isSafeInteger(id) || id <= 0) return false;
    try {
      await this.getProductById(accountId, id);
      return true;
    } catch {
      return false;
    }
  }

  static pareceUrlAssinada(url: string): boolean {
    return /X-Amz-|Expires=|Signature=/i.test(url) || /\.s3[.\-][\w-]*\.amazonaws\.com/i.test(url);
  }

  static extractImageInfo(product: BlingProduct): BlingImageInfo | null {
    const externa = normalizeImageUrl(product.midia?.imagens?.externas?.[0]?.link ?? null);
    if (externa) {
      return { url: externa, temporaria: this.pareceUrlAssinada(externa) };
    }

    const interna = normalizeImageUrl(
      product.midia?.imagens?.internas?.[0]?.linkMiniatura ?? null
    );
    if (interna) {
      return { url: interna, temporaria: true };
    }

    const generica = normalizeImageUrl(
      product.midia?.imagens?.imagensURL?.[0] ?? product.imagemURL ?? null
    );
    return generica ? { url: generica, temporaria: this.pareceUrlAssinada(generica) } : null;
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

  static isKit(product: BlingProduct): boolean {
    return product.formato === "E";
  }
}
