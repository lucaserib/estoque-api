import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const busca = request.nextUrl.searchParams.get("busca")?.trim();
    const supressoes = await prisma.supressaoEmail.findMany({
      where: busca ? { email: { contains: busca.toLowerCase() } } : {},
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json({ supressoes });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar supressões");
  }
}

const corpoSchema = z.object({ email: z.string().trim().email(), motivo: z.string().optional() });

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const corpo = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!corpo.success) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    const motivo = exigirMotivo(corpo.data.motivo);
    const email = corpo.data.email.toLowerCase();
    const supressao = await prisma.supressaoEmail.upsert({
      where: { email },
      update: { motivo: "MANUAL", detalhe: motivo },
      create: { email, motivo: "MANUAL", detalhe: motivo },
    });
    await auditar({ adminEmail: admin.email, acao: "SUPRESSAO_CRIADA", alvoTipo: "SUPRESSAO_EMAIL", alvoId: email, depois: supressao, motivo, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ supressao });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao suprimir o e-mail");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const corpo = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!corpo.success) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    const motivo = exigirMotivo(corpo.data.motivo);
    const email = corpo.data.email.toLowerCase();
    const antes = await prisma.supressaoEmail.findUnique({ where: { email } });
    if (!antes) return NextResponse.json({ error: "Esse e-mail não está suprimido" }, { status: 404 });
    if (antes.motivo !== "MANUAL") {
      return NextResponse.json({ error: "Só dá para remover supressões manuais. Devoluções e reclamações protegem a reputação de envio." }, { status: 409 });
    }
    await prisma.supressaoEmail.delete({ where: { email } });
    await auditar({ adminEmail: admin.email, acao: "SUPRESSAO_REMOVIDA", alvoTipo: "SUPRESSAO_EMAIL", alvoId: email, antes, motivo, ip: ipDoAdmin(request.headers) });
    return NextResponse.json({ removida: true });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao remover a supressão");
  }
}
