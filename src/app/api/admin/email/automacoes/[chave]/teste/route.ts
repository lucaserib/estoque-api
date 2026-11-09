import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, ipDoAdmin } from "@/modules/admin/auditoria";
import { motivoDaCategoria, obterAutomacao, renderizarAutomacao, variaveisDaConta } from "@/modules/email/automacoes";
import { enviarEmail } from "@/modules/email/enviar";

export async function POST(request: NextRequest, { params }: { params: Promise<{ chave: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { chave } = await params;
    const automacao = await obterAutomacao(chave);
    if (!automacao) return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });
    const conteudo = renderizarAutomacao(automacao, {
      ...(await variaveisDaConta(admin.contaId, admin.id)),
      data_fim_teste: "21/11/2026",
      data_renovacao: "05/12/2026",
      valor: "R$ 389,70",
      dias: 7,
      indicado: "Lo** St***",
      pesquisa: "- [Ficou caro para mim](#)\n- [Faltou algum recurso](#)",
      forma: "Seu teste grátis foi estendido.",
    });
    const resultado = await enviarEmail({
      para: admin.email,
      modelo: "automacao",
      categoria: "TRANSACIONAL",
      dados: { ...conteudo, assunto: `[Teste] ${conteudo.assunto}`, motivo: motivoDaCategoria(automacao.categoria) },
      chaveIdempotencia: `teste-automacao:${chave}:${Date.now()}`,
      userId: admin.id,
      urgente: true,
    });
    await auditar({ adminEmail: admin.email, acao: "AUTOMACAO_TESTE_ENVIADO", alvoTipo: "AUTOMACAO_EMAIL", alvoId: chave, depois: resultado, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ resultado, previa: conteudo });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao enviar o teste");
  }
}
