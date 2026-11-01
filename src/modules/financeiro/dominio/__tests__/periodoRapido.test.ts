import { describe, it, expect } from "vitest";
import { resolverPeriodoRapido } from "../periodo";

// 19/10/2026 08:34 em São Paulo
const AGORA = new Date("2026-10-19T11:34:00.000Z");

describe("resolverPeriodoRapido", () => {
  it("padrão é o mês atual, do dia 1 (fuso de SP) até agora", () => {
    const p = resolverPeriodoRapido(null, AGORA);
    expect(p.chave).toBe("mes-atual");
    expect(p.desde.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(p.ate.toISOString()).toBe(AGORA.toISOString());
  });

  it("mês atual compara com o mesmo trecho do mês anterior, não com o mês inteiro", () => {
    const p = resolverPeriodoRapido("mes-atual", AGORA);
    expect(p.anteriorDesde.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    // 18 dias e 8h34 depois do dia 1 de setembro
    expect(p.anteriorAte.toISOString()).toBe("2026-09-19T11:34:00.000Z");
  });

  it("mês atual no dia 31 não invade o mês corrente na comparação (mês anterior mais curto)", () => {
    const p = resolverPeriodoRapido("mes-atual", new Date("2026-03-31T20:00:00.000Z"));
    expect(p.anteriorDesde.toISOString()).toBe("2026-02-01T03:00:00.000Z");
    expect(p.anteriorAte.getTime()).toBe(p.desde.getTime() - 1);
  });

  it("mês anterior cobre o mês fechado inteiro e compara com o retrasado", () => {
    const p = resolverPeriodoRapido("mes-anterior", AGORA);
    expect(p.desde.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(p.ate.toISOString()).toBe("2026-10-01T02:59:59.999Z");
    expect(p.anteriorDesde.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(p.anteriorAte.toISOString()).toBe("2026-09-01T02:59:59.999Z");
    expect(p.dias).toBe(30);
  });

  it("janelas em dias continuam limitadas entre 7 e 90", () => {
    expect(resolverPeriodoRapido("500", AGORA).dias).toBe(90);
    expect(resolverPeriodoRapido("2", AGORA).dias).toBe(7);
    expect(resolverPeriodoRapido("30", AGORA).rotulo).toBe("Últimos 30 dias");
  });

  it("chave desconhecida cai em 30 dias", () => {
    expect(resolverPeriodoRapido("abc", AGORA).dias).toBe(30);
  });
});

describe("formatarDataHoraBrasilia", () => {
  it("formata no horário de Brasília, não em UTC (filtro do Bling)", async () => {
    const { formatarDataHoraBrasilia } = await import("../periodo");
    expect(formatarDataHoraBrasilia(new Date("2026-10-19T11:34:05.000Z"))).toBe("2026-10-19 08:34:05");
    expect(formatarDataHoraBrasilia(new Date("2026-10-01T01:00:00.000Z"))).toBe("2026-09-30 22:00:00");
  });
});
