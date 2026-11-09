import { prisma } from "@/lib/prisma";

export async function diasPendentesDaConta(contaId: string): Promise<number> {
  const soma = await prisma.creditoDiasAssinatura.aggregate({
    where: { contaId, forma: "PENDENTE" },
    _sum: { dias: true },
  });
  return soma._sum.dias ?? 0;
}

export async function semanasGanhasPorIndicacao(contaId: string): Promise<number> {
  const soma = await prisma.creditoDiasAssinatura.aggregate({
    where: { contaId, origem: "INDICACAO" },
    _sum: { dias: true },
  });
  return Math.floor((soma._sum.dias ?? 0) / 7);
}
