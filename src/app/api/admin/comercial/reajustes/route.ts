import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroAdmin, respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";
import { ReajusteInvalidoError, agendarReajuste, contarAfetados } from "@/modules/comercial/reajuste";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const p = request.nextUrl.searchParams;
    const plano = p.get("plano");
    const preco = Number(p.get("preco"));
    const afetados =
      (plano === "MONTHLY" || plano === "ANNUAL") && Number.isInteger(preco) && preco > 0 ? await contarAfetados(plano, preco) : null;
    const reajustes = await prisma.reajusteAssinatura.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({ reajustes, afetados });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar reajustes");
  }
}

const corpoSchema = z.object({
  plano: z.enum(["MONTHLY", "ANNUAL"]),
  novoPrecoCentavos: z.number().int().positive(),
  aplicarEm: z.string().datetime(),
  motivoCliente: z.string().trim().min(10).max(600),
  motivo: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const lido = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!lido.success) return NextResponse.json({ error: lido.error.issues[0].message }, { status: 400 });
    const motivo = exigirMotivo(lido.data.motivo);
    try {
      const reajuste = await agendarReajuste(
        { plano: lido.data.plano, novoPrecoCentavos: lido.data.novoPrecoCentavos, aplicarEm: new Date(lido.data.aplicarEm), motivo: lido.data.motivoCliente },
        admin.email
      );
      await auditar({ adminEmail: admin.email, acao: "REAJUSTE_AGENDADO", alvoTipo: "REAJUSTE", alvoId: reajuste.id, depois: reajuste, motivo, ip: ipDoAdmin(request.headers) });
      return NextResponse.json({ reajuste }, { status: 201 });
    } catch (error) {
      if (error instanceof ReajusteInvalidoError) throw new ErroAdmin(error.message);
      throw error;
    }
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao agendar o reajuste");
  }
}
