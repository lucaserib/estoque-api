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
