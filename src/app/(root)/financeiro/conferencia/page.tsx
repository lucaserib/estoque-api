"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { podeEditar } from "@/lib/permissoes";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";
import { useSincronizacaoFinanceira } from "../components/SincronizacaoFinanceira";
import { moeda } from "../components/tipos";

interface TotaisConferencia {
  pedidos: number;
  pedidosValidos: number;
  unidades: number;
  faturamento: number;
  cancelados: number;
  valorCancelado: number;
  tarifa: number;
}

interface DivergenciaConferencia {
  pedidoExternoId: string;
  campo: string;
  valorMl: number | string | null;
  valorApp: number | string | null;
}

interface ResultadoConferencia {
  competencia: { ano: number; mes: number };
  totalMl: TotaisConferencia;
  totalApp: TotaisConferencia;
  coberturaPercentual: number;
  faltando: string[];
  divergentes: DivergenciaConferencia[];
  sobrando: string[];
  aguardandoDetalhes: number;
  confere: boolean;
}

const ROTULO_CAMPO: Record<string, string> = {
  faturamento: "Faturamento",
  status: "Status",
  unidades: "Unidades",
  tarifa: "Tarifa",
  data: "Data da venda",
};

function mesAtualString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(
    new Date()
  );
}

function formatarValorDivergencia(campo: string, valor: number | string | null): string {
  if (valor == null) return "—";
  if (campo === "faturamento" || campo === "tarifa") return moeda(Number(valor));
  if (campo === "data") {
    return new Date(String(valor)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  return String(valor);
}

export default function ConferenciaPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro, papel } = useAcessoFinanceiro();
  const { sinalizarDadosAlterados } = useSincronizacaoFinanceira();
  const [mes, setMes] = useState(mesAtualString());
  const [carregando, setCarregando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConferencia | null>(null);
  const podeCorrigir = papel ? podeEditar(papel, "FINANCEIRO_EDITAR") : false;

  const conferir = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/financeiro/conferencia?mes=${mes}`, { cache: "no-store" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(corpo?.error ?? "Erro ao conferir o mês.");
        return;
      }
      setResultado(corpo);
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    if (podeVerFinanceiro) conferir();
  }, [podeVerFinanceiro, conferir]);

  const corrigir = async () => {
    setCorrigindo(true);
    try {
      const resposta = await fetch("/api/financeiro/conferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(corpo?.error ?? "Não foi possível corrigir o mês.");
        return;
      }
      setResultado(corpo.depois);
      toast.success(`${corpo.lote.gravados} pedido(s) gravados com os dados do Mercado Livre.`);
      sinalizarDadosAlterados();
    } finally {
      setCorrigindo(false);
    }
  };

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-8">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const linhasTotais: Array<{ rotulo: string; ml: string; app: string; bate: boolean }> = resultado
    ? [
        {
          rotulo: "Pedidos válidos (pagos)",
          ml: resultado.totalMl.pedidosValidos.toLocaleString("pt-BR"),
          app: resultado.totalApp.pedidosValidos.toLocaleString("pt-BR"),
          bate: resultado.totalMl.pedidosValidos === resultado.totalApp.pedidosValidos,
        },
        {
          rotulo: "Unidades vendidas",
          ml: resultado.totalMl.unidades.toLocaleString("pt-BR"),
          app: resultado.totalApp.unidades.toLocaleString("pt-BR"),
          bate: resultado.totalMl.unidades === resultado.totalApp.unidades,
        },
        {
          rotulo: "Faturamento",
          ml: moeda(resultado.totalMl.faturamento),
          app: moeda(resultado.totalApp.faturamento),
          bate: resultado.totalMl.faturamento === resultado.totalApp.faturamento,
        },
        {
          rotulo: "Cancelados",
          ml: `${resultado.totalMl.cancelados} · ${moeda(resultado.totalMl.valorCancelado)}`,
          app: `${resultado.totalApp.cancelados} · ${moeda(resultado.totalApp.valorCancelado)}`,
          bate:
            resultado.totalMl.cancelados === resultado.totalApp.cancelados &&
            resultado.totalMl.valorCancelado === resultado.totalApp.valorCancelado,
        },
        {
          rotulo: "Tarifa de venda (pedidos pagos)",
          ml: moeda(resultado.totalMl.tarifa),
          app: moeda(resultado.totalApp.tarifa),
          bate: Math.abs(resultado.totalMl.tarifa - resultado.totalApp.tarifa) <= resultado.totalMl.pedidosValidos * 2,
        },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Conferência com o Mercado Livre"
        subtitle="Busca o mês direto no Mercado Livre e compara pedido a pedido com o que o app tem. Pedidos pela data de criação, fuso de Brasília."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm"
            />
            <Button variant="outline" size="sm" onClick={conferir} disabled={carregando}>
              {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Conferir de novo
            </Button>
            {podeCorrigir && (
              <Button size="sm" onClick={corrigir} disabled={corrigindo || carregando}>
                {corrigindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                Corrigir o mês
              </Button>
            )}
          </div>
        }
      />

      {carregando && !resultado ? (
        <Skeleton className="h-[300px] rounded-md" />
      ) : resultado ? (
        <>
          <SectionCard>
            {resultado.confere ? (
              <div className="flex items-center gap-2 text-success-text">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  O mês bate com o Mercado Livre: {resultado.totalMl.pedidosValidos} pedidos e {moeda(resultado.totalMl.faturamento)}.
                </span>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-warning-text">
                  Cobertura de {resultado.coberturaPercentual.toLocaleString("pt-BR")}%: faltam {resultado.faltando.length} pedido(s)
                  e há {resultado.divergentes.length} diferença(s).
                </p>
                <p className="text-muted-foreground">
                  &ldquo;Corrigir o mês&rdquo; grava agora, com os dados do Mercado Livre, todos os pedidos que faltam ou divergem.
                  Tarifa e frete reais de cada venda chegam em seguida, automaticamente.
                </p>
              </div>
            )}
            {resultado.aguardandoDetalhes > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {resultado.aguardandoDetalhes} venda(s) do mês ainda recebendo o detalhe do pagamento (tarifa, frete e liberação).
              </p>
            )}
          </SectionCard>

          <SectionCard title="Totais do mês">
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Indicador</DataTableHead>
                  <DataTableHead className="text-right">Mercado Livre</DataTableHead>
                  <DataTableHead className="text-right">Skubo</DataTableHead>
                  <DataTableHead className="text-right">Situação</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {linhasTotais.map((linha) => (
                  <DataTableRow key={linha.rotulo}>
                    <DataTableCell>{linha.rotulo}</DataTableCell>
                    <DataTableCell numeric>{linha.ml}</DataTableCell>
                    <DataTableCell numeric>{linha.app}</DataTableCell>
                    <DataTableCell numeric>
                      <StatusPill tone={linha.bate ? "success" : "critical"}>{linha.bate ? "Bate" : "Diverge"}</StatusPill>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </SectionCard>

          {(resultado.faltando.length > 0 || resultado.divergentes.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title={`Pedidos que faltam (${resultado.faltando.length})`}>
                {resultado.faltando.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum.</p>
                ) : (
                  <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
                    {resultado.faltando.map((id) => (
                      <span key={id} className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                        #{id}
                      </span>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title={`Diferenças (${resultado.divergentes.length})`}>
                {resultado.divergentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <DataTable>
                      <DataTableHeader>
                        <DataTableRow>
                          <DataTableHead>Pedido</DataTableHead>
                          <DataTableHead>Campo</DataTableHead>
                          <DataTableHead className="text-right">ML</DataTableHead>
                          <DataTableHead className="text-right">App</DataTableHead>
                        </DataTableRow>
                      </DataTableHeader>
                      <DataTableBody>
                        {resultado.divergentes.map((d) => (
                          <DataTableRow key={`${d.pedidoExternoId}-${d.campo}`}>
                            <DataTableCell>
                              <Link href={`/financeiro/vendas?pedido=${d.pedidoExternoId}`} className="font-mono text-xs text-primary hover:underline">
                                #{d.pedidoExternoId}
                              </Link>
                            </DataTableCell>
                            <DataTableCell>{ROTULO_CAMPO[d.campo] ?? d.campo}</DataTableCell>
                            <DataTableCell numeric>{formatarValorDivergencia(d.campo, d.valorMl)}</DataTableCell>
                            <DataTableCell numeric>{formatarValorDivergencia(d.campo, d.valorApp)}</DataTableCell>
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {resultado.sobrando.length > 0 && (
            <SectionCard title={`No app mas fora deste mês no ML (${resultado.sobrando.length})`}>
              <p className="text-sm text-muted-foreground">
                Pedidos gravados neste mês que o Mercado Livre lista em outra data. &ldquo;Corrigir o mês&rdquo; reprocessa e coloca cada um
                no dia certo.
              </p>
            </SectionCard>
          )}
        </>
      ) : (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">Escolha o mês para comparar com o Mercado Livre.</p>
        </SectionCard>
      )}
    </div>
  );
}
