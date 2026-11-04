"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { formatBRL, formatPercent, formatNumberBR } from "@/lib/format";
import { exportToExcel } from "@/utils/excelExport";
import { loadPDF, addTableToPDF, canUsePDF } from "@/utils/pdfHelper";
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "../../components/SeletorPeriodo";
import { useAcessoFinanceiro } from "../../components/useAcessoFinanceiro";
import { useAoAtualizarDados } from "../../components/SincronizacaoFinanceira";

interface LinhaProduto {
  produtoId: string;
  sku: string;
  nome: string;
  unidades: number;
  faturamentoBruto: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  custoFixoRateado: number;
  lucroLiquido: number;
  roiSobreCmv: number | null;
  tarifa: number;
  frete: number;
  ads: number;
  imposto: number;
  cmv: number;
  vendasSemCusto: number;
  curvaAbc: "A" | "B" | "C";
}

type CampoOrdenacao = "margemContribuicao" | "faturamentoBruto" | "lucroLiquido" | "unidades";

const TOM_ABC: Record<string, "success" | "info" | "neutral"> = { A: "success", B: "info", C: "neutral" };

export function AbaPorProduto() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const [periodo, setPeriodo] = useState<PeriodoSelecionado>({ preset: "mesAtual", ...periodoDoPreset("mesAtual") });
  const [ordenarPor, setOrdenarPor] = useState<CampoOrdenacao>("lucroLiquido");
  const [ordem, setOrdem] = useState<"asc" | "desc">("desc");
  const [produtos, setProdutos] = useState<LinhaProduto[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        desde: periodo.desde.toISOString(),
        ate: periodo.ate.toISOString(),
        ordenarPor,
        ordem,
      });
      const resposta = await fetch(`/api/financeiro/produtos?${params.toString()}`);
      if (resposta.ok) {
        const body = await resposta.json();
        setProdutos(body.produtos);
      }
    } catch (error) {
      console.error("Erro ao carregar lucro por produto:", error);
    } finally {
      setCarregando(false);
    }
  }, [periodo, ordenarPor, ordem]);

  useEffect(() => {
    if (podeVerFinanceiro) carregar();
  }, [podeVerFinanceiro, carregar]);

  useAoAtualizarDados(carregar);

  const alternarOrdenacao = (campo: CampoOrdenacao) => {
    if (ordenarPor === campo) {
      setOrdem((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setOrdenarPor(campo);
      setOrdem("desc");
    }
  };

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const produtosComMargemNegativa = produtos.filter((p) => p.margemContribuicao < 0);
  const produtosSemCusto = produtos.filter((p) => p.vendasSemCusto > 0);

  const linhaExportavel = (produto: LinhaProduto) => ({
    SKU: produto.sku,
    Produto: produto.nome,
    Unidades: produto.unidades,
    Faturamento: produto.faturamentoBruto / 100,
    Margem: produto.margemContribuicao / 100,
    "Tarifas + frete": (produto.tarifa + produto.frete) / 100,
    "Custo (CMV)": produto.cmv / 100,
    "Lucro líquido": produto.lucroLiquido / 100,
    ABC: produto.curvaAbc,
  });

  const exportarXlsx = () => {
    exportToExcel(produtos.map(linhaExportavel), `lucro-por-produto-${periodo.desde.toISOString().slice(0, 10)}`, "Produtos");
  };

  const exportarPdf = async () => {
    if (!canUsePDF()) return;
    const doc = await loadPDF();
    doc.setFontSize(16);
    doc.text("Lucro por produto", 14, 18);
    addTableToPDF(doc, {
      head: [["SKU", "Produto", "Unidades", "Faturamento", "Margem", "Custo (CMV)", "Lucro líquido", "ABC"]],
      body: produtos.map((produto) => [
        produto.sku,
        produto.nome,
        formatNumberBR(produto.unidades),
        formatBRL(produto.faturamentoBruto),
        formatBRL(produto.margemContribuicao),
        formatBRL(produto.cmv),
        formatBRL(produto.lucroLiquido),
        produto.curvaAbc,
      ]),
      startY: 28,
    });
    doc.save(`lucro-por-produto-${periodo.desde.toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Lucro por produto"
        subtitle="Margem de cada produto com a mesma regra da DRE (faturamento − impostos − tarifas − frete − ads − custo). O lucro líquido desconta a parte das despesas fixas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportarXlsx} disabled={produtos.length === 0}>
              <Download className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPdf} disabled={produtos.length === 0}>
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
            <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
          </div>
        }
      />

      {(produtosComMargemNegativa.length > 0 || produtosSemCusto.length > 0) && (
        <SectionCard contentClassName="space-y-1 text-sm">
          {produtosComMargemNegativa.length > 0 && (
            <div className="text-destructive-text">
              {produtosComMargemNegativa.length} produto(s) com margem de contribuição negativa no período.
            </div>
          )}
          {produtosSemCusto.length > 0 && (
            <div className="text-warning-text">
              {produtosSemCusto.length} produto(s) vendidos sem custo cadastrado: a margem deles aparece acima da real.
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title={`${produtos.length} produto(s)`}>
        {carregando ? (
          <Skeleton className="h-[400px] rounded-md" />
        ) : produtos.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem vendas no período selecionado.</div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead sticky>Produto</DataTableHead>
                <DataTableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => alternarOrdenacao("unidades")}>
                    Unidades <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </DataTableHead>
                <DataTableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => alternarOrdenacao("faturamentoBruto")}>
                    Faturamento <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </DataTableHead>
                <DataTableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => alternarOrdenacao("margemContribuicao")}>
                    Margem <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </DataTableHead>
                <DataTableHead className="text-right">Tarifas + frete</DataTableHead>
                <DataTableHead className="text-right">Custo (CMV)</DataTableHead>
                <DataTableHead className="text-right">ROI/CMV</DataTableHead>
                <DataTableHead className="text-right">
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => alternarOrdenacao("lucroLiquido")}>
                    Lucro líquido <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </DataTableHead>
                <DataTableHead>ABC</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {produtos.map((produto) => (
                <DataTableRow key={produto.produtoId}>
                  <DataTableCell sticky>
                    <Link href={`/produtos/${produto.produtoId}`} className="hover:underline">
                      {produto.nome} <span className="text-muted-foreground">({produto.sku})</span>
                    </Link>
                  </DataTableCell>
                  <DataTableCell numeric>{formatNumberBR(produto.unidades)}</DataTableCell>
                  <DataTableCell numeric>{formatBRL(produto.faturamentoBruto)}</DataTableCell>
                  <DataTableCell numeric className={produto.margemContribuicao < 0 ? "text-destructive-text" : undefined}>
                    {formatBRL(produto.margemContribuicao)}
                    {produto.margemContribuicaoPercentual != null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatPercent(produto.margemContribuicaoPercentual * 100)})
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell numeric>{formatBRL(produto.tarifa + produto.frete)}</DataTableCell>
                  <DataTableCell numeric>
                    {formatBRL(produto.cmv)}
                    {produto.vendasSemCusto > 0 && (
                      <StatusPill tone="warning" className="ml-1">sem custo</StatusPill>
                    )}
                  </DataTableCell>
                  <DataTableCell numeric>{produto.roiSobreCmv != null ? formatPercent(produto.roiSobreCmv * 100) : "—"}</DataTableCell>
                  <DataTableCell numeric emphasis>{formatBRL(produto.lucroLiquido)}</DataTableCell>
                  <DataTableCell>
                    <StatusPill tone={TOM_ABC[produto.curvaAbc]}>{produto.curvaAbc}</StatusPill>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>
    </div>
  );
}
