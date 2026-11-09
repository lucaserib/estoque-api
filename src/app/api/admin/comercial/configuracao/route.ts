import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";
import { listarVersoesConfiguracao, obterConfiguracaoComercial, salvarConfiguracaoComercial } from "@/modules/comercial/configuracao";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const [atual, versoes] = await Promise.all([obterConfiguracaoComercial(), listarVersoesConfiguracao(30)]);
    return NextResponse.json({ atual, versoes });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao ler a configuração comercial");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const corpo = await request.json().catch(() => ({}));
    const motivo = exigirMotivo(corpo?.motivo);
    const antes = await obterConfiguracaoComercial();
    const nova = await salvarConfiguracaoComercial(corpo?.configuracao, admin.email, motivo);
    await auditar({
      adminEmail: admin.email,
      acao: "CONFIGURACAO_COMERCIAL_SALVA",
      alvoTipo: "CONFIGURACAO_COMERCIAL",
      alvoId: String(nova.versao),
      antes,
      depois: nova,
      motivo,
      ip: ipDoAdmin(request.headers),
    });
    return NextResponse.json({ configuracao: nova });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao salvar a configuração comercial");
  }
}
