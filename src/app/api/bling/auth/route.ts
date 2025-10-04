import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";

/**
 * GET /api/bling/auth
 * Retorna contas Bling do usuário ou inicia fluxo OAuth
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Ação: Listar contas
    if (action === "accounts") {
      const user = await verifyUser(request);

      const accounts = await prisma.blingAccount.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(accounts);
    }

    // Ação: Iniciar OAuth
    if (action === "connect") {
      const user = await verifyUser(request);

      // Gerar state único para segurança
      const state = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Salvar state temporário (opcional, para validação)
      // Você pode salvar em Redis ou sessão se quiser validar depois

      const authUrl = BlingService.getAuthorizationUrl(state);

      return NextResponse.json({
        authUrl,
        state
      });
    }

    return NextResponse.json(
      { error: "Ação inválida" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erro na autenticação Bling:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bling/auth?accountId=xxx
 * Desconecta uma conta Bling
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
    const account = await prisma.blingAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    // Deletar conta
    await prisma.blingAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      success: true,
      message: "Conta Bling desconectada com sucesso"
    });
  } catch (error) {
    console.error("Erro ao desconectar conta Bling:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
