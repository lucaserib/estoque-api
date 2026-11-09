import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { acaoUsuarioSchema, executarAcaoUsuario } from "@/modules/admin/usuarios";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const corpo = await request.json().catch(() => ({}));
    const motivo = exigirMotivo(corpo?.motivo);
    const acao = acaoUsuarioSchema.safeParse(corpo);
    if (!acao.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

    const ip = ipDoAdmin(request.headers);
    const { resultado, auditoria } = await executarAcaoUsuario((await params).id, acao.data.acao, { motivo, ip });
    await auditar({ ...auditoria, adminEmail: admin.email, motivo, ip });
    return NextResponse.json(resultado);
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao executar a ação no usuário");
  }
}
