import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizarEmail } from "@/modules/usuarios/convites";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { aoCriarConta } from "@/modules/conta/criacao";
import { avisarConviteAceito } from "@/modules/usuarios/equipe";
import { registrarConsentimentos } from "@/modules/clientes/consentimento";
import { normalizarWhatsapp, type DadosPerfilCliente } from "@/modules/clientes/perfil";
import { COOKIE_ORIGEM, lerOrigem } from "@/lib/origemCadastro";
import { enviarEventoMeta } from "@/modules/marketing/metaCapi";
import { ipDe } from "@/modules/conta/auditoria";

const SENHA_MINIMA = 8;

const cadastroSchema = z.object({
  email: z.string().trim().max(200),
  password: z.string().max(200),
  name: z.string().trim().max(120),
  inviteToken: z.string().max(200).nullish(),
  whatsapp: z.string().max(40).nullish(),
  nomeLoja: z.string().trim().max(120).nullish(),
  faixaPedidosMes: z.string().max(30).nullish(),
  canais: z.array(z.string().max(30)).max(10).nullish(),
  comoConheceu: z.string().max(30).nullish(),
  codigoIndicacao: z.string().max(20).nullish(),
  aceitouTermos: z.boolean().optional(),
  aceitouMarketing: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const lido = cadastroSchema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return NextResponse.json({ error: "Preencha nome, e-mail e senha" }, { status: 400 });
  }
  const corpo = lido.data;
  const email = normalizarEmail(corpo.email);
  const password = corpo.password;
  const name = corpo.name;
  const inviteToken = corpo.inviteToken ?? null;
  const ip = ipDe(req.headers);
  const userAgent = req.headers.get("user-agent");

  const limite = await checkRateLimit("register", ip ?? "local", 10, 60 * 60);
  if (!limite.allowed) return rateLimitResponse(limite);

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Preencha nome, e-mail e senha" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 });
  }

  if (password.length < SENHA_MINIMA) {
    return NextResponse.json({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres` }, { status: 400 });
  }

  if (!corpo.aceitouTermos) {
    return NextResponse.json(
      { error: "Para criar a conta, aceite os Termos de uso e a Política de Privacidade." },
      { status: 400 }
    );
  }

  if (corpo.whatsapp && !normalizarWhatsapp(corpo.whatsapp)) {
    return NextResponse.json({ error: "WhatsApp inválido. Use DDD + número." }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: inviteToken ? "Você já tem conta. Entre com ela para aceitar o convite." : "Já existe uma conta com este e-mail" },
      { status: 400 }
    );
  }

  let invitation = null;
  let contaId: string | null = null;
  if (inviteToken) {
    invitation = await prisma.invitation.findUnique({
      where: { token: inviteToken },
      include: { invitedBy: { select: { id: true, contaId: true } } },
    });

    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt < new Date() ||
      normalizarEmail(invitation.email) !== email
    ) {
      return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 400 });
    }

    contaId = invitation.invitedBy.contaId ?? invitation.invitedBy.id;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      ...(invitation ? { role: invitation.role, contaId } : {}),
    },
    select: { id: true, email: true, name: true },
  });

  if (invitation) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  }

  const marketing = Boolean(corpo.aceitouMarketing);
  await registrarConsentimentos(
    user.id,
    [
      { tipo: "TERMOS", concedido: true },
      { tipo: "PRIVACIDADE", concedido: true },
      { tipo: "CICLO_DE_VIDA", concedido: true },
      { tipo: "MARKETING_EMAIL", concedido: marketing },
      { tipo: "MARKETING_WHATSAPP", concedido: marketing && Boolean(corpo.whatsapp) },
    ],
    { origem: "cadastro", ip, userAgent }
  ).catch((error) => console.error("[CADASTRO] Falha ao registrar consentimentos:", error));

  const origem = lerOrigem(req.cookies.get(COOKIE_ORIGEM)?.value);
  const perfil: DadosPerfilCliente | undefined = invitation
    ? undefined
    : {
        nomeLoja: corpo.nomeLoja ?? null,
        whatsapp: corpo.whatsapp ?? null,
        faixaPedidosMes: corpo.faixaPedidosMes ?? null,
        canais: corpo.canais ?? [],
        comoConheceu: corpo.comoConheceu ?? null,
        utmSource: origem?.utmSource ?? null,
        utmMedium: origem?.utmMedium ?? null,
        utmCampaign: origem?.utmCampaign ?? null,
        utmContent: origem?.utmContent ?? null,
        utmTerm: origem?.utmTerm ?? null,
        paginaEntrada: origem?.paginaEntrada ?? null,
        referrer: origem?.referrer ?? null,
        primeiroToqueEm: origem?.primeiroToqueEm ? new Date(origem.primeiroToqueEm) : null,
        perfilCompleto: true,
      };

  if (invitation) await avisarConviteAceito(invitation.id, user.id);
  await aoCriarConta(user.id, contaId, invitation ? "convite" : "senha", {
    ip,
    userAgent,
    perfil,
    codigoIndicacao: invitation ? null : corpo.codigoIndicacao || origem?.ref || null,
  });

  const eventoId = `cadastro-${user.id}`;
  if (!invitation) {
    await enviarEventoMeta({
      nome: "CompleteRegistration",
      idEvento: eventoId,
      userId: user.id,
      urlOrigem: req.headers.get("referer"),
      ip,
      userAgent,
    });
  }

  return NextResponse.json({ message: "Usuário registrado com sucesso", user, eventoId });
}
