"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, Loader2, Search } from "lucide-react";
import { exportToExcel } from "@/utils/excelExport";
import { loadPDF, addTableToPDF, canUsePDF } from "@/utils/pdfHelper";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "../components/SeletorPeriodo";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";
import { BotaoAtualizarFinanceiro } from "../components/BotaoAtualizarFinanceiro";
import { useAoAtualizarDados, useSincronizacaoFinanceira } from "../components/SincronizacaoFinanceira";
import { moeda, percentual } from "../components/tipos";

interface CalculoVenda {
  valida: boolean;
  vendaBruta: number;
  cancelamento: number;
  faturamento: number;
  receitaFrete: number;
  receitaTotal: number;
  unidades: number;
  imposto: number;
  tarifa: number;
  frete: number;
  ads: number;
  cmv: number;
  outrosCustos: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  descontoCampanha: number;
  semCusto: boolean;
  semFrete: boolean;
  aguardandoDetalhes: boolean;
  semVinculo: boolean;
}

interface VendaLista {
  id: string;
  pedidoExternoId: string;
  pacoteExternoId: string | null;
  dataVenda: string;
  status: string;
  logisticaRotulo: string;
  freteOrigem: string;
  enriquecimentoErro: string | null;
  calculo: CalculoVenda;
  itens: Array<{ titulo: string; quantidade: number; sku: string | null; produtoId: string | null }>;
}

interface CobrancaPagamento {
  id: string;
  nome: string;
  tipo: string;
  valor: number;
  estornado: number;
}

interface VendaDetalhe {
  id: string;
  pedidoExternoId: string;
  pacoteExternoId: string | null;
  dataVenda: string;
  dataLiberacao: string | null;
  statusLiberacao: string | null;
  status: string;
  logisticaRotulo: string;
  freteOrigem: string;
  freteComprador: number;
  freteVendedor: number | null;
  freteAjusteManual: number | null;
  freteAjusteManualMotivo: string | null;
  valorLiquidoReceber: number | null;
  retencaoDividas: number;
  enriquecidoEm: string | null;
  enriquecimentoErro: string | null;
  faltando: string[];
  calculo: CalculoVenda;
  cobrancasPagamento: CobrancaPagamento[];
  itens: Array<{
    id: string;
    titulo: string;
    sku: string | null;
    quantidade: number;
    precoUnitario: number;
    precoCheio: number | null;
    custoUnitario: number | null;
    produto: { nome: string; sku: string } | null;
  }>;
}

const STATUS_ROTULO: Record<string, string> = {
  PAGA: "Paga",
  CANCELADA: "Cancelada",
  DEVOLVIDA: "Devolvida",
  DEVOLVIDA_PARCIAL: "Devolução parcial",
  EM_MEDIACAO: "Em mediação",
};

const ORIGEM_FRETE: Record<string, string> = {
  PAGAMENTO_CONFIRMADO: "confirmado no pagamento do Mercado Pago",
  CUSTO_ENVIO_CANAL: "custo do envio informado pelo ML",
  CUSTO_PRODUTO: "frete cadastrado no produto",
  PADRAO_LOGISTICA: "regra de frete da logística (Configurações)",
  AJUSTE_MANUAL: "ajuste manual",
  DESCONHECIDO: "ainda desconhecido",
};

const NOME_COBRANCA: Record<string, string> = {
  ml_sale_fee: "Tarifa de venda do ML",
  mp_processing_fee: "Taxa de processamento do Mercado Pago",
  fee_spl: "Retenção para quitar a fatura do ML",
};

function nomeCobranca(nome: string): string {
  if (NOME_COBRANCA[nome]) return NOME_COBRANCA[nome];
  if (nome.startsWith("mp_financing")) return "Taxa de parcelamento";
  if (nome.startsWith("shp_")) return "Frete do envio";
  return nome;
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function tomStatus(status: string): "success" | "critical" | "warning" | "neutral" {
  if (status === "PAGA") return "success";
  if (status === "CANCELADA" || status === "DEVOLVIDA") return "critical";
  if (status === "DEVOLVIDA_PARCIAL") return "warning";
  return "neutral";
}

function VendasPageContent() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const { sinalizarDadosAlterados } = useSincronizacaoFinanceira();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [produtoId] = useState<string | undefined>(searchParams.get("produtoId") ?? undefined);
  const [periodo, setPeriodo] = useState<PeriodoSelecionado>({ preset: "mesAtual", ...periodoDoPreset("mesAtual") });
  const [status, setStatus] = useState<string>("todos");
  const [soPrejuizo, setSoPrejuizo] = useState(searchParams.get("soPrejuizo") === "true");
  const [soIncompletas, setSoIncompletas] = useState(searchParams.get("soIncompletas") === "true");
  const [aguardandoDetalhes, setAguardandoDetalhes] = useState(searchParams.get("aguardandoDetalhes") === "true");
  const [busca, setBusca] = useState(searchParams.get("pedido") ?? "");
  const [buscaAplicada, setBuscaAplicada] = useState(searchParams.get("pedido") ?? "");
  const [vendas, setVendas] = useState<VendaLista[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [freteManual, setFreteManual] = useState("");
  const [motivoFrete, setMotivoFrete] = useState("");
  const [salvandoFrete, setSalvandoFrete] = useState(false);

  const [exportando, setExportando] = useState(false);
  const POR_PAGINA = 25;
  const filtrandoPorPedido = /^\d{8,}$/.test(buscaAplicada.trim());

  const montarParamsFiltro = useCallback(
    (porPagina: number) => {
      const params = new URLSearchParams({ pagina: "1", porPagina: String(porPagina) });
      if (!filtrandoPorPedido) {
        params.set("desde", periodo.desde.toISOString());
        params.set("ate", periodo.ate.toISOString());
      }
      if (status !== "todos") params.set("status", status);
      if (soPrejuizo) params.set("soPrejuizo", "true");
      if (soIncompletas) params.set("soIncompletas", "true");
      if (aguardandoDetalhes) params.set("aguardandoDetalhes", "true");
      if (produtoId) params.set("produtoId", produtoId);
      if (buscaAplicada.trim()) params.set("busca", buscaAplicada.trim());
      return params;
    },
    [periodo, status, soPrejuizo, soIncompletas, aguardandoDetalhes, produtoId, buscaAplicada, filtrandoPorPedido]
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = montarParamsFiltro(POR_PAGINA);
      params.set("pagina", String(pagina));

      const resposta = await fetch(`/api/financeiro/vendas?${params.toString()}`, { cache: "no-store" });
      if (resposta.ok) {
        const body = await resposta.json();
        setVendas(body.vendas);
        setTotal(body.total);
      }
    } finally {
      setCarregando(false);
    }
  }, [montarParamsFiltro, pagina]);

  useEffect(() => {
    if (podeVerFinanceiro) carregar();
  }, [podeVerFinanceiro, carregar]);

  useAoAtualizarDados(carregar);

  const [abriuPedidoDaUrl, setAbriuPedidoDaUrl] = useState(false);
  useEffect(() => {
    if (abriuPedidoDaUrl || !searchParams.get("pedido") || vendas.length !== 1) return;
    setAbriuPedidoDaUrl(true);
    abrirDetalhe(vendas[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendas, abriuPedidoDaUrl]);

  const abrirDetalhe = async (id: string) => {
    setCarregandoDetalhe(true);
    try {
      const resposta = await fetch(`/api/financeiro/vendas/${id}`, { cache: "no-store" });
      if (resposta.ok) {
        const detalhe: VendaDetalhe = await resposta.json();
        setVendaSelecionada(detalhe);
        setFreteManual(detalhe.freteAjusteManual != null ? String(detalhe.freteAjusteManual / 100) : "");
        setMotivoFrete(detalhe.freteAjusteManualMotivo ?? "");
      }
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const salvarFrete = async (limpar: boolean) => {
    if (!vendaSelecionada) return;
    setSalvandoFrete(true);
    try {
      const valor = Number(freteManual.replace(",", "."));
      const resposta = await fetch(`/api/financeiro/vendas/${vendaSelecionada.id}/frete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limpar ? { valorReais: null } : { valorReais: valor, motivo: motivoFrete }),
      });
      if (resposta.ok) {
        await abrirDetalhe(vendaSelecionada.id);
        sinalizarDadosAlterados();
      }
    } finally {
      setSalvandoFrete(false);
    }
  };

  const buscarTodasParaExportar = async (): Promise<VendaLista[]> => {
    const params = montarParamsFiltro(Math.max(total, 1));
    const resposta = await fetch(`/api/financeiro/vendas?${params.toString()}`, { cache: "no-store" });
    if (!resposta.ok) return [];
    const body = await resposta.json();
    return body.vendas as VendaLista[];
  };

  const linhaExportavel = (venda: VendaLista) => ({
    Pedido: venda.pedidoExternoId,
    Data: formatarDataHora(venda.dataVenda),
    Status: STATUS_ROTULO[venda.status] ?? venda.status,
    Logística: venda.logisticaRotulo,
    Faturamento: venda.calculo.valida ? venda.calculo.faturamento / 100 : venda.calculo.vendaBruta / 100,
    Tarifa: venda.calculo.tarifa / 100,
    Frete: venda.calculo.semFrete ? 0 : venda.calculo.frete / 100,
    Custo: venda.calculo.semCusto ? 0 : venda.calculo.cmv / 100,
    Margem: venda.calculo.margemContribuicao / 100,
  });

  const exportarXlsx = async () => {
    setExportando(true);
    try {
      const todasVendas = await buscarTodasParaExportar();
      exportToExcel(todasVendas.map(linhaExportavel), `vendas-${periodo.desde.toISOString().slice(0, 10)}`, "Vendas");
    } finally {
      setExportando(false);
    }
  };

  const exportarPdf = async () => {
    if (!canUsePDF()) return;
    setExportando(true);
    try {
      const todasVendas = await buscarTodasParaExportar();
      const doc = await loadPDF();
      doc.setFontSize(16);
      doc.text("Vendas", 14, 18);
      addTableToPDF(doc, {
        head: [["Pedido", "Data", "Status", "Faturamento", "Tarifa", "Frete", "Custo", "Margem"]],
        body: todasVendas.map((venda) => {
          const linha = linhaExportavel(venda);
          return [
            linha.Pedido,
            linha.Data,
            linha.Status,
            moeda(venda.calculo.valida ? venda.calculo.faturamento : venda.calculo.vendaBruta),
            moeda(venda.calculo.tarifa),
            venda.calculo.semFrete ? "—" : moeda(venda.calculo.frete),
            venda.calculo.semCusto ? "—" : moeda(venda.calculo.cmv),
            moeda(venda.calculo.margemContribuicao),
          ];
        }),
        startY: 28,
      });
      doc.save(`vendas-${periodo.desde.toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportando(false);
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
  const detalhe = vendaSelecionada;

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Vendas"
        subtitle="Cada pedido com faturamento, tarifas, frete, custo e margem — os mesmos números da Visão geral e da DRE."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportarXlsx} disabled={exportando || total === 0}>
              <Download className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPdf} disabled={exportando || total === 0}>
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
            <BotaoAtualizarFinanceiro modo="INCREMENTAL" />
          </div>
        }
      />

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <SeletorPeriodo valor={periodo} onChange={(p) => { setPeriodo(p); setPagina(1); }} />
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBuscaAplicada(busca);
              setPagina(1);
            }}
          >
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº do pedido, produto ou SKU"
              className="w-[240px]"
            />
            <Button type="submit" variant="outline" size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </form>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPagina(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_ROTULO).map(([valor, rotulo]) => (
                <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={soPrejuizo ? "default" : "outline"} size="sm" onClick={() => { setSoPrejuizo((v) => !v); setPagina(1); }}>
            Com prejuízo
          </Button>
          <Button variant={soIncompletas ? "default" : "outline"} size="sm" onClick={() => { setSoIncompletas((v) => !v); setPagina(1); }}>
            Sem custo/vínculo
          </Button>
          <Button variant={aguardandoDetalhes ? "default" : "outline"} size="sm" onClick={() => { setAguardandoDetalhes((v) => !v); setPagina(1); }}>
            Aguardando detalhes
          </Button>
          {(produtoId || buscaAplicada) && (
            <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setBuscaAplicada(""); router.push("/financeiro/vendas"); }}>
              Limpar filtros
            </Button>
          )}
        </div>
        {filtrandoPorPedido && (
          <p className="mt-2 text-xs text-muted-foreground">Buscando o pedido em qualquer data.</p>
        )}
      </SectionCard>

      <SectionCard title={`${total.toLocaleString("pt-BR")} venda(s)`}>
        {carregando && vendas.length === 0 ? (
          <Skeleton className="h-[400px] rounded-md" />
        ) : vendas.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma venda encontrada com esses filtros.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Pedido</DataTableHead>
                    <DataTableHead>Produto</DataTableHead>
                    <DataTableHead>Logística</DataTableHead>
                    <DataTableHead>Status</DataTableHead>
                    <DataTableHead className="text-right">Faturamento</DataTableHead>
                    <DataTableHead className="text-right">Tarifa</DataTableHead>
                    <DataTableHead className="text-right">Frete</DataTableHead>
                    <DataTableHead className="text-right">Custo</DataTableHead>
                    <DataTableHead className="text-right">Margem</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {vendas.map((venda) => {
                    const c = venda.calculo;
                    return (
                      <DataTableRow key={venda.id} className="cursor-pointer" onClick={() => abrirDetalhe(venda.id)}>
                        <DataTableCell>
                          <span className="font-mono text-xs">#{venda.pedidoExternoId}</span>
                          <div className="text-xs text-faint">{formatarDataHora(venda.dataVenda)}</div>
                        </DataTableCell>
                        <DataTableCell className="max-w-[260px]">
                          <span className="block truncate" title={venda.itens.map((i) => i.titulo).join(" + ")}>
                            {venda.itens.length > 1
                              ? `${venda.itens.length} itens · ${venda.itens[0].titulo}`
                              : venda.itens[0]?.titulo ?? "—"}
                          </span>
                          <span className="text-xs text-faint">
                            {c.unidades || venda.itens.reduce((s, i) => s + i.quantidade, 0)} un.
                            {venda.itens[0]?.sku ? ` · ${venda.itens[0].sku}` : ""}
                          </span>
                        </DataTableCell>
                        <DataTableCell>{venda.logisticaRotulo}</DataTableCell>
                        <DataTableCell>
                          <div className="flex flex-wrap gap-1">
                            <StatusPill tone={tomStatus(venda.status)}>{STATUS_ROTULO[venda.status] ?? venda.status}</StatusPill>
                            {c.aguardandoDetalhes && <StatusPill tone="info">Detalhando</StatusPill>}
                            {(c.semCusto || c.semVinculo) && <StatusPill tone="warning">{c.semVinculo ? "Sem vínculo" : "Sem custo"}</StatusPill>}
                          </div>
                        </DataTableCell>
                        <DataTableCell numeric>{moeda(c.valida ? c.faturamento : c.vendaBruta)}</DataTableCell>
                        <DataTableCell numeric>{moeda(c.tarifa)}</DataTableCell>
                        <DataTableCell numeric>{c.semFrete ? "—" : moeda(c.receitaFrete < 0 ? -c.receitaFrete : c.frete)}</DataTableCell>
                        <DataTableCell numeric>{c.semCusto ? "—" : moeda(c.cmv)}</DataTableCell>
                        <DataTableCell numeric emphasis>
                          <span className={c.margemContribuicao < 0 ? "text-destructive-text" : undefined}>{moeda(c.margemContribuicao)}</span>
                          <div className="text-[11px] text-faint">{percentual(c.margemContribuicaoPercentual)}</div>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </div>
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

      <Dialog open={!!detalhe || carregandoDetalhe} onOpenChange={(open) => !open && setVendaSelecionada(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe ? `Pedido #${detalhe.pedidoExternoId}` : "Carregando…"}</DialogTitle>
          </DialogHeader>
          {carregandoDetalhe && <Skeleton className="h-64 rounded-md" />}
          {detalhe && !carregandoDetalhe && (
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <StatusPill tone={tomStatus(detalhe.status)}>{STATUS_ROTULO[detalhe.status] ?? detalhe.status}</StatusPill>
                <span>{formatarDataHora(detalhe.dataVenda)}</span>
                <span>· {detalhe.logisticaRotulo}</span>
                {detalhe.pacoteExternoId && <span>· carrinho #{detalhe.pacoteExternoId}</span>}
              </div>

              <table className="w-full">
                <tbody>
                  {[
                    { rotulo: "Faturamento (preço × quantidade)", valor: detalhe.calculo.faturamento },
                    ...(detalhe.calculo.cancelamento > 0 ? [{ rotulo: "Cancelado/estornado", valor: -detalhe.calculo.cancelamento }] : []),
                    ...(detalhe.calculo.receitaFrete !== 0
                      ? [{ rotulo: detalhe.calculo.receitaFrete < 0 ? "(−) Frete descontado do faturamento" : "(+) Frete pago pelo comprador", valor: detalhe.calculo.receitaFrete }]
                      : []),
                    { rotulo: "(−) Imposto estimado", valor: -detalhe.calculo.imposto },
                    { rotulo: "(−) Tarifas", valor: -detalhe.calculo.tarifa },
                    ...(detalhe.calculo.frete !== 0 || detalhe.calculo.receitaFrete === 0 ? [{ rotulo: "(−) Frete", valor: -detalhe.calculo.frete }] : []),
                    ...(detalhe.calculo.ads > 0 ? [{ rotulo: "(−) Publicidade", valor: -detalhe.calculo.ads }] : []),
                    { rotulo: "(−) Custo do produto", valor: -detalhe.calculo.cmv },
                  ].map((linha) => (
                    <tr key={linha.rotulo} className="border-b border-divider">
                      <td className="py-1.5 text-muted-foreground">{linha.rotulo}</td>
                      <td className="py-1.5 text-right tabular-nums">{moeda(linha.valor)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">Margem de contribuição</td>
                    <td className={`py-2 text-right tabular-nums ${detalhe.calculo.margemContribuicao < 0 ? "text-destructive-text" : "text-success-text"}`}>
                      {moeda(detalhe.calculo.margemContribuicao)} · {percentual(detalhe.calculo.margemContribuicaoPercentual)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="grid gap-2 rounded-md border border-divider p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-faint">Líquido repassado pelo ML</p>
                  <p className="tabular-nums">{moeda(detalhe.valorLiquidoReceber)}</p>
                </div>
                <div>
                  <p className="text-xs text-faint">Liberação do dinheiro</p>
                  <p>
                    {detalhe.dataLiberacao ? formatarDataHora(detalhe.dataLiberacao) : "—"}
                    {detalhe.faltando.includes("LIBERACAO_ESTIMADA") ? " (estimada)" : ""}
                  </p>
                </div>
                {detalhe.retencaoDividas > 0 && (
                  <div className="sm:col-span-2 text-xs text-muted-foreground">
                    O ML reteve {moeda(detalhe.retencaoDividas)} desta venda para quitar a fatura. Isso afeta o caixa, não a margem da venda.
                  </div>
                )}
              </div>

              {detalhe.cobrancasPagamento.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Cobranças no pagamento (Mercado Pago)</p>
                  <table className="w-full text-xs">
                    <tbody>
                      {detalhe.cobrancasPagamento.map((c) => (
                        <tr key={c.id} className="border-b border-divider last:border-0">
                          <td className="py-1">{nomeCobranca(c.nome)}</td>
                          <td className="py-1 text-right tabular-nums">
                            {moeda(c.valor - c.estornado)}
                            {c.estornado > 0 && <span className="text-faint"> (estornado {moeda(c.estornado)})</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-md border border-divider p-3">
                <p className="text-xs text-faint">Frete do vendedor</p>
                <p>
                  {detalhe.freteVendedor != null ? moeda(detalhe.freteVendedor) : "—"}{" "}
                  <span className="text-xs text-muted-foreground">({ORIGEM_FRETE[detalhe.freteOrigem] ?? detalhe.freteOrigem})</span>
                </p>
                {detalhe.freteComprador > 0 && (
                  <p className="text-xs text-muted-foreground">O comprador pagou {moeda(detalhe.freteComprador)} de frete.</p>
                )}
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Input
                    value={freteManual}
                    onChange={(e) => setFreteManual(e.target.value)}
                    placeholder="Frete real (R$)"
                    className="w-[140px]"
                    inputMode="decimal"
                  />
                  <Input
                    value={motivoFrete}
                    onChange={(e) => setMotivoFrete(e.target.value)}
                    placeholder="Motivo do ajuste"
                    className="w-[220px]"
                  />
                  <Button size="sm" disabled={salvandoFrete || !freteManual || !motivoFrete.trim()} onClick={() => salvarFrete(false)}>
                    Ajustar frete
                  </Button>
                  {detalhe.freteAjusteManual != null && (
                    <Button size="sm" variant="ghost" disabled={salvandoFrete} onClick={() => salvarFrete(true)}>
                      Voltar ao valor do ML
                    </Button>
                  )}
                </div>
              </div>

              {(detalhe.enriquecimentoErro || detalhe.calculo.aguardandoDetalhes) && (
                <div className="rounded-md bg-info/10 p-3 text-xs text-info">
                  {detalhe.enriquecimentoErro
                    ? `Não foi possível buscar o pagamento desta venda: ${detalhe.enriquecimentoErro}`
                    : "Tarifa e frete ainda vêm do pedido; os valores confirmados pelo Mercado Pago chegam em instantes."}
                </div>
              )}

              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Item</DataTableHead>
                    <DataTableHead className="text-right">Qtd</DataTableHead>
                    <DataTableHead className="text-right">Preço</DataTableHead>
                    <DataTableHead className="text-right">Custo unit.</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {detalhe.itens.map((item) => (
                    <DataTableRow key={item.id}>
                      <DataTableCell>
                        {item.titulo}
                        <div className="text-xs text-faint">
                          {item.produto ? `Produto: ${item.produto.nome} (${item.produto.sku})` : "Sem produto vinculado"}
                        </div>
                      </DataTableCell>
                      <DataTableCell numeric>{item.quantidade}</DataTableCell>
                      <DataTableCell numeric>
                        {moeda(item.precoUnitario)}
                        {item.precoCheio != null && item.precoCheio > item.precoUnitario && (
                          <div className="text-[11px] text-faint line-through">{moeda(item.precoCheio)}</div>
                        )}
                      </DataTableCell>
                      <DataTableCell numeric>{moeda(item.custoUnitario)}</DataTableCell>
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
