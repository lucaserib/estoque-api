import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

const corpoSchema = z.object({
  ativo: z.boolean().optional(),
  usosMaximos: z.number().int().positive().nullable().optional(),
  validoAte: z.string().datetime().nullable().optional(),
  motivo: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const lido = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!lido.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    const motivo = exigirMotivo(lido.data.motivo);
    const antes = await prisma.cupom.findUnique({ where: { id } });
    if (!antes) return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });
    const depois = await prisma.cupom.update({
      where: { id },
      data: {
        ...(lido.data.ativo !== undefined ? { ativo: lido.data.ativo } : {}),
        ...(lido.data.usosMaximos !== undefined ? { usosMaximos: lido.data.usosMaximos } : {}),
        ...(lido.data.validoAte !== undefined ? { validoAte: lido.data.validoAte ? new Date(lido.data.validoAte) : null } : {}),
      },
    });
    await auditar({ adminEmail: admin.email, acao: "CUPOM_ALTERADO", alvoTipo: "CUPOM", alvoId: id, antes, depois, motivo, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ cupom: depois });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao alterar o cupom");
  }
}
