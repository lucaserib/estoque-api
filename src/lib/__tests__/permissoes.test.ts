import { describe, it, expect } from "vitest";
import { podeEditar, podeVer, exigirPermissao, SemPermissaoError } from "@/lib/permissoes";

describe("permissoes", () => {
  it("ADMIN pode ver e editar custo", () => {
    expect(podeVer("ADMIN", "VER_CUSTO")).toBe(true);
    expect(podeEditar("ADMIN", "VER_CUSTO")).toBe(true);
  });

  it("VENDAS não vê nem edita custo", () => {
    expect(podeVer("VENDAS", "VER_CUSTO")).toBe(false);
    expect(podeEditar("VENDAS", "VER_CUSTO")).toBe(false);
  });

  it("ESTOQUE só vê pedidos de compra, não edita", () => {
    expect(podeVer("ESTOQUE", "PEDIDOS_COMPRA_VER")).toBe(true);
    expect(podeEditar("ESTOQUE", "PEDIDOS_COMPRA_VER")).toBe(false);
  });

  it("ESTOQUE pode ajustar estoque, COMPRAS não pode", () => {
    expect(podeEditar("ESTOQUE", "ESTOQUE_AJUSTAR")).toBe(true);
    expect(podeEditar("COMPRAS", "ESTOQUE_AJUSTAR")).toBe(false);
  });

  it("apenas ADMIN gerencia integrações/usuários/assinatura", () => {
    for (const papel of ["COMPRAS", "ESTOQUE", "VENDAS", "LEITURA"] as const) {
      expect(podeEditar(papel, "INTEGRACOES_USUARIOS_ASSINATURA")).toBe(false);
    }
    expect(podeEditar("ADMIN", "INTEGRACOES_USUARIOS_ASSINATURA")).toBe(true);
  });

  it("exigirPermissao lança SemPermissaoError quando o papel não pode", () => {
    expect(() => exigirPermissao("VENDAS", "EDITAR_PRODUTO")).toThrow(SemPermissaoError);
  });

  it("exigirPermissao não lança quando o papel pode", () => {
    expect(() => exigirPermissao("COMPRAS", "EDITAR_PRODUTO")).not.toThrow();
  });
});
