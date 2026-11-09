import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const p = request.nextUrl.searchParams;
    const registros = await prisma.auditoriaAdmin.findMany({
      where: {
        ...(p.get("admin") ? { adminEmail: { contains: p.get("admin")!.toLowerCase() } } : {}),
        ...(p.get("acao") ? { acao: { contains: p.get("acao")!.toUpperCase() } } : {}),
        ...(p.get("alvoTipo") ? { alvoTipo: p.get("alvoTipo")! } : {}),
        ...(p.get("alvoId") ? { alvoId: p.get("alvoId")! } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json({ registros });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar a auditoria");
  }
}
