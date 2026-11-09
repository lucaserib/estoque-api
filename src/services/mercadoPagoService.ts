import { responderMercadoPagoFalso, usarMercadoPagoFalso } from "./mercadoPagoFalso";

const MP_API_BASE = "https://api.mercadopago.com";

export class MercadoPagoNotConfiguredError extends Error {
  readonly code = "MP_NOT_CONFIGURED";

  constructor() {
    super("Integração com o Mercado Pago não está configurada");
  }
}

interface CreatePreapprovalParams {
  reason: string;
  payerEmail: string;
  transactionAmount: number;
  frequency: number;
  frequencyType: "days" | "months";
  backUrl: string;
  externalReference: string;
  startDate?: Date | null;
}

export interface MercadoPagoPreapproval {
  id: string;
  status: string;
  init_point: string;
  payer_email: string;
  external_reference?: string | null;
  auto_recurring: {
    transaction_amount: number;
    frequency: number;
    frequency_type: string;
    start_date?: string | null;
  };
  next_payment_date?: string | null;
}

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new MercadoPagoNotConfiguredError();
  return token;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN) || usarMercadoPagoFalso();
}

async function mpFetch<T>(path: string, init: RequestInit): Promise<T> {
  if (usarMercadoPagoFalso()) {
    const corpo = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    return responderMercadoPagoFalso(path, init.method ?? "GET", corpo) as T;
  }
  const response = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Mercado Pago respondeu ${response.status} em ${path}: ${body}`
    );
  }

  return response.json() as Promise<T>;
}

export const MercadoPagoService = {
  async createPreapproval(
    params: CreatePreapprovalParams
  ): Promise<MercadoPagoPreapproval> {
    return mpFetch<MercadoPagoPreapproval>("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: params.reason,
        payer_email: params.payerEmail,
        external_reference: params.externalReference,
        back_url: params.backUrl,
        status: "pending",
        auto_recurring: {
          frequency: params.frequency,
          frequency_type: params.frequencyType,
          transaction_amount: params.transactionAmount,
          currency_id: "BRL",
          ...(params.startDate ? { start_date: params.startDate.toISOString() } : {}),
        },
      }),
    });
  },

  async getPreapproval(id: string): Promise<MercadoPagoPreapproval> {
    return mpFetch<MercadoPagoPreapproval>(`/preapproval/${id}`, {
      method: "GET",
    });
  },

  async updatePreapprovalAmount(
    id: string,
    transactionAmount: number
  ): Promise<MercadoPagoPreapproval> {
    return mpFetch<MercadoPagoPreapproval>(`/preapproval/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        auto_recurring: { transaction_amount: transactionAmount },
      }),
    });
  },

  async cancelPreapproval(id: string): Promise<MercadoPagoPreapproval> {
    return mpFetch<MercadoPagoPreapproval>(`/preapproval/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
  },

  async getPayment(id: string): Promise<PagamentoMercadoPago> {
    return mpFetch(`/v1/payments/${id}`, { method: "GET" });
  },

  async criarPreferencia(preferencia: PreferenciaMercadoPago): Promise<{ id: string; init_point: string; sandbox_init_point?: string }> {
    return mpFetch("/checkout/preferences", { method: "POST", body: JSON.stringify(preferencia) });
  },

  async reembolsarPagamento(id: string, chaveIdempotencia: string): Promise<{ id: number; status: string }> {
    return mpFetch(`/v1/payments/${id}/refunds`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "X-Idempotency-Key": chaveIdempotencia },
    });
  },

  async pausarPreapproval(id: string): Promise<MercadoPagoPreapproval> {
    return mpFetch<MercadoPagoPreapproval>(`/preapproval/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "paused" }),
    });
  },

  async reativarPreapproval(id: string): Promise<MercadoPagoPreapproval> {
    return mpFetch<MercadoPagoPreapproval>(`/preapproval/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "authorized" }),
    });
  },
};

export interface PagamentoMercadoPago {
  id: number;
  status: string;
  status_detail?: string | null;
  external_reference: string | null;
  date_approved?: string | null;
  date_created?: string | null;
  transaction_amount?: number | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  payer?: { email?: string | null } | null;
  metadata?: Record<string, unknown> | null;
}

export interface PreferenciaMercadoPago {
  items: Array<{ id: string; title: string; quantity: number; unit_price: number; currency_id: "BRL" }>;
  external_reference: string;
  notification_url?: string;
  back_urls: { success: string; pending: string; failure: string };
  auto_return?: "approved" | "all";
  payer?: { email: string };
  payment_methods?: {
    excluded_payment_types?: Array<{ id: string }>;
    installments?: number;
  };
  expires?: boolean;
  expiration_date_to?: string;
  date_of_expiration?: string;
  statement_descriptor?: string;
  metadata?: Record<string, string>;
}

export function planToRecurringConfig(plan: "MONTHLY" | "ANNUAL", primeiraCobrancaCentavos: number) {
  return {
    frequency: plan === "ANNUAL" ? 12 : 1,
    frequencyType: "months" as const,
    transactionAmount: centavosParaReais(primeiraCobrancaCentavos),
  };
}

export function centavosParaReais(centavos: number): number {
  return Math.round(centavos) / 100;
}
