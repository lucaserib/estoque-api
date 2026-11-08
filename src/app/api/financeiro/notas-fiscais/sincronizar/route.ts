import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { sincronizarNotasFiscais } from "@/modules/financeiro/canais/erp/bling/notasFiscais";
import { resolverPeriodoRapido } from "@/modules/financeiro/dominio/periodo";
import { BlingEscopoError, BlingReconnectError } from "@/services/blingService";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const limite = await checkRateLimit("notas-fiscais", user.contaId, 6, 60);
    if (!limite.allowed) return rateLimitResponse(limite);

    const corpo = await request.json().catch(() => ({}));
    const desdeInformado = typeof corpo.desde === "string" ? new Date(corpo.desde) : null;
    const ateInformado = typeof corpo.ate === "string" ? new Date(corpo.ate) : null;
    const intervalo =
      desdeInformado && ateInformado && !Number.isNaN(desdeInformado.getTime()) && !Number.isNaN(ateInformado.getTime())
        ? { desde: desdeInformado, ate: ateInformado < new Date() ? ateInformado : new Date() }
        : resolverPeriodoRapido(typeof corpo.periodo === "string" ? corpo.periodo : "mes-atual");
    const resultado = await sincronizarNotasFiscais(user.contaId, intervalo.desde, intervalo.ate, 45000);

    if (!resultado.conectado) {
      return NextResponse.json(
        { ...resultado, error: "Conecte o Bling para trazer as notas fiscais." },
        { status: 409 }
      );
    }
    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof BlingEscopoError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    }
    if (error instanceof BlingReconnectError) {
      return NextResponse.json({ error: "Reconecte o Bling em Integrações.", code: "BLING_RECONNECT_REQUIRED" }, { status: 401 });
    }
    console.error("Erro ao sincronizar notas fiscais:", error);
    return NextResponse.json({ error: "Erro ao sincronizar notas fiscais" }, { status: 500 });
  }
}
