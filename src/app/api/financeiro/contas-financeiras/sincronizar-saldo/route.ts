import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { sincronizarSaldoMercadoPago } from "@/modules/financeiro/canais/mercadoPago/saldo";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const contas = await prisma.mercadoLivreAccount.findMany({
      where: { userId: user.contaId, isActive: true },
      select: { id: true },
    });

    let sincronizadas = 0;
    for (const conta of contas) {
      await sincronizarSaldoMercadoPago(conta.id);
      sincronizadas++;
    }

    return NextResponse.json({ sincronizadas });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao sincronizar saldo das contas do Mercado Pago:", error);
    return NextResponse.json({ error: "Erro ao sincronizar saldo" }, { status: 500 });
  }
}
