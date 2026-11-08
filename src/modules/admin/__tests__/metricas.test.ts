import { describe, expect, it, vi } from "vitest";
import { StatusIaAssinatura, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { mrrEstimado } = await import("../metricas");

describe("mrrEstimado", () => {
  it("soma mensal, anual dividido por 12 e o add-on de IA de quem tem a IA paga ativa", () => {
    const r = mrrEstimado([
      { status: SubscriptionStatus.ACTIVE, plan: SubscriptionPlan.MONTHLY, iaStatus: StatusIaAssinatura.ATIVA },
      { status: SubscriptionStatus.ACTIVE, plan: SubscriptionPlan.ANNUAL, iaStatus: StatusIaAssinatura.INATIVA },
      { status: SubscriptionStatus.TRIALING, plan: null, iaStatus: StatusIaAssinatura.TESTE },
      { status: SubscriptionStatus.TRIALING, plan: null, iaStatus: StatusIaAssinatura.ATIVA },
      { status: SubscriptionStatus.CANCELED, plan: SubscriptionPlan.MONTHLY, iaStatus: StatusIaAssinatura.CANCELADA },
    ]);
    expect(r.receitaIa).toBeCloseTo(29.9 * 2, 2);
    expect(r.mrr).toBeCloseTo(37.9 + 389.7 / 12 + 29.9 * 2, 2);
  });
});
