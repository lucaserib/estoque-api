import { describe, it, expect } from "vitest";
import { calcularMargemUnitaria } from "@/lib/margem";

describe("calcularMargemUnitaria", () => {
  it("calcula margem completa sem imposto", () => {
    const resultado = calcularMargemUnitaria({
      precoVenda: 10000,
      tarifa: 1200,
      frete: 1000,
      custo: 5000,
    });

    expect(resultado.completo).toBe(true);
    expect(resultado.faltando).toEqual([]);
    expect(resultado.margemValor).toBe(10000 - 1200 - 1000 - 5000);
    expect(resultado.margemPercentual).toBeCloseTo(0.28, 5);
  });

  it("aplica a alíquota de imposto sobre o preço de venda", () => {
    const resultado = calcularMargemUnitaria({
      precoVenda: 10000,
      tarifa: 1200,
      frete: 1000,
      custo: 5000,
      aliquotaImposto: 0.06,
    });

    expect(resultado.margemValor).toBe(10000 - 1200 - 1000 - 5000 - 600);
  });

  it("trata aliquotaImposto ausente como 0", () => {
    const comZero = calcularMargemUnitaria({
      precoVenda: 10000,
      tarifa: 1200,
      frete: 1000,
      custo: 5000,
      aliquotaImposto: 0,
    });
    const semCampo = calcularMargemUnitaria({
      precoVenda: 10000,
      tarifa: 1200,
      frete: 1000,
      custo: 5000,
    });

    expect(semCampo.margemValor).toBe(comZero.margemValor);
  });

  it("marca incompleto e lista o que falta quando custo é nulo", () => {
    const resultado = calcularMargemUnitaria({
      precoVenda: 10000,
      tarifa: 1200,
      frete: 1000,
      custo: null,
    });

    expect(resultado.completo).toBe(false);
    expect(resultado.margemValor).toBeNull();
    expect(resultado.margemPercentual).toBeNull();
    expect(resultado.faltando).toEqual(["custo"]);
  });

  it("lista múltiplos campos faltando", () => {
    const resultado = calcularMargemUnitaria({
      precoVenda: undefined,
      tarifa: null,
      frete: 500,
      custo: 5000,
    });

    expect(resultado.completo).toBe(false);
    expect(resultado.faltando).toEqual(["precoVenda", "tarifa"]);
  });

  it("não divide por zero quando precoVenda é 0", () => {
    const resultado = calcularMargemUnitaria({
      precoVenda: 0,
      tarifa: 0,
      frete: 0,
      custo: 100,
    });

    expect(resultado.completo).toBe(true);
    expect(resultado.margemValor).toBe(-100);
    expect(resultado.margemPercentual).toBe(0);
  });
});
