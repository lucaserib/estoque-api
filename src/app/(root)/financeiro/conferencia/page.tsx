"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { formatBRL } from "@/lib/format";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";

interface TotaisConferencia {
  pedidos: number;
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
}

function mesAtualString(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function toneDaCobertura(percentual: number): "success" | "warning" | "critical" {
  if (percentual >= 99) return "success";
  if (percentual >= 80) return "warning";
  return "critical";
}

export default function ConferenciaPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const { data: session } = useSession();
  const [mes, setMes] = useState(mesAtualString());
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConferencia | null>(null);

  const conferir = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/financeiro/conferencia?mes=${mes}`);
      if (!resposta.ok) {
        toast.error("Erro ao conferir o mês.");
        return;
      }
      setResultado(await resposta.json());
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  const aplicarAcao = async (acao: "importar_faltantes" | "reprocessar_divergentes") => {
    if (!resultado) return;
    const pedidosExternoId =
      acao === "importar_faltantes"
        ? resultado.faltando
        : [...new Set(resultado.divergentes.map((d) => d.pedidoExternoId))];
    if (pedidosExternoId.length === 0) return;

    setAplicando(true);
    try {
      const resposta = await fetch("/api/financeiro/conferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, pedidosExternoId }),
      });
      if (!resposta.ok) {
        toast.error("Erro ao aplicar a ação.");
        return;
      }
      toast.success("Concluído. Conferindo de novo…");
      await conferir();
    } finally {
      setAplicando(false);
    }
  };

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <PageHeader eyebrow="Financeiro" title="Conferência" />
        <SectionCard title="Acesso restrito">
          <p className="text-sm text-muted-foreground">
            Apenas administradores podem conferir os números contra o Mercado Livre.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Conferência"
        subtitle="Compara direto com o Mercado Livre, pedido a pedido, o que o app tem gravado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm"
            />
            <Button onClick={conferir} disabled={carregando}>
              {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferir
            </Button>
          </div>
        }
      />

      {resultado && (
        <>
          <SectionCard title="Cobertura do mês">
            <div className="flex flex-wrap items-center gap-4">
              <StatusPill tone={toneDaCobertura(resultado.coberturaPercentual)}>
                {resultado.coberturaPercentual}% de cobertura
              </StatusPill>
              <span className="text-sm text-muted-foreground">
                {resultado.faltando.length} pedido(s) faltando · {resultado.divergentes.length} divergência(s)
              </span>
            </div>
          </SectionCard>

          <SectionCard title="Totais do mês">
            <div className="overflow-x-auto">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead sticky>Fonte</DataTableHead>
                    <DataTableHead className="text-right">Pedidos pagos</DataTableHead>
                    <DataTableHead className="text-right">Unidades</DataTableHead>
                    <DataTableHead className="text-right">Faturamento</DataTableHead>
                    <DataTableHead className="text-right">Cancelados</DataTableHead>
                    <DataTableHead className="text-right">Valor cancelado</DataTableHead>
                    <DataTableHead className="text-right">Tarifa</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  <DataTableRow>
                    <DataTableCell sticky>Mercado Livre</DataTableCell>
                    <DataTableCell numeric>{resultado.totalMl.pedidos}</DataTableCell>
                    <DataTableCell numeric>{resultado.totalMl.unidades}</DataTableCell>
                    <DataTableCell numeric>{formatBRL(resultado.totalMl.faturamento)}</DataTableCell>
                    <DataTableCell numeric>{resultado.totalMl.cancelados}</DataTableCell>
                    <DataTableCell numeric>{formatBRL(resultado.totalMl.valorCancelado)}</DataTableCell>
                    <DataTableCell numeric>{formatBRL(resultado.totalMl.tarifa)}</DataTableCell>
                  </DataTableRow>
                  <DataTableRow>
                    <DataTableCell sticky>Leap Stock</DataTableCell>
                    <DataTableCell numeric>{resultado.totalApp.pedidos}</DataTableCell>
                    <DataTableCell numeric>{resultado.totalApp.unidades}</DataTableCell>
                    <DataTableCell numeric>{formatBRL(resultado.totalApp.faturamento)}</DataTableCell>
                    <DataTableCell numeric>{resultado.totalApp.cancelados}</DataTableCell>
                    <DataTableCell numeric>{formatBRL(resultado.totalApp.valorCancelado)}</DataTableCell>
                    <DataTableCell numeric>{formatBRL(resultado.totalApp.tarifa)}</DataTableCell>
                  </DataTableRow>
                </DataTableBody>
              </DataTable>
            </div>
          </SectionCard>

          {resultado.faltando.length > 0 && (
            <SectionCard title={`Pedidos faltando (${resultado.faltando.length})`}>
              <div className="mb-3 flex flex-wrap gap-2">
                {resultado.faltando.map((id) => (
                  <StatusPill key={id} tone="critical">{id}</StatusPill>
                ))}
              </div>
              <Button onClick={() => aplicarAcao("importar_faltantes")} disabled={aplicando}>
                {aplicando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar faltantes
              </Button>
            </SectionCard>
          )}

          {resultado.divergentes.length > 0 && (
            <SectionCard title={`Divergências (${resultado.divergentes.length})`}>
              <div className="mb-3 overflow-x-auto">
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead sticky>Pedido</DataTableHead>
                      <DataTableHead>Campo</DataTableHead>
                      <DataTableHead className="text-right">Mercado Livre</DataTableHead>
                      <DataTableHead className="text-right">Leap Stock</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {resultado.divergentes.map((d, i) => (
                      <DataTableRow key={`${d.pedidoExternoId}-${d.campo}-${i}`}>
                        <DataTableCell sticky>{d.pedidoExternoId}</DataTableCell>
                        <DataTableCell>{d.campo}</DataTableCell>
                        <DataTableCell numeric>
                          {d.campo === "faturamento" || d.campo === "unidades" ? d.valorMl : String(d.valorMl)}
                        </DataTableCell>
                        <DataTableCell numeric>
                          {d.campo === "faturamento" || d.campo === "unidades" ? d.valorApp : String(d.valorApp)}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </div>
              <Button onClick={() => aplicarAcao("reprocessar_divergentes")} disabled={aplicando}>
                {aplicando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reprocessar divergentes
              </Button>
            </SectionCard>
          )}
        </>
      )}

      {!resultado && !carregando && (
        <SectionCard title="Nenhuma conferência ainda">
          <p className="text-sm text-muted-foreground">
            Escolha o mês e clique em "Conferir" para comparar com o Mercado Livre.
          </p>
        </SectionCard>
      )}
    </div>
  );
}
