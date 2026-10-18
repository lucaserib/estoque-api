import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import {
  obterStatusCatalogo,
  sincronizarCatalogoSeNecessario,
} from "@/modules/catalogo/sincronizacao";

export const maxDuration = 60;

const ORCAMENTO_MS = 45000;

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    return NextResponse.json(await obterStatusCatalogo(user.contaId));
  } catch (error) {
    console.error("[CATALOGO] Erro ao obter status:", error);
    return NextResponse.json({ error: "Erro ao obter status da sincronização" }, { status: 500 });
  }
}

interface RequestBody {
  forcar?: boolean;
}

/**
 * Avança a sincronização de catálogo e estoque (Bling + Mercado Livre).
 * Sem `forcar`, só começa uma rodada nova se a última tiver mais de 6 h; com
 * uma rodada em andamento, continua de onde parou. A tela chama em sequência
 * enquanto `emAndamento` for true.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBody = await request.json().catch(() => ({}));
    const status = await sincronizarCatalogoSeNecessario(user.contaId, ORCAMENTO_MS, { forcar: body.forcar === true });
    return NextResponse.json(status);
  } catch (error) {
    console.error("[CATALOGO] Erro ao sincronizar:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar catálogo e estoque" },
      { status: 500 }
    );
  }
}
