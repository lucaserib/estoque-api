"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { formatBRL, formatDateBR } from "@/lib/format";
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "../components/SeletorPeriodo";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";

interface ItemVenda {
  id: string;
  titulo: string;
  sku: string | null;
  quantidade: number;
  precoUnitario: number;
  tarifaVenda: number;
  freteRateado: number | null;
  descontoRateado: number;
  impostoRateado: number;
  adsRateado: number;
  custoUnitario: number | null;
  margemContribuicao: number | null;
}

interface VendaLista {
  id: string;
  canal: string;
  pedidoExternoId: string;
  dataVenda: string;
  status: string;
  faturamentoBruto: number;
  margemContribuicao: number | null;
  completo: boolean;
  faltando: string[];
  itens: Array<{ titulo: string; quantidade: number; sku: string | null }>;
}

interface VendaDetalhe extends VendaLista {
  descontoVendedor: number;
  tarifaVenda: number;
  freteVendedor: number | null;
  freteConfianca: string;
  adsAtribuido: number;
  impostoEstimado: number;
  cmv: number | null;
  logistica: string | null;
  itens: ItemVenda[];
}

const STATUS_OPCOES = ["PAGA", "CANCELADA", "DEVOLVIDA", "DEVOLVIDA_PARCIAL", "EM_MEDIACAO"];

function VendasPageContent() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [produtoId] = useState<string | undefined>(searchParams.get("produtoId") ?? undefined);
  const [periodo, setPeriodo] = useState<PeriodoSelecionado>({ preset: "mesAtual", ...periodoDoPreset("mesAtual") });
  const [status, setStatus] = useState<string>("todos");
  const [soPrejuizo, setSoPrejuizo] = useState(false);
  const [soIncompletas, setSoIncompletas] = useState(searchParams.get("soIncompletas") === "true");
  const [vendas, setVendas] = useState<VendaLista[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const POR_PAGINA = 20;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        desde: periodo.desde.toISOString(),
        ate: periodo.ate.toISOString(),
        pagina: String(pagina),
        porPagina: String(POR_PAGINA),
      });
      if (status !== "todos") params.set("status", status);
      if (soPrejuizo) params.set("soPrejuizo", "true");
      if (soIncompletas) params.set("soIncompletas", "true");
      if (produtoId) params.set("produtoId", produtoId);

      const resposta = await fetch(`/api/financeiro/vendas?${params.toString()}`);
      if (resposta.ok) {
        const body = await resposta.json();
        setVendas(body.vendas);
        setTotal(body.total);
      }
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
    } finally {
      setCarregando(false);
    }
  }, [periodo, status, soPrejuizo, soIncompletas, produtoId, pagina]);

  useEffect(() => {
    if (podeVerFinanceiro) carregar();
  }, [podeVerFinanceiro, carregar]);

  const abrirDetalhe = async (id: string) => {
    setCarregandoDetalhe(true);
    try {
      const resposta = await fetch(`/api/financeiro/vendas/${id}`);
      if (resposta.ok) setVendaSelecionada(await resposta.json());
    } catch (error) {
      console.error("Erro ao carregar detalhe da venda:", error);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader eyebrow="Financeiro" title="Lucro por venda" subtitle="Composição completa de cada venda, com filtros." />

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <SeletorPeriodo valor={periodo} onChange={(p) => { setPeriodo(p); setPagina(1); }} />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPagina(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPCOES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={soPrejuizo ? "default" : "outline"}
            size="sm"
            onClick={() => { setSoPrejuizo((v) => !v); setPagina(1); }}
          >
            Só prejuízo
          </Button>
          <Button
            variant={soIncompletas ? "default" : "outline"}
            size="sm"
            onClick={() => { setSoIncompletas((v) => !v); setPagina(1); }}
          >
            Só incompletas
          </Button>
          {produtoId && (
            <Button variant="ghost" size="sm" onClick={() => router.push("/financeiro/vendas")}>
              Filtrado por produto — limpar
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard title={`${total} venda(s)`}>
        {carregando ? (
          <Skeleton className="h-[400px] rounded-md" />
        ) : vendas.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma venda encontrada com esses filtros.</div>
        ) : (
          <>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Pedido</DataTableHead>
                  <DataTableHead>Data</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead className="text-right">Faturamento</DataTableHead>
                  <DataTableHead className="text-right">Margem</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {vendas.map((venda) => (
                  <DataTableRow
                    key={venda.id}
                    className="cursor-pointer"
                    onClick={() => abrirDetalhe(venda.id)}
                  >
                    <DataTableCell>#{venda.pedidoExternoId}</DataTableCell>
                    <DataTableCell>{formatDateBR(venda.dataVenda)}</DataTableCell>
                    <DataTableCell>
                      <StatusPill tone={venda.status === "PAGA" ? "success" : venda.status.includes("CANCEL") ? "critical" : "neutral"}>
                        {venda.status}
                      </StatusPill>
                      {!venda.completo && <StatusPill tone="warning" className="ml-1">Incompleta</StatusPill>}
                    </DataTableCell>
                    <DataTableCell numeric>{formatBRL(venda.faturamentoBruto)}</DataTableCell>
                    <DataTableCell numeric emphasis>
                      {venda.margemContribuicao != null ? formatBRL(venda.margemContribuicao) : "—"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Página {pagina} de {totalPaginas}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <Dialog open={!!vendaSelecionada || carregandoDetalhe} onOpenChange={(open) => !open && setVendaSelecionada(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {vendaSelecionada ? `Pedido #${vendaSelecionada.pedidoExternoId}` : "Carregando…"}
            </DialogTitle>
          </DialogHeader>
          {carregandoDetalhe && <Skeleton className="h-64 rounded-md" />}
          {vendaSelecionada && !carregandoDetalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Faturamento bruto:</span> {formatBRL(vendaSelecionada.faturamentoBruto)}</div>
                <div><span className="text-muted-foreground">Desconto vendedor:</span> {formatBRL(vendaSelecionada.descontoVendedor)}</div>
                <div><span className="text-muted-foreground">Tarifa:</span> {formatBRL(vendaSelecionada.tarifaVenda)}</div>
                <div>
                  <span className="text-muted-foreground">Frete:</span>{" "}
                  {vendaSelecionada.freteVendedor != null ? formatBRL(vendaSelecionada.freteVendedor) : "—"}{" "}
                  <StatusPill tone={vendaSelecionada.freteConfianca === "CONFIRMADO" ? "success" : "info"} className="ml-1">
                    {vendaSelecionada.freteConfianca === "CONFIRMADO" ? "API" : "Estimado"}
                  </StatusPill>
                </div>
                <div><span className="text-muted-foreground">Ads:</span> {formatBRL(vendaSelecionada.adsAtribuido)}</div>
                <div><span className="text-muted-foreground">Imposto:</span> {formatBRL(vendaSelecionada.impostoEstimado)}</div>
                <div><span className="text-muted-foreground">CMV:</span> {vendaSelecionada.cmv != null ? formatBRL(vendaSelecionada.cmv) : "—"}</div>
                <div className="font-medium">
                  <span className="text-muted-foreground">Margem:</span>{" "}
                  {vendaSelecionada.margemContribuicao != null ? formatBRL(vendaSelecionada.margemContribuicao) : "—"}
                </div>
              </div>

              {!vendaSelecionada.completo && (
                <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
                  Venda incompleta: {vendaSelecionada.faltando.join(", ")}
                </div>
              )}

              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Item</DataTableHead>
                    <DataTableHead className="text-right">Qtd</DataTableHead>
                    <DataTableHead className="text-right">Margem</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {vendaSelecionada.itens.map((item) => (
                    <DataTableRow key={item.id}>
                      <DataTableCell>{item.titulo} {item.sku && <span className="text-muted-foreground">({item.sku})</span>}</DataTableCell>
                      <DataTableCell numeric>{item.quantidade}</DataTableCell>
                      <DataTableCell numeric>{item.margemContribuicao != null ? formatBRL(item.margemContribuicao) : "—"}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VendasPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex h-64 items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <VendasPageContent />
    </Suspense>
  );
}
