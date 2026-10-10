import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularTodasPendencias } from "@/services/pendenciasService";
import { NotificationService } from "@/services/notificationService";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // "Conta" = usuário dono (contaId nulo); membros convidados compartilham
  // o mesmo conjunto de produtos via userId = contaId do dono.
  const contas = await prisma.user.findMany({
    where: { contaId: null },
    select: { id: true },
  });

  let contasNotificadas = 0;

  for (const conta of contas) {
    try {
      const pendencias = await calcularTodasPendencias(conta.id);
      const totalCriticas = pendencias.reduce(
        (sum, item) =>
          sum + item.pendencias.filter((p) => p.severidade === "critica").length,
        0
      );

      const config = await prisma.configuracaoGeral.findUnique({
        where: { userId: conta.id },
      });
      const contagemAnterior = config?.ultimaContagemPendenciasCriticas ?? 0;

      if (totalCriticas > contagemAnterior) {
        const usuariosComVerCusto = await prisma.user.findMany({
          where: {
            OR: [{ id: conta.id }, { contaId: conta.id }],
            role: { in: ["ADMIN", "COMPRAS"] },
          },
          select: { id: true },
        });

        for (const usuario of usuariosComVerCusto) {
          await NotificationService.notifyCadastroIncompleto(
            usuario.id,
            totalCriticas
          );
        }
        contasNotificadas++;
      }

      await prisma.configuracaoGeral.upsert({
        where: { userId: conta.id },
        update: { ultimaContagemPendenciasCriticas: totalCriticas },
        create: {
          userId: conta.id,
          ultimaContagemPendenciasCriticas: totalCriticas,
        },
      });
    } catch (error) {
      console.error(
        `[CRON_CADASTRO_INCOMPLETO] Erro ao processar conta ${conta.id}:`,
        error
      );
    }
  }

  return NextResponse.json({
    contasVerificadas: contas.length,
    contasNotificadas,
  });
}
