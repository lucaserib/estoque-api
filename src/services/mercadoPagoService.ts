import { PRICING } from "@/lib/billing";

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
}

export interface MercadoPagoPreapproval {
  id: string;
  status: string;
  init_point: string;
  payer_email: string;
  auto_recurring: {
    transaction_amount: number;
    frequency: number;
    frequency_type: string;
  };
}

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new MercadoPagoNotConfiguredError();
  return token;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

async function mpFetch<T>(path: string, init: RequestInit): Promise<T> {
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

  async getPayment(id: string): Promise<{
    id: number;
    status: string;
    external_reference: string | null;
  }> {
    return mpFetch(`/v1/payments/${id}`, { method: "GET" });
  },
};

export function planToRecurringConfig(plan: "MONTHLY" | "ANNUAL") {
  if (plan === "ANNUAL") {
    return {
      frequency: 12,
      frequencyType: "months" as const,
      transactionAmount: PRICING.ANNUAL,
    };
  }

  return {
    frequency: 1,
    frequencyType: "months" as const,
    transactionAmount: PRICING.MONTHLY_FIRST_CYCLE,
  };
}
