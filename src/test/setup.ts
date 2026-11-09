import { vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/helpers/verifyUserAtivo", async () => {
  const { verifyUser } = await import("@/helpers/verifyUser");
  return {
    verifyUserAtivo: async (req: NextRequest) => {
      const usuario = await verifyUser(req);
      return {
        ...usuario,
        situacao: {
          contaId: usuario.contaId,
          status: "ATIVA",
          podeUsar: true,
          cobrancaObrigatoria: false,
          plano: null,
          testeTerminaEm: null,
          diasRestantesTeste: null,
          periodoTerminaEm: null,
          inativaDesde: null,
          diasDeCredito: 0,
          donoNome: null,
          donoEmail: null,
        },
      };
    },
  };
});
