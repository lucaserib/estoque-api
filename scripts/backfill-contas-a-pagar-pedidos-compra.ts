import { PrismaClient } from "@prisma/client";
import { gerarContaAPagarDePedidoCompra } from "../src/modules/financeiro/lancamentos/pedidoCompra";

const prisma = new PrismaClient();
const DIAS = 90;

async function main() {
  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);

  const pedidos = await prisma.pedidoCompra.findMany({
    where: { status: "confirmado", dataConclusao: { gte: desde } },
    select: { id: true, userId: true, dataConclusao: true },
  });

  let gerados = 0;
  for (const pedido of pedidos) {
    const config = await prisma.configuracaoGeral.findUnique({
      where: { userId: pedido.userId },
      select: { prazoPagamentoPadraoDias: true },
    });
    const prazoDias = config?.prazoPagamentoPadraoDias ?? 30;
    const owner = await prisma.user.findUnique({ where: { id: pedido.userId }, select: { id: true } });
    if (!owner) continue;

    const vencimento = new Date(
      (pedido.dataConclusao ?? new Date()).getTime() + prazoDias * 24 * 60 * 60 * 1000
    );

    try {
      await gerarContaAPagarDePedidoCompra(pedido.userId, owner.id, pedido.id, { vencimento });
      gerados++;
    } catch (erro) {
      console.error(`Erro ao gerar conta a pagar do pedido ${pedido.id}:`, erro);
    }
  }

  console.log(`Pedidos processados: ${pedidos.length}. Contas a pagar geradas/confirmadas: ${gerados}.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
