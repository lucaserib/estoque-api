import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchMlWithBackoff } from "@/lib/mlFetch";

const BASE_URL_MERCADO_PAGO = "https://api.mercadopago.com";

export interface LiberacaoMercadoPagoNormalizada {
  referenciaExterna: string | null;
  valor: number;
  data: Date;
}

interface LiberacaoBruta {
  source_id?: string;
  amount?: number;
  date?: string;
}

/**
 * Etapa opcional (Fase 4 item 4), desligada por padrão
 * (`ConfiguracaoGeral.usarRelatorioLiberacaoMercadoPago`). Endpoint e
 * formato de resposta são a parte de menor confiança de todo o Ciclo 7 —
 * nem o host (api.mercadopago.com, diferente de api.mercadolibre.com) foi
 * confirmado como aceitando o mesmo token da conta ML. Serve só para
 * conferência manual (Fase 7), nunca alimenta a DRE.
 */
export async function lerRelatorioLiberacaoMercadoPago(
  accountId: string,
  desde: Date,
  ate: Date
): Promise<LiberacaoMercadoPagoNormalizada[]> {
  try {
    const accessToken = await MercadoLivreService.getValidToken(accountId);
    const params = new URLSearchParams({
      begin_date: desde.toISOString(),
      end_date: ate.toISOString(),
    });

    const resposta = await fetchMlWithBackoff(
      `${BASE_URL_MERCADO_PAGO}/v1/account/release_report?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    if (!resposta.ok) return [];

    const dados = (await resposta.json()) as { results?: LiberacaoBruta[] };
    return (dados.results ?? []).map((r) => ({
      referenciaExterna: r.source_id ?? null,
      valor: typeof r.amount === "number" ? Math.round(r.amount * 100) : 0,
      data: r.date ? new Date(r.date) : new Date(),
    }));
  } catch (erro) {
    console.error("[LIBERACOES_MP] Erro ao buscar relatório de liberação:", erro);
    return [];
  }
}

export interface ResultadoConferenciaLiberacoes {
  habilitado: boolean;
  liberacoes: LiberacaoMercadoPagoNormalizada[];
}

export async function conferirLiberacoes(
  userId: string,
  accountId: string,
  desde: Date,
  ate: Date
): Promise<ResultadoConferenciaLiberacoes> {
  const config = await prisma.configuracaoGeral.findUnique({
    where: { userId },
    select: { usarRelatorioLiberacaoMercadoPago: true },
  });

  if (!config?.usarRelatorioLiberacaoMercadoPago) {
    return { habilitado: false, liberacoes: [] };
  }

  const liberacoes = await lerRelatorioLiberacaoMercadoPago(accountId, desde, ate);
  return { habilitado: true, liberacoes };
}
