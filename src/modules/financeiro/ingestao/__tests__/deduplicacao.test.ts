import { describe, it, expect } from "vitest";
import { CanalVenda } from "@prisma/client";
import { resolverOrigemCanonica, chaveCanonica } from "../deduplicacao";

describe("resolverOrigemCanonica", () => {
  it("sem origem declarada, o próprio pedido é a origem canônica", () => {
    const candidato = { canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "1" };
    expect(resolverOrigemCanonica(candidato)).toEqual(candidato);
  });

  it("um pedido do ERP que espelha um pedido do ML usa a origem do ML como canônica", () => {
    const doErp = { canal: CanalVenda.ERP, pedidoExternoId: "bling-999" };
    const origemMl = { canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "ml-123" };

    expect(resolverOrigemCanonica(doErp, origemMl)).toEqual(origemMl);
  });
});

describe("chaveCanonica", () => {
  it("duas entradas que resolvem para a mesma origem geram a mesma chave", () => {
    const origemMl = { canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "ml-123" };
    const doErp = { canal: CanalVenda.ERP, pedidoExternoId: "bling-999" };

    expect(chaveCanonica(resolverOrigemCanonica(doErp, origemMl))).toBe(chaveCanonica(origemMl));
  });

  it("origens diferentes geram chaves diferentes", () => {
    const a = { canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "1" };
    const b = { canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "2" };

    expect(chaveCanonica(a)).not.toBe(chaveCanonica(b));
  });
});
