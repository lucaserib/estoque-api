import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { saldoCreditos } from "@/modules/ia/creditos";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await verifyUser(request);
    const { id } = await params;
    const compra = await prisma.compraCreditoIa.findFirst({
      where: { id, contaId: usuario.contaId },
      select: { id: true, status: true, perguntas: true, pacoteNome: true, precoCentavos: true, aprovadaEm: true },
    });
    if (!compra) return NextResponse.json({ error: "Compra não encontrada" }, { status: 404 });
    return NextResponse.json({ compra, saldo: await saldoCreditos(usuario.contaId) });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}
