import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";
import { obterAutomacao } from "@/modules/email/automacoes";

const corpoSchema = z.object({
  ativo: z.boolean(),
  atrasoHoras: z.number().int().min(0).max(24 * 60),
  assunto: z.string().trim().min(1).max(150),
  preCabecalho: z.string().trim().max(200),
  corpoMarkdown: z.string().trim().min(1).max(8000),
  rotuloBotao: z.string().trim().max(60).nullable(),
  urlBotao: z.string().trim().max(300).nullable(),
  cupomCodigo: z.string().trim().max(40).nullable(),
  motivo: z.string().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ chave: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { chave } = await params;
    const corpo = await request.json().catch(() => ({}));
    const motivo = exigirMotivo(corpo?.motivo);
    const lido = corpoSchema.safeParse(corpo);
    if (!lido.success) return NextResponse.json({ error: lido.error.issues[0].message }, { status: 400 });

    const antes = await obterAutomacao(chave);
    if (!antes) return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });
    const { ativo, atrasoHoras, assunto, preCabecalho, corpoMarkdown, rotuloBotao, urlBotao, cupomCodigo } = lido.data;
    const dados = { ativo, atrasoHoras, assunto, preCabecalho, corpoMarkdown, rotuloBotao, urlBotao, cupomCodigo };
    const depois = await prisma.automacaoEmail.update({
      where: { chave },
      data: { ...dados, rotuloBotao: dados.rotuloBotao || null, urlBotao: dados.urlBotao || null, cupomCodigo: dados.cupomCodigo?.toUpperCase() || null, atualizadoPor: admin.email },
    });
    await auditar({
      adminEmail: admin.email,
      acao: "AUTOMACAO_ALTERADA",
      alvoTipo: "AUTOMACAO_EMAIL",
      alvoId: chave,
      antes,
      depois,
      motivo,
      ip: ipDoAdmin(request.headers),
    });
    return NextResponse.json({ automacao: depois });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao salvar a automação");
  }
}
