import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { obterAcessoIa } from "@/modules/ia/acesso";
import { criarAssinaturaDaConta } from "@/modules/conta/situacao";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";

const corpoSchema = z
  .object({
    liberadaManual: z.boolean().optional(),
    orcamentoCentavos: z.number().int().min(0).max(1_000_000).nullable().optional(),
    motivo: z.string().optional(),
  })
  .refine((c) => c.liberadaManual !== undefined || c.orcamentoCentavos !== undefined, {
    message: "Informe liberadaManual e/ou orcamentoCentavos",
  });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const { id } = await params;
    const parsed = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const motivo = exigirMotivo(parsed.data.motivo);

    const dono = await prisma.user.findFirst({ where: { id, contaId: null }, select: { id: true } });
    if (!dono) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

    const antes = await criarAssinaturaDaConta(id);
    const { liberadaManual, orcamentoCentavos } = parsed.data;
    const dados = {
      ...(liberadaManual !== undefined && {
        iaLiberadaManual: liberadaManual,
        ...(liberadaManual && { iaAtivadaEm: new Date() }),
      }),
      ...(orcamentoCentavos !== undefined && { iaOrcamentoCentavos: orcamentoCentavos }),
    };
    await prisma.subscription.update({ where: { userId: id }, data: dados });
    await auditar({
      adminEmail: admin.email,
      acao: "IA_ACESSO_ALTERADO",
      alvoTipo: "CONTA",
      alvoId: id,
      antes: { iaLiberadaManual: antes.iaLiberadaManual, iaOrcamentoCentavos: antes.iaOrcamentoCentavos },
      depois: dados,
      motivo,
      ip: ipDoAdmin(request.headers),
    });

    const acesso = await obterAcessoIa(id);
    return NextResponse.json({ acesso });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao alterar a IA da conta");
  }
}
