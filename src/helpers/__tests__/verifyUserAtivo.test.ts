import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.unmock("@/helpers/verifyUserAtivo");

const situacao = vi.hoisted(() => ({ obterSituacaoContaEmCache: vi.fn() }));
vi.mock("@/modules/conta/situacao", () => situacao);
vi.mock("@/helpers/verifyUser", async (importar) => ({
  ...(await importar<typeof import("@/helpers/verifyUser")>()),
  verifyUser: vi.fn(async () => ({ id: "membro-1", contaId: "dono-1", role: "ESTOQUE" })),
}));

import { verifyUserAtivo } from "../verifyUserAtivo";
import { sessaoAindaValida } from "../verifyUser";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { AssinaturaInativaError, UsuarioBloqueadoError } from "@/modules/conta/erros";

const requisicao = () => new NextRequest("https://app.skubo.test/api/produtos");

describe("verifyUserAtivo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("consulta a situação pela conta (dono), não pela pessoa logada", async () => {
    situacao.obterSituacaoContaEmCache.mockResolvedValue({ podeUsar: true, status: "ATIVA" });
    const usuario = await verifyUserAtivo(requisicao());
    expect(situacao.obterSituacaoContaEmCache).toHaveBeenCalledWith("dono-1");
    expect(usuario.situacao.status).toBe("ATIVA");
  });

  it("conta vencida vira 402 ASSINATURA_INATIVA", async () => {
    situacao.obterSituacaoContaEmCache.mockResolvedValue({ podeUsar: false, status: "VENCIDA" });
    const erro = await verifyUserAtivo(requisicao()).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(AssinaturaInativaError);
    const resposta = permissaoErrorResponse(erro)!;
    expect(resposta.status).toBe(402);
    expect(await resposta.json()).toMatchObject({ codigo: "ASSINATURA_INATIVA", status: "VENCIDA" });
  });

  it("usuário bloqueado vira 401", async () => {
    const resposta = permissaoErrorResponse(new UsuarioBloqueadoError())!;
    expect(resposta.status).toBe(401);
  });
});

describe("sessaoAindaValida", () => {
  const corte = new Date("2026-11-10T12:00:00.000Z");

  it("sem corte, toda sessão vale", () => {
    expect(sessaoAindaValida(undefined, null)).toBe(true);
  });

  it("token emitido antes da troca de senha ou da remoção cai", () => {
    expect(sessaoAindaValida(corte.getTime() - 1, corte)).toBe(false);
    expect(sessaoAindaValida(undefined, corte)).toBe(false);
    expect(sessaoAindaValida(corte.getTime() + 1, corte)).toBe(true);
  });
});
