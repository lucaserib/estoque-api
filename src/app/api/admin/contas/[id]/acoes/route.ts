import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { acaoContaSchema, executarAcaoConta } from "@/modules/admin/acoesConta";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const corpo = await request.json().catch(() => ({}));
    const motivo = exigirMotivo(corpo?.motivo);
    const acao = acaoContaSchema.safeParse(corpo);
    if (!acao.success) return NextResponse.json({ error: acao.error.issues[0].message }, { status: 400 });

    const { resultado, auditoria } = await executarAcaoConta((await params).id, acao.data, { motivo });
    await auditar({ ...auditoria, adminEmail: admin.email, motivo, ip: ipDoAdmin(request.headers) });
    return NextResponse.json(resultado);
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao executar a ação na conta");
  }
}
