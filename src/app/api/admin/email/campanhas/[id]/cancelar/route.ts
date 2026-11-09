import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const motivo = exigirMotivo((await request.json().catch(() => ({})))?.motivo);
    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    if (!["AGENDADA", "ENVIANDO"].includes(campanha.status)) {
      return NextResponse.json({ error: "Só dá para cancelar campanhas agendadas ou em envio." }, { status: 409 });
    }
    const [atualizada, naFila] = await prisma.$transaction([
      prisma.campanha.update({ where: { id }, data: { status: "CANCELADA" } }),
      prisma.emailEnviado.updateMany({
        where: { campanhaId: id, status: "ENFILEIRADO" },
        data: { status: "SUPRIMIDO", erro: "Campanha cancelada" },
      }),
    ]);
    await auditar({
      adminEmail: admin.email,
      acao: "CAMPANHA_CANCELADA",
      alvoTipo: "CAMPANHA",
      alvoId: id,
      antes: { status: campanha.status },
      depois: { status: atualizada.status, retiradosDaFila: naFila.count },
      motivo,
      ip: ipDoAdmin(request.headers),
    });
    return NextResponse.json({ status: atualizada.status, retiradosDaFila: naFila.count });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao cancelar a campanha");
  }
}
