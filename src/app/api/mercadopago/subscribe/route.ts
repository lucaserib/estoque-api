import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import {
  MercadoPagoService,
  MercadoPagoNotConfiguredError,
  isMercadoPagoConfigured,
  planToRecurringConfig,
} from "@/services/mercadoPagoService";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { criarAssinaturaDaConta, invalidarSituacaoConta } from "@/modules/conta/situacao";
import { obterConfiguracaoComercial, precoDoPlano } from "@/modules/comercial/configuracao";
import { CupomInvalidoError, registrarUsoCupom, validarCupom } from "@/modules/comercial/cupons";

const subscribeSchema = z.object({
  plan: z.enum(["MONTHLY", "ANNUAL"]),
  cupom: z.string().trim().max(40).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

    if (!isMercadoPagoConfigured()) {
      return NextResponse.json(
        { error: "Pagamentos ainda não estão configurados" },
        { status: 503 }
      );
    }

    const parsed = subscribeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { plan } = parsed.data;
    const subscription = await criarAssinaturaDaConta(user.contaId);

    if (subscription.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Você já tem uma assinatura ativa" },
        { status: 400 }
      );
    }

    const configuracao = await obterConfiguracaoComercial();
    const precos = precoDoPlano(configuracao, plan);
    let primeiraCobrancaCentavos = precos.primeiraCobrancaCentavos;
    let cupomId: string | null = null;

    const cupomDoAdmin =
      !parsed.data.cupom && subscription.cupomPrimeiraCobrancaId
        ? (await prisma.cupom.findUnique({ where: { id: subscription.cupomPrimeiraCobrancaId }, select: { codigo: true } }))?.codigo ?? null
        : null;
    const codigoCupom = parsed.data.cupom || cupomDoAdmin;

    if (codigoCupom) {
      const aplicavel = await validarCupom(
        codigoCupom,
        plan === "ANNUAL" ? "ANUAL" : "PRIMEIRA_COBRANCA_MENSAL",
        user.contaId,
        primeiraCobrancaCentavos,
        { referencia: subscription.id }
      );
      primeiraCobrancaCentavos = aplicavel.precoFinalCentavos;
      cupomId = aplicavel.cupom.id;
    }

    const agora = new Date();
    const inicioDaCobranca =
      subscription.status === "TRIALING" && subscription.trialEndsAt.getTime() > agora.getTime()
        ? subscription.trialEndsAt
        : null;
    const recurring = planToRecurringConfig(plan, primeiraCobrancaCentavos);
    const origin = request.nextUrl.origin;

    const preapproval = await MercadoPagoService.createPreapproval({
      reason: `Skubo — Plano ${plan === "ANNUAL" ? "Anual" : "Mensal"}`,
      payerEmail: user.email,
      transactionAmount: recurring.transactionAmount,
      frequency: recurring.frequency,
      frequencyType: recurring.frequencyType,
      backUrl: `${origin}/assinatura`,
      externalReference: user.contaId,
      startDate: inicioDaCobranca,
    });

    if (cupomId) await registrarUsoCupom(cupomId, user.contaId, subscription.id);

    await prisma.subscription.update({
      where: { userId: user.contaId },
      data: {
        plan,
        mpPreapprovalId: preapproval.id,
        mpPayerEmail: user.email,
        precoContratadoCentavos: precos.recorrenteCentavos,
        configuracaoVersao: configuracao.versao,
        cupomPrimeiraCobrancaId: cupomId,
      },
    });

    invalidarSituacaoConta(user.contaId);
    return NextResponse.json({
      checkoutUrl: preapproval.init_point,
      cobrancaComecaEm: inicioDaCobranca,
      primeiraCobrancaCentavos,
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    if (error instanceof CupomInvalidoError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    if (error instanceof MercadoPagoNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Erro ao criar assinatura Mercado Pago:", error);
    return NextResponse.json(
      { error: "Erro ao criar assinatura" },
      { status: 500 }
    );
  }
}
