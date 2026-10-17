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
  faturamentoBruto: number;
  cancelamentosEDevolucoes: number;
  descontos: number;
  descontoCusteadoPeloMl: number;
  receitaOperacionalBruta: number;
  impostosSobreVendas: number;
  receitaLiquida: number;
  custosVariaveis: {
    tarifas: number;
    frete: number;
    publicidade: number;
    armazenagemFull: number;
    outrasTarifasNaoMapeadas: number;
    freteDevolucaoEOutros: number;
    total: number;
  };
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  despesasOperacionais: ItemDespesaOperacional[];
  totalDespesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  impostoLucro: number;
  lucroLiquido: number;
  lucroLiquidoPercentual: number | null;
}

const MESES_LABEL = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function mesAtualString(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

interface LinhaExibicao {
  rotulo: string;
  negrito?: boolean;
  valores: number[];
  percentuais?: Array<number | null>;
}

function montarLinhas(meses: DreMensal[]): LinhaExibicao[] {
  const nomesDespesas = [
    ...new Set(meses.flatMap((m) => m.despesasOperacionais.map((d) => d.nome))),
  ];

  return [
    { rotulo: "Faturamento bruto", valores: meses.map((m) => m.faturamentoBruto) },
    { rotulo: "(−) Cancelamentos e devoluções", valores: meses.map((m) => -m.cancelamentosEDevolucoes) },
    { rotulo: "(=) Receita operacional bruta", negrito: true, valores: meses.map((m) => m.receitaOperacionalBruta) },
    { rotulo: "Descontos concedidos em campanhas (já deduzidos do preço, informativo)", valores: meses.map((m) => m.descontos) },
    { rotulo: "   dos quais o Mercado Livre bancou", valores: meses.map((m) => m.descontoCusteadoPeloMl) },
    { rotulo: "(−) Impostos sobre vendas", valores: meses.map((m) => -m.impostosSobreVendas) },
    { rotulo: "(=) Receita líquida", negrito: true, valores: meses.map((m) => m.receitaLiquida) },
    { rotulo: "(−) Tarifas de marketplace", valores: meses.map((m) => -m.custosVariaveis.tarifas) },
    { rotulo: "(−) Frete pago pelo vendedor", valores: meses.map((m) => -m.custosVariaveis.frete) },
    { rotulo: "(−) Publicidade", valores: meses.map((m) => -m.custosVariaveis.publicidade) },
    { rotulo: "(−) Armazenagem Full", valores: meses.map((m) => -m.custosVariaveis.armazenagemFull) },
    { rotulo: "(−) Outras tarifas não mapeadas", valores: meses.map((m) => -m.custosVariaveis.outrasTarifasNaoMapeadas) },
    { rotulo: "(−) CMV", valores: meses.map((m) => -m.cmv) },
    {
      rotulo: "(=) Margem de contribuição",
      negrito: true,
      valores: meses.map((m) => m.margemContribuicao),
      percentuais: meses.map((m) => m.margemContribuicaoPercentual),
    },
    ...nomesDespesas.map((nome) => ({
      rotulo: `(−) ${nome}`,
      valores: meses.map((m) => -(m.despesasOperacionais.find((d) => d.nome === nome)?.valor ?? 0)),
    })),
    { rotulo: "(=) Resultado operacional (EBITDA)", negrito: true, valores: meses.map((m) => m.resultadoOperacional) },
    { rotulo: "(+/−) Resultado financeiro", valores: meses.map((m) => m.resultadoFinanceiro) },
    { rotulo: "(−) IR/CSLL", valores: meses.map((m) => -m.impostoLucro) },
    {
      rotulo: "(=) Lucro líquido",
      negrito: true,
      valores: meses.map((m) => m.lucroLiquido),
      percentuais: meses.map((m) => m.lucroLiquidoPercentual),
    },
  ];
}

export default function DrePage() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const [ate, setAte] = useState(mesAtualString());
  const [quantidadeDeMeses, setQuantidadeDeMeses] = useState("6");
  const [dre, setDre] = useState<DreMensal[] | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/financeiro/dre?ate=${ate}&meses=${quantidadeDeMeses}`);
      if (resposta.ok) {
        const body = await resposta.json();
        setDre(body.meses);
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

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const linhas = dre ? montarLinhas(dre) : [];
  const cabecalhos = dre?.map((m) => `${MESES_LABEL[m.competencia.mes - 1]}/${String(m.competencia.ano).slice(2)}`) ?? [];

  const [anoAte, mesAte] = ate.split("-").map(Number);
  const atePeriodo = new Date(Date.UTC(anoAte, mesAte, 0, 23, 59, 59, 999));
  const desdePeriodo = new Date(Date.UTC(anoAte, mesAte - Number(quantidadeDeMeses), 1));

  const exportarXlsx = () => {
    if (!dre) return;
    const dados = linhas.map((linha) => {
      const linhaExportada: Record<string, string | number> = { Linha: linha.rotulo };
      linha.valores.forEach((valor, i) => {
        linhaExportada[cabecalhos[i]] = valor / 100;
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
      body: linhas.map((linha) => [linha.rotulo, ...linha.valores.map((v) => formatBRL(v))]),
      startY: 28,
    });
    doc.save(`dre-${ate}.pdf`);
  };

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="DRE"
        subtitle="Demonstração de resultado por competência, com comparativo mensal e análise vertical."
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
            <BotaoAtualizarFinanceiro modo="PERIODO" desde={desdePeriodo} ate={atePeriodo} onConcluido={carregar} />
          </div>
        }
      />

      <SectionCard title="Demonstração de resultado" description="Valores em R$; % sobre a receita líquida quando aplicável">
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
                    <DataTableCell sticky emphasis={linha.negrito}>{linha.rotulo}</DataTableCell>
                    {linha.valores.map((valor, i) => (
                      <DataTableCell key={i} numeric emphasis={linha.negrito}>
                        {formatBRL(valor)}
                        {linha.percentuais?.[i] != null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatPercent(linha.percentuais[i]! * 100)})
                          </span>
                        )}
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
