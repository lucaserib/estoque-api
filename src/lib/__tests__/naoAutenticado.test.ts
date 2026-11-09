import { describe, expect, it } from "vitest";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { NaoAutenticadoError, UsuarioBloqueadoError } from "@/modules/conta/erros";

describe("sem login nas rotas da API", () => {
  it("vira 401 com código próprio, sem cair no erro interno", async () => {
    const resposta = permissaoErrorResponse(new NaoAutenticadoError("Acesso não autorizado. Token ausente."));
    expect(resposta?.status).toBe(401);
    expect(await resposta?.json()).toMatchObject({ code: "NAO_AUTENTICADO", error: "Acesso não autorizado. Token ausente." });
  });

  it("usuário bloqueado continua 401 e erro comum continua sem tratamento", () => {
    expect(permissaoErrorResponse(new UsuarioBloqueadoError())?.status).toBe(401);
    expect(permissaoErrorResponse(new Error("qualquer"))).toBeNull();
  });
});
