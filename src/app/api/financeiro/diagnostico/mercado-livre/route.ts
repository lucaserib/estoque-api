import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { mapearEnvio } from "@/modules/financeiro/canais/mercadoLivre/mapeador";
import { obterAdaptador } from "@/modules/financeiro/canais/registro";

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

async function diagnosticarPorTipo(
  tipo: string,
  searchParams: URLSearchParams,
  accountId: string,
  accessToken: string
): Promise<NextResponse> {
  switch (tipo) {
    case "envio": {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Parâmetro 'id' é obrigatório" }, { status: 400 });
      const resposta = await buscarJson(`/shipments/${id}`, accessToken);
      if (!resposta.ok) {
        return NextResponse.json({ error: "Erro ao buscar o envio", detalhe: resposta.corpo }, { status: resposta.status });
      }
      return NextResponse.json({
        bruto: removerCamposSensiveis(resposta.corpo, CAMPOS_PESSOAIS_PROIBIDOS),
        mapeado: mapearEnvio(resposta.corpo as { logistic_type?: string }),
      });
    }

    case "pagamento": {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Parâmetro 'id' é obrigatório" }, { status: 400 });
      const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        return NextResponse.json({ error: "Erro ao buscar o pagamento", detalhe: corpo }, { status: resposta.status });
      }
      return NextResponse.json({ bruto: removerCamposSensiveis(corpo, CAMPOS_PESSOAIS_PROIBIDOS) });
    }

    case "claims": {
      const pedido = searchParams.get("pedido");
      if (!pedido) return NextResponse.json({ error: "Parâmetro 'pedido' é obrigatório" }, { status: 400 });
      const resposta = await buscarJson(
        `/post-purchase/v1/claims/search?resource=order&resource_id=${pedido}`,
        accessToken
      );
      if (!resposta.ok) {
        return NextResponse.json({ error: "Erro ao buscar claims do pedido", detalhe: resposta.corpo }, { status: resposta.status });
      }
      return NextResponse.json({ bruto: removerCamposSensiveis(resposta.corpo, CAMPOS_PESSOAIS_PROIBIDOS) });
    }

    case "ads": {
      const dia = searchParams.get("dia");
      if (!dia) return NextResponse.json({ error: "Parâmetro 'dia' é obrigatório (AAAA-MM-DD)" }, { status: 400 });
      const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);
      if (!adaptador.listarGastosAds) {
        return NextResponse.json({ error: "Adaptador não implementa listarGastosAds" }, { status: 501 });
      }
      const mapeado = await adaptador.listarGastosAds({ contaCanalId: accountId, userId: "" }, new Date(dia));
      return NextResponse.json({ mapeado });
    }

    case "cobrancas": {
      const mes = searchParams.get("mes");
      if (!mes) return NextResponse.json({ error: "Parâmetro 'mes' é obrigatório (AAAA-MM)" }, { status: 400 });
      const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);
      if (!adaptador.listarCobrancas) {
        return NextResponse.json({ error: "Adaptador não implementa listarCobrancas" }, { status: 501 });
      }
      const mapeado = await adaptador.listarCobrancas({ contaCanalId: accountId, userId: "" }, mes);
      return NextResponse.json({ mapeado });
    }

    default:
      return NextResponse.json({ error: `Tipo de diagnóstico desconhecido: ${tipo}` }, { status: 400 });
  }
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
    const tipo = searchParams.get("tipo");
    const pedidoId = searchParams.get("pedido");
    const accountIdParam = searchParams.get("accountId");

    if (!tipo && !pedidoId) {
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

    if (tipo) {
      return await diagnosticarPorTipo(tipo, searchParams, mlAccount.id, accessToken);
    }

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
