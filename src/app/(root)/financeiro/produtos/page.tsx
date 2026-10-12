"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
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
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "../components/SeletorPeriodo";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";

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
  curvaAbc: "A" | "B" | "C";
}

type CampoOrdenacao = "margemContribuicao" | "faturamentoBruto" | "lucroLiquido" | "unidades";

const TOM_ABC: Record<string, "success" | "info" | "neutral"> = { A: "success", B: "info", C: "neutral" };

export default function LucroPorProdutoPage() {
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
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const produtosComMargemNegativa = produtos.filter((p) => p.margemContribuicao < 0);

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Lucro por produto"
        subtitle="Curva ABC e margem por SKU no período."
        actions={<SeletorPeriodo valor={periodo} onChange={setPeriodo} />}
      />

      {produtosComMargemNegativa.length > 0 && (
        <SectionCard>
          <div className="text-sm text-destructive">
            {produtosComMargemNegativa.length} produto(s) com margem de contribuição negativa no período.
          </div>
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
                  <DataTableCell numeric className={produto.margemContribuicao < 0 ? "text-destructive" : undefined}>
                    {formatBRL(produto.margemContribuicao)}
                    {produto.margemContribuicaoPercentual != null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatPercent(produto.margemContribuicaoPercentual * 100)})
                      </span>
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
