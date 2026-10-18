"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { formatBRL, formatPercent } from "@/lib/format";
import { inicioDoMes, fimDoMes } from "@/modules/financeiro/dominio/periodo";
import { useAoAtualizarDados } from "../components/SincronizacaoFinanceira";
import { exportToExcel } from "@/utils/excelExport";
import { loadPDF, addTableToPDF, canUsePDF } from "@/utils/pdfHelper";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";
import { BotaoAtualizarFinanceiro } from "../components/BotaoAtualizarFinanceiro";

interface ItemDespesaOperacional {
  categoriaId: string;
  nome: string;
  valor: number;
}

interface DreMensal {
  competencia: { ano: number; mes: number };
  pedidos: number;
  pedidosCancelados: number;
  unidades: number;
  vendasBrutas: number;
  cancelamentosEDevolucoes: number;
  faturamento: number;
  receitaFrete: number;
  outrasReceitas: number;
  receitaTotal: number;
  impostosSobreVendas: number;
  receitaLiquida: number;
  custosVariaveis: {
    tarifas: number;
    frete: number;
    ads: number;
    armazenagemFull: number;
    outrasCobrancas: number;
    outrosCustos: number;
    lancamentos: number;
    total: number;
  };
  origemAds: "ADS_DIARIO" | "FATURA" | "NENHUM";
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  despesasOperacionais: ItemDespesaOperacional[];
  totalDespesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  resultadoNaoOperacional: number;
  impostoLucro: number;
  lucroLiquido: number;
  lucroLiquidoPercentual: number | null;
  ticketMedio: number | null;
  descontoCampanha: number;
  descontoCusteadoPeloMl: number;
  qualidade: {
    vendasSemCusto: number;
    faturamentoSemCusto: number;
    vendasAguardandoDetalhes: number;
    vendasSemVinculo: number;
  };
}

const MESES_LABEL = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function mesAtualString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(
    new Date()
  );
}

type TipoLinha = "valor" | "subtotal" | "info" | "contagem";

interface LinhaExibicao {
  rotulo: string;
  tipo: TipoLinha;
  valores: number[];
  ocultarSeZerada?: boolean;
  dica?: string;
}

function montarLinhas(meses: DreMensal[]): LinhaExibicao[] {
  const nomesDespesas = [...new Set(meses.flatMap((m) => m.despesasOperacionais.map((d) => d.nome)))];
  const cobrancas = (m: DreMensal) =>
    m.custosVariaveis.armazenagemFull + m.custosVariaveis.outrasCobrancas + m.custosVariaveis.outrosCustos;

  return [
    { rotulo: "Pedidos", tipo: "contagem", valores: meses.map((m) => m.pedidos) },
    { rotulo: "Unidades vendidas", tipo: "contagem", valores: meses.map((m) => m.unidades) },
    { rotulo: "Vendas brutas (todos os pedidos)", tipo: "valor", valores: meses.map((m) => m.vendasBrutas) },
    { rotulo: "(−) Cancelamentos e devoluções", tipo: "valor", valores: meses.map((m) => -m.cancelamentosEDevolucoes), ocultarSeZerada: true },
    { rotulo: "(=) Faturamento", tipo: "subtotal", valores: meses.map((m) => m.faturamento), dica: "Igual ao painel de vendas do Mercado Livre." },
    { rotulo: "(±) Frete no faturamento", tipo: "valor", valores: meses.map((m) => m.receitaFrete), ocultarSeZerada: true, dica: "Conforme o modo de faturamento em Configurações." },
    { rotulo: "(+) Outras receitas", tipo: "valor", valores: meses.map((m) => m.outrasReceitas), ocultarSeZerada: true },
    { rotulo: "(=) Receita bruta", tipo: "subtotal", valores: meses.map((m) => m.receitaTotal) },
    { rotulo: "(−) Impostos sobre vendas", tipo: "valor", valores: meses.map((m) => -m.impostosSobreVendas) },
    { rotulo: "(=) Receita líquida", tipo: "subtotal", valores: meses.map((m) => m.receitaLiquida) },
    { rotulo: "(−) Tarifas do Mercado Livre", tipo: "valor", valores: meses.map((m) => -m.custosVariaveis.tarifas) },
    { rotulo: "(−) Frete", tipo: "valor", valores: meses.map((m) => -m.custosVariaveis.frete), ocultarSeZerada: true },
    { rotulo: "(−) Publicidade", tipo: "valor", valores: meses.map((m) => -m.custosVariaveis.ads), ocultarSeZerada: true },
    { rotulo: "(−) Fatura do ML (Full e outras cobranças)", tipo: "valor", valores: meses.map((m) => -cobrancas(m)), ocultarSeZerada: true },
    { rotulo: "(−) Outros custos variáveis lançados", tipo: "valor", valores: meses.map((m) => -m.custosVariaveis.lancamentos), ocultarSeZerada: true },
    { rotulo: "(−) Custo das mercadorias (CMV)", tipo: "valor", valores: meses.map((m) => -m.cmv) },
    { rotulo: "(=) Margem de contribuição", tipo: "subtotal", valores: meses.map((m) => m.margemContribuicao) },
    ...nomesDespesas.map((nome) => ({
      rotulo: `(−) ${nome}`,
      tipo: "valor" as const,
      valores: meses.map((m) => -(m.despesasOperacionais.find((d) => d.nome === nome)?.valor ?? 0)),
    })),
    { rotulo: "(=) Resultado operacional", tipo: "subtotal", valores: meses.map((m) => m.resultadoOperacional) },
    { rotulo: "(±) Resultado financeiro", tipo: "valor", valores: meses.map((m) => m.resultadoFinanceiro), ocultarSeZerada: true },
    { rotulo: "(±) Não operacional", tipo: "valor", valores: meses.map((m) => m.resultadoNaoOperacional), ocultarSeZerada: true },
    { rotulo: "(−) IR/CSLL", tipo: "valor", valores: meses.map((m) => -m.impostoLucro), ocultarSeZerada: true },
    { rotulo: "(=) Lucro líquido", tipo: "subtotal", valores: meses.map((m) => m.lucroLiquido) },
    { rotulo: "Desconto de campanha embutido nos preços (informativo)", tipo: "info", valores: meses.map((m) => m.descontoCampanha), ocultarSeZerada: true },
  ].filter((linha) => !linha.ocultarSeZerada || linha.valores.some((v) => v !== 0)) as LinhaExibicao[];
}

function formatarCelula(linha: LinhaExibicao, valor: number): string {
  return linha.tipo === "contagem" ? valor.toLocaleString("pt-BR") : formatBRL(valor);
}

export default function DrePage() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const [ate, setAte] = useState(mesAtualString());
  const [quantidadeDeMeses, setQuantidadeDeMeses] = useState("6");
  const [dre, setDre] = useState<DreMensal[] | null>(null);
  const [modoFaturamento, setModoFaturamento] = useState<string>("PRODUTOS");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/financeiro/dre?ate=${ate}&meses=${quantidadeDeMeses}`);
      if (resposta.ok) {
        const body = await resposta.json();
        setDre(body.meses);
        setModoFaturamento(body.modoFaturamento ?? "PRODUTOS");
      }
    } catch (error) {
      console.error("Erro ao carregar a DRE:", error);
    } finally {
      setCarregando(false);
    }
  }, [ate, quantidadeDeMeses]);

  useEffect(() => {
    if (podeVerFinanceiro) carregar();
  }, [podeVerFinanceiro, carregar]);

  useAoAtualizarDados(carregar);

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const comTotal = (dre?.length ?? 0) > 1;
  const linhasBase = dre ? montarLinhas(dre) : [];
  const linhas = comTotal
    ? linhasBase.map((l) => ({ ...l, valores: [...l.valores, l.valores.reduce((s, v) => s + v, 0)] }))
    : linhasBase;
  const cabecalhos = [
    ...(dre?.map((m) => `${MESES_LABEL[m.competencia.mes - 1]}/${String(m.competencia.ano).slice(2)}`) ?? []),
    ...(comTotal ? ["Total"] : []),
  ];
  const baseFaturamento = linhas.find((l) => l.rotulo === "(=) Receita bruta")?.valores ?? [];

  const [anoAte, mesAte] = ate.split("-").map(Number);
  const atePeriodo = fimDoMes(new Date(Date.UTC(anoAte, mesAte - 1, 15, 12)));
  const desdePeriodo = inicioDoMes(new Date(Date.UTC(anoAte, mesAte - Number(quantidadeDeMeses), 15, 12)));
  const pendencias = dre
    ? {
        semCusto: dre.reduce((s, m) => s + m.qualidade.vendasSemCusto, 0),
        faturamentoSemCusto: dre.reduce((s, m) => s + m.qualidade.faturamentoSemCusto, 0),
        aguardando: dre.reduce((s, m) => s + m.qualidade.vendasAguardandoDetalhes, 0),
        semDespesas: dre.every((m) => m.totalDespesasOperacionais === 0),
      }
    : null;

  const exportarXlsx = () => {
    if (!dre) return;
    const dados = linhas.map((linha) => {
      const linhaExportada: Record<string, string | number> = { Linha: linha.rotulo };
      linha.valores.forEach((valor, i) => {
        linhaExportada[cabecalhos[i]] = linha.tipo === "contagem" ? valor : valor / 100;
      });
      return linhaExportada;
    });
    exportToExcel(dados, `dre-${ate}`, "DRE");
  };

  const exportarPdf = async () => {
    if (!dre || !canUsePDF()) return;
    const doc = await loadPDF();
    doc.setFontSize(16);
    doc.text(`DRE até ${ate}`, 14, 18);
    addTableToPDF(doc, {
      head: [["Linha", ...cabecalhos]],
      body: linhas.map((linha) => [linha.rotulo, ...linha.valores.map((v) => formatarCelula(linha, v))]),
      startY: 28,
    });
    doc.save(`dre-${ate}.pdf`);
  };

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="DRE"
        subtitle="Resultado mês a mês pela data de criação do pedido (fuso de Brasília), com % sobre a receita bruta."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm"
            />
            <Select value={quantidadeDeMeses} onValueChange={setQuantidadeDeMeses}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mês</SelectItem>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportarXlsx} disabled={!dre}>
              <Download className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPdf} disabled={!dre}>
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
            <BotaoAtualizarFinanceiro modo="PERIODO" desde={desdePeriodo} ate={atePeriodo} />
          </div>
        }
      />

      {pendencias && (pendencias.semCusto > 0 || pendencias.aguardando > 0 || pendencias.semDespesas) && (
        <SectionCard contentClassName="space-y-1 text-sm text-warning">
          {pendencias.semCusto > 0 && (
            <p>
              {pendencias.semCusto} venda(s) sem custo do produto ({formatBRL(pendencias.faturamentoSemCusto)} de faturamento):
              o CMV dessas vendas está zerado e o lucro aparece maior que o real.
            </p>
          )}
          {pendencias.aguardando > 0 && (
            <p>{pendencias.aguardando} venda(s) ainda recebendo tarifa e frete reais do Mercado Pago — os valores se ajustam sozinhos.</p>
          )}
          {pendencias.semDespesas && (
            <p className="text-muted-foreground">
              Nenhuma despesa operacional lançada no período: o lucro líquido é igual à margem de contribuição.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="Demonstração de resultado"
        description={`Valores em R$ · % sobre a receita bruta · faturamento ${modoFaturamento === "PRODUTOS" ? "só de produtos (igual ao ML)" : modoFaturamento === "PRODUTOS_MENOS_FRETE" ? "líquido de frete" : "com o frete do comprador"} (Configurações)`}
      >
        {carregando ? (
          <Skeleton className="h-[400px] rounded-md" />
        ) : !dre || dre.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem dados para o período selecionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead sticky>Linha</DataTableHead>
                  {cabecalhos.map((cabecalho) => (
                    <DataTableHead key={cabecalho} className="text-right">{cabecalho}</DataTableHead>
                  ))}
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {linhas.map((linha) => (
                  <DataTableRow key={linha.rotulo}>
                    <DataTableCell
                      sticky
                      emphasis={linha.tipo === "subtotal"}
                      className={linha.tipo === "info" ? "text-xs text-muted-foreground" : undefined}
                      title={linha.dica}
                    >
                      {linha.rotulo}
                    </DataTableCell>
                    {linha.valores.map((valor, i) => (
                      <DataTableCell
                        key={i}
                        numeric
                        emphasis={linha.tipo === "subtotal"}
                        className={linha.tipo === "info" ? "text-xs text-muted-foreground" : undefined}
                      >
                        {formatarCelula(linha, valor)}
                        {linha.tipo !== "contagem" && linha.tipo !== "info" && baseFaturamento[i] ? (
                          <span className="ml-1.5 text-[11px] text-faint">
                            {formatPercent((valor / baseFaturamento[i]) * 100)}
                          </span>
                        ) : null}
                      </DataTableCell>
                    ))}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
