import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

const BASE_URL = "https://api.mercadolibre.com";

type JsonRecord = Record<string, unknown>;

function removerCamposSensiveis(
  valor: unknown,
  camposProibidos: string[]
): unknown {
  if (Array.isArray(valor)) {
    return valor.map((item) => removerCamposSensiveis(item, camposProibidos));
  }
  if (valor && typeof valor === "object") {
    const objeto = valor as JsonRecord;
    const limpo: JsonRecord = {};
    for (const [chave, item] of Object.entries(objeto)) {
      if (camposProibidos.includes(chave)) continue;
      limpo[chave] = removerCamposSensiveis(item, camposProibidos);
    }
    return limpo;
  }
  return valor;
}

const CAMPOS_PESSOAIS_PROIBIDOS = [
  "buyer",
  "email",
  "first_name",
  "last_name",
  "nickname",
  "phone",
  "billing_info",
  "receiver_address",
  "card",
  "payer_id",
  "identification",
];

async function buscarJson(
  caminho: string,
  accessToken: string
): Promise<{ ok: boolean; status: number; corpo: unknown }> {
  const response = await fetch(`${BASE_URL}${caminho}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const corpo = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, corpo };
}

/**
 * GET /api/financeiro/diagnostico/mercado-livre?pedido=<id>
 * Somente ADMIN. Devolve o pedido, os descontos, o custo do envio e os
 * pagamentos crus da API do ML (sem token, sem dado pessoal do comprador)
 * para confirmar em produção os campos reais que o adaptador financeiro
 * (Ciclo 7 Fase 3) vai consumir — ver docs/financeiro/fontes-mercado-livre.md.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Apenas administradores podem usar este diagnóstico" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pedidoId = searchParams.get("pedido");
    const accountIdParam = searchParams.get("accountId");

    if (!pedidoId) {
      return NextResponse.json(
        { error: "Parâmetro 'pedido' é obrigatório" },
        { status: 400 }
      );
    }

    const mlAccount = accountIdParam
      ? await prisma.mercadoLivreAccount.findFirst({
          where: { id: accountIdParam, userId: user.contaId, isActive: true },
        })
      : await prisma.mercadoLivreAccount.findFirst({
          where: { userId: user.contaId, isActive: true },
        });

    if (!mlAccount) {
      return NextResponse.json(
        { error: "Nenhuma conta do Mercado Livre ativa encontrada" },
        { status: 404 }
      );
    }

    const accessToken = await MercadoLivreService.getValidToken(mlAccount.id);

    const pedidoResp = await buscarJson(`/orders/${pedidoId}`, accessToken);
    if (!pedidoResp.ok) {
      return NextResponse.json(
        { error: "Erro ao buscar o pedido no Mercado Livre", detalhe: pedidoResp.corpo },
        { status: pedidoResp.status }
      );
    }

    const pedido = pedidoResp.corpo as JsonRecord;
    const shippingId =
      pedido.shipping && typeof pedido.shipping === "object"
        ? (pedido.shipping as JsonRecord).id
        : undefined;

    const [descontosResp, custosEnvioResp] = await Promise.all([
      buscarJson(`/orders/${pedidoId}/discounts`, accessToken),
      shippingId
        ? buscarJson(`/shipments/${shippingId}/costs`, accessToken)
        : Promise.resolve({ ok: false, status: 0, corpo: null }),
    ]);

    const diagnostico = {
      pedidoId,
      contaMlId: mlAccount.id,
      shippingId: shippingId ?? null,
      pedido: removerCamposSensiveis(pedido, CAMPOS_PESSOAIS_PROIBIDOS),
      descontos: descontosResp.ok
        ? removerCamposSensiveis(descontosResp.corpo, CAMPOS_PESSOAIS_PROIBIDOS)
        : { erro: true, status: descontosResp.status, detalhe: descontosResp.corpo },
      custosEnvio: shippingId
        ? custosEnvioResp.ok
          ? removerCamposSensiveis(custosEnvioResp.corpo, CAMPOS_PESSOAIS_PROIBIDOS)
          : { erro: true, status: custosEnvioResp.status, detalhe: custosEnvioResp.corpo }
        : { erro: true, motivo: "Pedido sem shipping.id" },
      pagamentos: removerCamposSensiveis(
        pedido.payments ?? null,
        CAMPOS_PESSOAIS_PROIBIDOS
      ),
    };

    return NextResponse.json(diagnostico);
  } catch (error) {
    console.error("[DIAGNOSTICO_ML_FINANCEIRO] Erro:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao gerar diagnóstico financeiro do Mercado Livre",
      },
      { status: 500 }
    );
  }
}
