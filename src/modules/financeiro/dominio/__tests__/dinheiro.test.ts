import { describe, it, expect } from "vitest";
import { somar, ratear, formatar } from "../dinheiro";

describe("somar", () => {
  it("soma vários valores", () => {
    expect(somar(10, 20, 30)).toBe(60);
  });

  it("soma negativos", () => {
    expect(somar(-10, 5)).toBe(-5);
  });

  it("sem argumentos soma zero", () => {
    expect(somar()).toBe(0);
  });
});

describe("ratear", () => {
  it("divide sem perder centavo quando a divisão não é exata", () => {
    const partes = ratear(100, [1, 1, 1]);

    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(partes).toEqual([34, 33, 33]);
  });

  it("divide exatamente quando os pesos já fecham a conta", () => {
    expect(ratear(10, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it("peso maior recebe parte maior", () => {
    const partes = ratear(100, [1, 3]);

    expect(partes[1]).toBeGreaterThan(partes[0]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("funciona com total negativo (ex.: rateio de um cancelamento)", () => {
    const partes = ratear(-10, [1, 1, 1]);

    expect(partes.reduce((a, b) => a + b, 0)).toBe(-10);
    expect(partes).toEqual([-3, -3, -4]);
  });

  it("pesos todos zero cai para divisão igual em vez de zerar tudo", () => {
    const partes = ratear(50, [0, 0]);

    expect(partes).toEqual([25, 25]);
  });

  it("peso zero isolado (um item sem valor) não recebe nada, mas não quebra o rateio", () => {
    const partes = ratear(100, [0, 1, 1]);

    expect(partes[0]).toBe(0);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("lista vazia com total zero devolve lista vazia", () => {
    expect(ratear(0, [])).toEqual([]);
  });

  it("lista vazia com total diferente de zero não pode simplesmente perder o dinheiro", () => {
    expect(() => ratear(100, [])).toThrow();
  });

  it("um único destinatário recebe o total inteiro", () => {
    expect(ratear(100, [5])).toEqual([100]);
  });
});

describe("formatar", () => {
  // Intl.NumberFormat("pt-BR") usa espaço não separável (U+00A0) entre "R$" e o
  // número; normalizamos para espaço comum nas comparações abaixo.
  it("formata centavos como moeda brasileira", () => {
    const semEspacosEspeciais = formatar(123456).replace(/ /g, " ");
    expect(semEspacosEspeciais).toBe("R$ 1.234,56");
  });

  it("formata valor negativo", () => {
    const semEspacosEspeciais = formatar(-500).replace(/ /g, " ");
    expect(semEspacosEspeciais).toBe("-R$ 5,00");
  });

  it("formata zero", () => {
    const semEspacosEspeciais = formatar(0).replace(/ /g, " ");
    expect(semEspacosEspeciais).toBe("R$ 0,00");
  });
});
