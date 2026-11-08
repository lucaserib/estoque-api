import { describe, it, expect, vi, beforeEach } from "vitest";

const contas = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { blingAccount: contas } }));

import {
  extrairBlingProdutoId,
  localizarContaDoWebhook,
  normalizarCompanyId,
} from "@/services/blingWebhookProcessor";
import { BlingService, companyIdDoJwt } from "@/services/blingService";

function jwtCom(claims: Record<string, unknown>): string {
  const parte = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString("base64url");
  return `${parte({ alg: "HS256" })}.${parte(claims)}.assinatura`;
}

describe("companyIdDoJwt", () => {
  it("lê company_id numérico do token JWT do Bling", () => {
    expect(companyIdDoJwt(jwtCom({ company_id: 14880421763, app_id: "1" }))).toBe("14880421763");
  });

  it("devolve null para token opaco ou sem company_id", () => {
    expect(companyIdDoJwt("token-opaco")).toBeNull();
    expect(companyIdDoJwt(jwtCom({ sub: "x" }))).toBeNull();
    expect(companyIdDoJwt("a.!!!.c")).toBeNull();
  });
});

describe("normalizarCompanyId", () => {
  it("aceita número ou texto e rejeita vazio", () => {
    expect(normalizarCompanyId(14880421763)).toBe("14880421763");
    expect(normalizarCompanyId(" abc ")).toBe("abc");
    expect(normalizarCompanyId("")).toBeNull();
    expect(normalizarCompanyId(undefined)).toBeNull();
  });
});

describe("localizarContaDoWebhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    contas.findFirst.mockReset();
    contas.findMany.mockReset();
    contas.update.mockReset();
    contas.update.mockImplementation(async ({ where, data }) => ({ id: where.id, userId: "dono", ...data }));
  });

  it("usa a conta que já tem a empresa identificada", async () => {
    contas.findFirst.mockResolvedValue({ id: "conta-1", userId: "dono", blingCompanyId: "777" });

    const conta = await localizarContaDoWebhook(777, "10");

    expect(conta?.id).toBe("conta-1");
    expect(contas.findFirst).toHaveBeenCalledWith({ where: { blingCompanyId: "777", isActive: true } });
    expect(contas.findMany).not.toHaveBeenCalled();
  });

  it("identifica a empresa pelo company_id do token e grava o companyId do webhook", async () => {
    contas.findFirst.mockResolvedValue(null);
    contas.findMany.mockResolvedValue([{ id: "conta-a" }, { id: "conta-b" }]);
    vi.spyOn(BlingService, "companyIdDoToken").mockImplementation(async (id) => (id === "conta-b" ? "777" : "999"));
    const produto = vi.spyOn(BlingService, "produtoPertenceAConta").mockResolvedValue(false);

    const conta = await localizarContaDoWebhook("777", null);

    expect(conta?.id).toBe("conta-b");
    expect(contas.update).toHaveBeenCalledWith({ where: { id: "conta-b" }, data: { blingCompanyId: "777" } });
    expect(produto).not.toHaveBeenCalled();
  });

  it("identifica pela posse do produto quando o token não traz a mesma empresa", async () => {
    contas.findFirst.mockResolvedValue(null);
    contas.findMany.mockResolvedValue([{ id: "conta-a" }, { id: "conta-b" }]);
    vi.spyOn(BlingService, "companyIdDoToken").mockResolvedValue("123");
    vi.spyOn(BlingService, "produtoPertenceAConta").mockImplementation(async (id) => id === "conta-a");

    const conta = await localizarContaDoWebhook("d4475854366a36c86a370a3e6e2f7f5d", "16081234567");

    expect(conta?.id).toBe("conta-a");
    expect(contas.update).toHaveBeenCalledWith({
      where: { id: "conta-a" },
      data: { blingCompanyId: "d4475854366a36c86a370a3e6e2f7f5d" },
    });
  });

  it("não vincula nada quando nenhuma conta prova ser da empresa", async () => {
    contas.findFirst.mockResolvedValue(null);
    contas.findMany.mockResolvedValue([{ id: "conta-a" }]);
    vi.spyOn(BlingService, "companyIdDoToken").mockResolvedValue(null);
    vi.spyOn(BlingService, "produtoPertenceAConta").mockResolvedValue(false);

    expect(await localizarContaDoWebhook("555", "1")).toBeNull();
    expect(contas.update).not.toHaveBeenCalled();
  });

  it("ignora webhook sem companyId", async () => {
    expect(await localizarContaDoWebhook(null, "1")).toBeNull();
    expect(contas.findFirst).not.toHaveBeenCalled();
  });
});

describe("extrairBlingProdutoId", () => {
  it("lê o id direto de data para eventos product.*", () => {
    expect(extrairBlingProdutoId("product.updated", { id: 123 })).toBe("123");
    expect(extrairBlingProdutoId("product.created", { id: "456" })).toBe("456");
  });

  it("retorna null quando product.* não tem id", () => {
    expect(extrairBlingProdutoId("product.deleted", {})).toBeNull();
  });

  it("lê produto.id para eventos de estoque", () => {
    expect(
      extrairBlingProdutoId("stock.updated", { produto: { id: 789 }, depositos: [] })
    ).toBe("789");
    expect(
      extrairBlingProdutoId("virtual_stock.updated", { produto: { id: 321 } })
    ).toBe("321");
  });

  it("aceita idProduto ou produtoId como alternativa para eventos não-product", () => {
    expect(extrairBlingProdutoId("product_supplier.updated", { idProduto: 111 })).toBe(
      "111"
    );
    expect(extrairBlingProdutoId("product_supplier.created", { produtoId: 222 })).toBe(
      "222"
    );
  });

  it("retorna null quando nenhum campo conhecido está presente", () => {
    expect(extrairBlingProdutoId("stock.updated", { algoInesperado: true })).toBeNull();
  });
});

describe("erroPermanenteBling", () => {
  it("404/400/422 do Bling e produto sem SKU fecham o evento; limite e rede não", async () => {
    const { erroPermanenteBling } = await import("@/services/blingWebhookProcessor");
    const { BlingApiError, BlingRateLimitError } = await import("@/services/blingService");
    expect(erroPermanenteBling(new BlingApiError(404, "/produtos/1", "não encontrado"))).toBe(true);
    expect(erroPermanenteBling(new BlingApiError(422, "/produtos/1", "inválido"))).toBe(true);
    expect(erroPermanenteBling(new Error("Produto Bling 1 sem SKU, ignorado"))).toBe(true);
    expect(erroPermanenteBling(new BlingApiError(500, "/produtos/1", "erro"))).toBe(false);
    expect(erroPermanenteBling(new BlingRateLimitError())).toBe(false);
    expect(erroPermanenteBling(new Error("fetch failed"))).toBe(false);
  });
});
