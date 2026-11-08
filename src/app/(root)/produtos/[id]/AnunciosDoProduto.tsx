"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { ProductImage } from "@/components/ui/product-image";
import { calcularMargemUnitaria } from "@/lib/margem";
import { formatBRL } from "@/lib/format";
import { VincularAnuncioDialog, type AnuncioParaVincular, type VinculoAtual } from "@/components/catalogo/VincularAnuncioDialog";

export interface AnuncioFicha {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlSellerSku?: string | null;
  mlStatus: string;
  mlPrice: number | null;
  mlAvailableQuantity: number;
  mlPermalink: string | null;
  mlThumbnail: string | null;
  mlTarifaVenda?: number | null;
  mlCustoFrete?: number | null;
}

export interface AnuncioViaKit extends AnuncioFicha {
  kit: { id: string; nome: string; sku: string; ativo: boolean; kitDeQuantidade: boolean };
  unidadesPorVenda: number;
}

interface Props {
  produto: { id: string; nome: string; sku: string; isKit?: boolean; custoMedio?: number | null };
  anuncios: AnuncioFicha[];
  anunciosViaKit: AnuncioViaKit[];
  aliquotaImposto: number;
  onAlterado: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  closed: "Encerrado",
  under_review: "Em revisão",
};

export function AnunciosDoProduto({ produto, anuncios, anunciosViaKit, aliquotaImposto, onAlterado }: Props) {
  const [editando, setEditando] = useState<{ anuncio: AnuncioParaVincular; vinculo: VinculoAtual | null } | null>(null);

  const linhas = [
    ...anuncios.map((a) => ({ anuncio: a, unidades: 1, kit: null as AnuncioViaKit["kit"] | null })),
    ...anunciosViaKit.map((a) => ({ anuncio: a, unidades: a.unidadesPorVenda, kit: a.kit })),
  ];

  if (linhas.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Nenhum anúncio vende este produto ainda.{" "}
        <Link href="/mercado-livre/produtos?status=active" className="font-medium text-primary hover:underline">
          Vincular em Anúncios e vínculos
        </Link>
      </div>
    );
  }

  return (
    <>
      <DataTable>
        <DataTableHeader>
          <DataTableRow>
            <DataTableHead>Anúncio</DataTableHead>
            <DataTableHead>Vende</DataTableHead>
            <DataTableHead className="text-right">Preço</DataTableHead>
            <DataTableHead className="text-right">Margem / venda</DataTableHead>
            <DataTableHead className="text-right">Estoque ML</DataTableHead>
            <DataTableHead className="text-right" />
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody>
          {linhas.map(({ anuncio, unidades, kit }) => {
            const custoPorVenda =
              produto.custoMedio != null && kit?.kitDeQuantidade !== false ? produto.custoMedio * unidades : null;
            const margem = calcularMargemUnitaria({
              precoVenda: anuncio.mlPrice,
              tarifa: anuncio.mlTarifaVenda ?? null,
              frete: anuncio.mlCustoFrete ?? null,
              custo: kit && !kit.kitDeQuantidade ? null : custoPorVenda,
              aliquotaImposto,
            });
            const vinculoAtual: VinculoAtual = {
              produtoBaseId: produto.id,
              produtoBaseNome: produto.nome,
              produtoBaseSku: produto.sku,
              unidadesPorVenda: kit?.kitDeQuantidade ? unidades : 1,
            };
            return (
              <DataTableRow key={anuncio.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <ProductImage src={anuncio.mlThumbnail} alt={anuncio.mlTitle} size={36} />
                    <div className="min-w-0">
                      <p className="max-w-[260px] truncate text-sm">{anuncio.mlTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {anuncio.mlItemId} · {STATUS_LABEL[anuncio.mlStatus] ?? anuncio.mlStatus}
                      </p>
                    </div>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  {kit ? (
                    kit.kitDeQuantidade ? (
                      <Badge variant="outline">{unidades} un. por venda</Badge>
                    ) : (
                      <Link href={`/produtos/${kit.id}`} className="text-sm text-primary hover:underline">
                        {unidades}× no kit {kit.nome}
                      </Link>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">1 un.</span>
                  )}
                </DataTableCell>
                <DataTableCell numeric>{anuncio.mlPrice != null ? formatBRL(anuncio.mlPrice) : "—"}</DataTableCell>
                <DataTableCell numeric>
                  {kit && !kit.kitDeQuantidade ? (
                    <span className="text-xs text-muted-foreground">ver no kit</span>
                  ) : margem.completo ? (
                    <span className={margem.margemValor! < 0 ? "font-medium text-destructive-text" : "font-medium text-success-text"}>
                      {formatBRL(margem.margemValor!)} ({(margem.margemPercentual! * 100).toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground" title={`Faltando: ${margem.faltando.join(", ")}`}>
                      falta {margem.faltando.join(", ").toLowerCase()}
                    </span>
                  )}
                </DataTableCell>
                <DataTableCell numeric>{anuncio.mlAvailableQuantity}</DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {(!kit || kit.kitDeQuantidade) && !produto.isKit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        title="Editar vínculo"
                        onClick={() =>
                          setEditando({
                            anuncio: {
                              id: anuncio.id,
                              mlItemId: anuncio.mlItemId,
                              mlTitle: anuncio.mlTitle,
                              mlPrice: anuncio.mlPrice,
                              mlThumbnail: anuncio.mlThumbnail,
                              mlSellerSku: anuncio.mlSellerSku,
                            },
                            vinculo: vinculoAtual,
                          })
                        }
                      >
                        <Link2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Vínculo</span>
                      </Button>
                    )}
                    {anuncio.mlPermalink && (
                      <a
                        href={anuncio.mlPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 px-2 text-sm text-primary hover:underline"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>

      <VincularAnuncioDialog
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        anuncio={editando?.anuncio ?? null}
        vinculoAtual={editando?.vinculo ?? null}
        onSalvo={onAlterado}
      />
    </>
  );
}
