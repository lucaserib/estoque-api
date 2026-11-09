import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { decidirIndicacao } from "@/modules/admin/indicacoesAdmin";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

const corpoSchema = z.object({ decisao: z.enum(["aprovar", "invalidar"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const corpo = await request.json().catch(() => ({}));
    const motivo = exigirMotivo(corpo?.motivo);
    const lido = corpoSchema.safeParse(corpo);
    if (!lido.success) return NextResponse.json({ error: "Decisão inválida" }, { status: 400 });
    const { resultado, auditoria } = await decidirIndicacao((await params).id, lido.data.decisao, { adminEmail: admin.email, motivo });
    await auditar({ ...auditoria, adminEmail: admin.email, motivo, ip: ipDoAdmin(request.headers) });
    return NextResponse.json(resultado);
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao decidir a indicação");
  }
}
