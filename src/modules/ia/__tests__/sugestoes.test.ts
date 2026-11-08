import { describe, expect, it } from "vitest";
import { sugestoesParaPagina } from "../sugestoes";

describe("sugestoesParaPagina", () => {
  it("na Reposição começa pelo que o diagnóstico de estoque aponta", () => {
    const s = sugestoesParaPagina("/reposicao", "ADMIN", [
      { id: "estoque-zerado-vendendo", area: "estoque" },
      { id: "dre-sem-imposto", area: "financeiro" },
    ]);
    expect(s).toHaveLength(4);
    expect(s[0]).toBe("Quais produtos vendem e estão sem estoque?");
    expect(s).toContain("O que preciso comprar esta semana?");
    expect(s.join(" ")).not.toContain("DRE");
  });

  it("no Financeiro sugere margem e no Anúncios sugere perda de venda", () => {
    expect(sugestoesParaPagina("/financeiro/dre", "ADMIN")).toContain("Por que minha margem caiu este mês?");
    expect(sugestoesParaPagina("/mercado-livre", "ADMIN")).toContain("Quais anúncios estão perdendo venda?");
  });

  it("não sugere o que o papel não pode ver", () => {
    const vendas = sugestoesParaPagina("/financeiro", "VENDAS");
    expect(vendas.join(" ")).not.toMatch(/margem|lucro|faturei/i);
    expect(vendas.length).toBeGreaterThan(0);
    const leitura = sugestoesParaPagina("/reposicao", "LEITURA", [{ id: "estoque-parado", area: "estoque" }]);
    expect(leitura).not.toContain("Onde tenho dinheiro parado em estoque?");
  });
});
