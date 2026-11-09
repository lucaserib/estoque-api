import { NextRequest, NextResponse } from "next/server";
import { ErroAdmin, respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";
import { ReajusteInvalidoError, cancelarReajuste } from "@/modules/comercial/reajuste";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const motivo = exigirMotivo((await request.json().catch(() => ({})))?.motivo);
    try {
      const reajuste = await cancelarReajuste(id);
      await auditar({ adminEmail: admin.email, acao: "REAJUSTE_CANCELADO", alvoTipo: "REAJUSTE", alvoId: id, depois: reajuste, motivo, ip: ipDoAdmin(request.headers) });
      return NextResponse.json({ reajuste });
    } catch (error) {
      if (error instanceof ReajusteInvalidoError) throw new ErroAdmin(error.message);
      throw error;
    }
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao cancelar o reajuste");
  }
}
