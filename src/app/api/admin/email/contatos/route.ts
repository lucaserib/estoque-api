import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { lerPreferencias } from "@/modules/clientes/consentimento";
import { calcularSituacao, cobrancaObrigatoria } from "@/modules/conta/situacao";
import { paraCsv } from "@/modules/admin/pagamentos";
import { auditar, ipDoAdmin } from "@/modules/admin/auditoria";

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const agora = new Date();
    const [pessoas, suprimidos] = await Promise.all([
      prisma.user.findMany({
        where: { bloqueadoEm: null },
        select: {
          id: true,
          name: true,
          email: true,
          contaId: true,
          bloqueadoEm: true,
          preferencias: true,
          perfilCliente: { select: { whatsapp: true, testeInterno: true } },
          conta: { select: { perfilCliente: { select: { whatsapp: true, testeInterno: true } } } },
          subscription: true,
        },
      }),
      prisma.supressaoEmail.findMany({ select: { email: true } }),
    ]);
    const bloqueados = new Set(suprimidos.map((s) => s.email));
    const cobrar = cobrancaObrigatoria();
    const linhas = pessoas
      .filter((p) => !bloqueados.has(p.email.toLowerCase()))
      .map((p) => ({ pessoa: p, preferencias: lerPreferencias(p.preferencias) }))
      .filter(({ pessoa, preferencias }) => preferencias.marketingEmail && !(pessoa.perfilCliente ?? pessoa.conta?.perfilCliente)?.testeInterno)
      .map(({ pessoa, preferencias }) => {
        const perfil = pessoa.perfilCliente ?? pessoa.conta?.perfilCliente;
        const situacao = pessoa.contaId ? null : calcularSituacao(pessoa.id, pessoa.subscription, pessoa, agora, { cobrancaObrigatoria: cobrar });
        return [
          pessoa.email,
          preferencias.marketingWhatsapp ? perfil?.whatsapp ?? "" : "",
          pessoa.name?.split(/\s+/)[0] ?? "",
          pessoa.name?.split(/\s+/).slice(1).join(" ") ?? "",
          situacao?.status ?? "MEMBRO",
        ];
      });
    await auditar({ adminEmail: admin.email, acao: "CONTATOS_EXPORTADOS", alvoTipo: "CONTATOS", depois: { total: linhas.length }, ip: ipDoAdmin(request.headers) });
    const csv = paraCsv(["email", "phone", "fn", "ln", "situacao"], linhas);
    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contatos-com-consentimento-${agora.toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao exportar contatos");
  }
}
