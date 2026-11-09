import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { estornarPagamentoDeCreditos } from "@/modules/admin/pagamentos";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const motivo = exigirMotivo((await request.json().catch(() => ({})))?.motivo);
    const { resultado, auditoria } = await estornarPagamentoDeCreditos((await params).id);
    await auditar({ ...auditoria, adminEmail: admin.email, motivo, ip: ipDoAdmin(request.headers) });
    return NextResponse.json(resultado);
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao estornar o pagamento");
  }
}
