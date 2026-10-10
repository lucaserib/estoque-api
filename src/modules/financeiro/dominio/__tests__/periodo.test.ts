import { describe, it, expect } from "vitest";
import {
  inicioDoDia,
  fimDoDia,
  inicioDaSemana,
  fimDaSemana,
  inicioDoMes,
  fimDoMes,
  competenciaDe,
} from "../periodo";

describe("inicioDoDia / fimDoDia", () => {
  it("23h50 em Brasília pertence àquele dia, não ao dia seguinte em UTC", () => {
    const instante = new Date("2026-03-16T02:50:00.000Z"); // 2026-03-15 23:50 em SP

    expect(inicioDoDia(instante).toISOString()).toBe("2026-03-15T03:00:00.000Z");
    expect(fimDoDia(instante).toISOString()).toBe("2026-03-16T02:59:59.999Z");
  });

  it("início e fim do mesmo dia diferem por exatamente 1 dia menos 1ms", () => {
    const instante = new Date("2026-06-10T12:00:00.000Z");
    const diferencaMs = fimDoDia(instante).getTime() - inicioDoDia(instante).getTime();

    expect(diferencaMs).toBe(24 * 60 * 60 * 1000 - 1);
  });
});

describe("inicioDaSemana / fimDaSemana", () => {
  it("semana começa na segunda-feira e termina no domingo, mesmo fuso SP", () => {
    const quarta = new Date("2026-03-18T15:00:00.000Z"); // quarta-feira, 12h em SP

    expect(inicioDaSemana(quarta).toISOString()).toBe("2026-03-16T03:00:00.000Z"); // segunda 00h SP
    expect(fimDaSemana(quarta).toISOString()).toBe("2026-03-23T02:59:59.999Z"); // domingo 23:59:59.999 SP
  });

  it("uma segunda-feira é o início da própria semana", () => {
    const segunda = new Date("2026-03-16T13:00:00.000Z");

    expect(inicioDaSemana(segunda).toISOString()).toBe("2026-03-16T03:00:00.000Z");
  });

  it("um domingo pertence à semana que termina nele, não à próxima", () => {
    const domingo = new Date("2026-03-22T13:00:00.000Z");

    expect(inicioDaSemana(domingo).toISOString()).toBe("2026-03-16T03:00:00.000Z");
    expect(fimDaSemana(domingo).toISOString()).toBe("2026-03-23T02:59:59.999Z");
  });
});

describe("inicioDoMes / fimDoMes", () => {
  it("cobre o mês inteiro em SP, incluindo a virada de ano", () => {
    const meioDeMarco = new Date("2026-03-18T15:00:00.000Z");

    expect(inicioDoMes(meioDeMarco).toISOString()).toBe("2026-03-01T03:00:00.000Z");
    expect(fimDoMes(meioDeMarco).toISOString()).toBe("2026-04-01T02:59:59.999Z");
  });

  it("dezembro vira para janeiro do ano seguinte", () => {
    const dezembro = new Date("2026-12-15T15:00:00.000Z");

    expect(fimDoMes(dezembro).toISOString()).toBe("2027-01-01T02:59:59.999Z");
  });
});

describe("competenciaDe", () => {
  it("usa o mês civil de SP, não o de UTC, perto da virada do mês", () => {
    const instante = new Date("2026-04-01T01:00:00.000Z"); // 2026-03-31 22:00 em SP

    expect(competenciaDe(instante)).toEqual({ ano: 2026, mes: 3 });
  });

  it("em condições normais, usa o mês corrente", () => {
    const instante = new Date("2026-03-18T15:00:00.000Z");

    expect(competenciaDe(instante)).toEqual({ ano: 2026, mes: 3 });
  });
});
