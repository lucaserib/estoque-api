import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { ipDe } from "@/modules/conta/auditoria";
import { MOTIVOS_CANCELAMENTO, contaDoTokenPesquisa } from "@/modules/cobranca/pesquisa";

const corpoSchema = z.object({
  t: z.string().min(10).max(500),
  motivo: z.enum(["PRECO", "FALTOU_RECURSO", "DIFICIL", "PAROU_DE_VENDER", "OUTRA_FERRAMENTA", "OUTRO"]),
  comentario: z.string().trim().max(1000).optional(),
});

const JANELA_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const limite = await checkRateLimit("pesquisa-cancelamento", ipDe(request.headers) ?? "local", 30, 3600);
  if (!limite.allowed) return rateLimitResponse(limite);

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: "Resposta inválida" }, { status: 400 });
  const contaId = contaDoTokenPesquisa(corpo.data.t);
  if (!contaId) return NextResponse.json({ error: "Link inválido" }, { status: 400 });

  const recente = await prisma.motivoCancelamento.findFirst({
    where: { contaId, createdAt: { gte: new Date(Date.now() - JANELA_MS) } },
    orderBy: { createdAt: "desc" },
  });
  const dados = { motivo: corpo.data.motivo, comentario: corpo.data.comentario || recente?.comentario || null };
  const registro = recente
    ? await prisma.motivoCancelamento.update({ where: { id: recente.id }, data: dados })
    : await prisma.motivoCancelamento.create({ data: { contaId, ...dados } });

  return NextResponse.json({
    motivo: registro.motivo,
    rotulo: MOTIVOS_CANCELAMENTO.find((m) => m.motivo === registro.motivo)?.rotulo,
    comentario: registro.comentario,
  });
}
