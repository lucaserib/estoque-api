import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { ipDe } from "@/modules/conta/auditoria";
import { registrarConsentimentos } from "@/modules/clientes/consentimento";
import { garantirPerfilCliente, normalizarWhatsapp } from "@/modules/clientes/perfil";
import { COOKIE_ORIGEM, lerOrigem } from "@/lib/origemCadastro";
import { registrarIndicacaoNoCadastro } from "@/modules/indicacao/cadastro";

const corpoSchema = z.object({
  aceitouTermos: z.literal(true, { errorMap: () => ({ message: "Aceite os Termos de uso e a Política de Privacidade." }) }),
  aceitouMarketing: z.boolean().default(false),
  whatsapp: z.string().max(40).nullish(),
  nomeLoja: z.string().trim().max(120).nullish(),
  faixaPedidosMes: z.string().max(30).nullish(),
  canais: z.array(z.string().max(30)).max(10).nullish(),
  comoConheceu: z.string().max(30).nullish(),
  codigoIndicacao: z.string().max(20).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const lido = corpoSchema.safeParse(await request.json().catch(() => null));
    if (!lido.success) return NextResponse.json({ error: lido.error.issues[0].message }, { status: 400 });
    const corpo = lido.data;
    const dono = usuario.contaId === usuario.id;

    if (dono && (!corpo.nomeLoja?.trim() || !corpo.faixaPedidosMes)) {
      return NextResponse.json({ error: "Conte o nome da loja e quantos pedidos ela tem por mês." }, { status: 400 });
    }
    if (corpo.whatsapp && !normalizarWhatsapp(corpo.whatsapp)) {
      return NextResponse.json({ error: "WhatsApp inválido. Use DDD + número." }, { status: 400 });
    }

    const contexto = { origem: "boas-vindas" as const, ip: ipDe(request.headers), userAgent: request.headers.get("user-agent") };
    await registrarConsentimentos(
      usuario.id,
      [
        { tipo: "TERMOS", concedido: true },
        { tipo: "PRIVACIDADE", concedido: true },
        { tipo: "CICLO_DE_VIDA", concedido: true },
        { tipo: "MARKETING_EMAIL", concedido: corpo.aceitouMarketing },
        { tipo: "MARKETING_WHATSAPP", concedido: corpo.aceitouMarketing && Boolean(corpo.whatsapp) },
      ],
      contexto
    );

    if (dono) {
      const origem = lerOrigem(request.cookies.get(COOKIE_ORIGEM)?.value);
      const atual = await prisma.perfilCliente.findUnique({ where: { contaId: usuario.id }, select: { utmSource: true, primeiroToqueEm: true } });
      const semOrigem = !atual?.utmSource && !atual?.primeiroToqueEm;
      await garantirPerfilCliente(usuario.id, {
        nomeLoja: corpo.nomeLoja ?? null,
        whatsapp: corpo.whatsapp ?? null,
        faixaPedidosMes: corpo.faixaPedidosMes ?? null,
        canais: corpo.canais ?? [],
        comoConheceu: corpo.comoConheceu ?? null,
        perfilCompleto: true,
        ...(semOrigem && origem
          ? {
              utmSource: origem.utmSource ?? null,
              utmMedium: origem.utmMedium ?? null,
              utmCampaign: origem.utmCampaign ?? null,
              utmContent: origem.utmContent ?? null,
              utmTerm: origem.utmTerm ?? null,
              paginaEntrada: origem.paginaEntrada ?? null,
              referrer: origem.referrer ?? null,
              primeiroToqueEm: origem.primeiroToqueEm ? new Date(origem.primeiroToqueEm) : null,
            }
          : {}),
      });
      const codigo = corpo.codigoIndicacao || origem?.ref;
      if (codigo) await registrarIndicacaoNoCadastro(usuario.id, codigo);
    }

    return NextResponse.json({ destino: dono ? "/comecar" : "/" });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao concluir as boas-vindas:", error);
    return NextResponse.json({ error: "Não foi possível salvar agora." }, { status: 500 });
  }
}
