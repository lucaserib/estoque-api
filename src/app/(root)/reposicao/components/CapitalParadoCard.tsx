"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface ProdutoCapitalParado {
  produtoId: string;
  nome: string;
  sku: string;
  estoqueLocal: number;
  custoMedio: number | null;
  valorParado: number | null;
  ultimaVenda: string | null;
  diasSemVenda: number | null;
}

interface CapitalParadoResponse {
  produtos: ProdutoCapitalParado[];
  valorTotalParado: number | null;
  limiteDias: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100
  );

export function CapitalParadoCard() {
  const [limiteDias, setLimiteDias] = useState("60");
  const [dados, setDados] = useState<CapitalParadoResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/replenishment/capital-parado?limiteDias=${limiteDias}`)
      .then((r) => r.json())
      .then(setDados)
      .finally(() => setLoading(false));
  }, [limiteDias]);

  return (
    <SectionCard
      title="Capital parado"
      description="Produtos sem venda no período, valorizados pelo custo médio"
      actions={
        <Select value={limiteDias} onValueChange={setLimiteDias}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="60">Sem venda há 60d+</SelectItem>
            <SelectItem value="90">Sem venda há 90d+</SelectItem>
          </SelectContent>
        </Select>
      }
      contentClassName={(dados?.produtos?.length || 0) === 0 ? undefined : "p-0"}
    >
      {loading ? (
        <Skeleton className="h-32 rounded-md" />
      ) : !dados || dados.produtos.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum produto parado nesse período.
        </div>
      ) : (
        <>
          {dados.valorTotalParado != null && (
            <div className="px-4 pt-4 text-sm text-muted-foreground">
              Valor total parado: <span className="font-semibold text-foreground">{formatCurrency(dados.valorTotalParado)}</span>
            </div>
          )}
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead sticky>Produto</DataTableHead>
                <DataTableHead className="text-right">Estoque local</DataTableHead>
                <DataTableHead className="text-right">Última venda</DataTableHead>
                <DataTableHead className="text-right">Dias sem venda</DataTableHead>
                <DataTableHead className="text-right pr-4">Valor parado</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {dados.produtos.map((p) => (
                <DataTableRow key={p.produtoId}>
                  <DataTableCell sticky>
                    <p className="font-medium text-foreground">{p.nome}</p>
                    <p className="text-sm text-muted-foreground">SKU: {p.sku}</p>
                  </DataTableCell>
                  <DataTableCell numeric>{p.estoqueLocal}</DataTableCell>
                  <DataTableCell numeric>
                    {p.ultimaVenda
                      ? new Date(p.ultimaVenda + "T00:00:00").toLocaleDateString("pt-BR")
                      : "nunca"}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {p.diasSemVenda != null ? `${p.diasSemVenda}d` : "—"}
                  </DataTableCell>
                  <DataTableCell numeric className="pr-4">
                    {p.valorParado != null ? (
                      <span className="font-medium text-foreground">
                        {formatCurrency(p.valorParado)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </>
      )}
    </SectionCard>
  );
}
