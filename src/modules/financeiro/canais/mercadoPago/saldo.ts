import { Confianca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchMlWithBackoff } from "@/lib/mlFetch";
import { obterAccessTokenEMlUserId } from "../mercadoLivre/cliente";
import { garantirContaFinanceiraMercadoPago } from "../../lancamentos/contasFinanceiras";

const BASE_URL_MERCADO_PAGO = "https://api.mercadopago.com";

export interface SaldoMercadoPago {
  disponivel: number | null;
  aLiberar: number | null;
  confianca: Confianca;
}

interface SaldoBruto {
  available_balance?: number;
  unavailable_balance?: number;
  total_amount?: number;
}

/**
 * Endpoint não confirmado (Fase 4) — testado só contra documentação
 * pública, nunca contra uma resposta real (api.mercadopago.com não é
 * alcançável deste ambiente de desenvolvimento). Qualquer falha devolve
 * valores nulos com confiança ESTIMADO em vez de inventar um saldo.
 */
export async function obterSaldoMercadoPago(mlUserId: string, accessToken: string): Promise<SaldoMercadoPago> {
  try {
    const resposta = await fetchMlWithBackoff(
      `${BASE_URL_MERCADO_PAGO}/users/${mlUserId}/mercadopago_account/balance`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    if (!resposta.ok) return { disponivel: null, aLiberar: null, confianca: Confianca.ESTIMADO };

    const dados = (await resposta.json()) as SaldoBruto;
    const disponivel =
      typeof dados.available_balance === "number" ? Math.round(dados.available_balance * 100) : null;
    const aLiberar =
      typeof dados.unavailable_balance === "number" ? Math.round(dados.unavailable_balance * 100) : null;

    return {
      disponivel,
      aLiberar,
      confianca: disponivel != null ? Confianca.CONFIRMADO : Confianca.ESTIMADO,
    };
  } catch (erro) {
    console.error("[SALDO_MP] Erro ao buscar saldo da conta Mercado Pago:", erro);
    return { disponivel: null, aLiberar: null, confianca: Confianca.ESTIMADO };
  }
}

export async function sincronizarSaldoMercadoPago(accountId: string): Promise<void> {
  const conta = await prisma.mercadoLivreAccount.findUnique({
    where: { id: accountId },
    select: { userId: true, nickname: true },
  });
  if (!conta) return;

  const contaFinanceira = await garantirContaFinanceiraMercadoPago(conta.userId, accountId, conta.nickname);

  const { accessToken, mlUserId } = await obterAccessTokenEMlUserId(accountId);
  const saldo = await obterSaldoMercadoPago(mlUserId, accessToken);

  await prisma.contaFinanceira.update({
    where: { id: contaFinanceira.id },
    data: {
      saldoAtualExterno: saldo.disponivel,
      saldoALiberarExterno: saldo.aLiberar,
      saldoExternoAtualizadoEm: new Date(),
      saldoExternoConfianca: saldo.confianca,
    },
  });
}
