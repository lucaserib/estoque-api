import { describe, expect, it, vi } from "vitest";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { mrrEstimado } = await import("../metricas");

describe("mrrEstimado", () => {
  it("soma o mensal e o anual dividido por 12 pelo preço contratado, com a configuração como reserva", () => {
    const r = mrrEstimado(
      [
        { status: SubscriptionStatus.ACTIVE, plan: SubscriptionPlan.MONTHLY, precoContratadoCentavos: 3790 },
        { status: SubscriptionStatus.ACTIVE, plan: SubscriptionPlan.ANNUAL, precoContratadoCentavos: null },
        { status: SubscriptionStatus.TRIALING, plan: null },
        { status: SubscriptionStatus.CANCELED, plan: SubscriptionPlan.MONTHLY, precoContratadoCentavos: 3790 },
      ],
      { mensalCentavos: 4990, anualCentavos: 38970 }
    );
    expect(r.mrr).toBeCloseTo(37.9 + 389.7 / 12, 2);
  });
});
