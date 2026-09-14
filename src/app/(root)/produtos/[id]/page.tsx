"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ImageOff,
  ExternalLink,
  Star,
  Pencil,
  Link2,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { formatBRL, formatDateBR } from "@/lib/format";
import { ProdutoEditarDialog } from "../components/dialogs/ProdutoEditarDialog";
import { ProdutoFornecedorDialog } from "../components/dialogs/ProdutoFornecedorDialog";
import { ProdutoEstoqueDialog } from "../components/dialogs/ProdutoEstoqueDialog";
import type { Produto } from "../types";

interface ProdutoFicha extends Produto {
  descricao?: string | null;
  marca?: string | null;
  categoria?: string | null;
  pesoGramas?: number | null;
  alturaCm?: number | null;
  larguraCm?: number | null;
  comprimentoCm?: number | null;
  ProdutoMercadoLivre?: Array<{
    mlItemId: string;
    mlTitle: string;
    mlAvailableQuantity: number;
    mlSoldQuantity: number;
    mlSold90Days: number | null;
    mlStatus: string;
    mlPrice: number | null;
    mlPermalink: string | null;
    mlThumbnail: string | null;
  }>;
  fornecedores?: Array<{
    id: number;
    preco: number;
    multiplicador: number;
    prazoEntregaDias: number | null;
    precoUnitario: number | null;
    quantidadeMinima: number | null;
    principal: boolean;
    codigoNoFornecedor: string | null;
    fornecedor: { id: string; nome: string; cnpj: string | null; contato: string | null };
  }>;
  pedidos?: Array<{
    quantidade: number;
    custo: number;
    pedido: {
      id: number;
      status: string;
      dataConclusao: string | null;
      fornecedor: { nome: string };
    };
  }>;
  detalhesSaida?: Array<{
    quantidade: number;
    isKit: boolean;
    saida: { id: string; data: string };
  }>;
}

interface StockItem {
  produtoId: string;
  armazemId: string;
  quantidade: number;
  estoqueSeguranca?: number;
  armazem?: { id: string; nome: string };
}

export default function ProdutoFichaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [produto, setProduto] = useState<ProdutoFicha | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockDetails, setStockDetails] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  const loadProduto = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/produtos/${params.id}`);
      if (!response.ok) {
        setProduto(null);
        return;
      }
      const data = await response.json();
      setProduto(data.produto);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadProduto();
  }, [loadProduto]);

  const loadStockDetails = useCallback(async () => {
    setLoadingStock(true);
    try {
      const response = await fetch(`/api/estoque/produto/${params.id}`);
      if (response.ok) {
        setStockDetails(await response.json());
      }
    } finally {
      setLoadingStock(false);
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="container mx-auto max-w-5xl p-6">
        <PageHeader title="Produto não encontrado" />
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Este produto não existe ou não pertence à sua conta.
            <div className="mt-4">
              <Link href="/produtos">
                <Button variant="outline">Voltar para Produtos</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const estoqueLocalTotal = (produto.estoques || []).reduce(
    (sum, e) => sum + e.quantidade,
    0
  );

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      <PageHeader
        title={produto.nome}
        subtitle={`SKU ${produto.sku}`}
        actions={
          <Button variant="outline" onClick={() => router.push("/produtos")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-6 pt-6">
          {produto.imagemUrl ? (
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              <Image
                src={produto.imagemUrl}
                alt={produto.nome}
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <ImageOff className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{produto.nome}</h2>
              {!produto.ativo && <Badge variant="outline">Inativo</Badge>}
              {produto.isKit && <Badge variant="outline">Kit</Badge>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Estoque local</p>
                <p className="font-medium">{estoqueLocalTotal}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Custo médio</p>
                <p className="font-medium">
                  {produto.custoMedio ? formatBRL(produto.custoMedio) : "Não definido"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Fornecedor principal</p>
                <p className="font-medium">
                  {produto.fornecedorPrincipal?.nome ?? "Não definido"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Anúncios ML</p>
                <p className="font-medium">
                  {produto.ProdutoMercadoLivre?.length ?? 0}
                </p>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col gap-2">
            <Button size="sm" onClick={() => setShowEditModal(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFornecedorModal(true)}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Fornecedores
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowStockModal(true);
                loadStockDetails();
              }}
            >
              <Warehouse className="h-4 w-4 mr-2" />
              Estoque
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="ml">Mercado Livre</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">EAN</p>
                <p className="font-medium">{produto.codigoEAN || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Marca</p>
                <p className="font-medium">{produto.marca || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Categoria</p>
                <p className="font-medium">{produto.categoria || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Peso</p>
                <p className="font-medium">
                  {produto.pesoGramas ? `${produto.pesoGramas} g` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Dimensões (A×L×C)</p>
                <p className="font-medium">
                  {produto.alturaCm && produto.larguraCm && produto.comprimentoCm
                    ? `${produto.alturaCm}×${produto.larguraCm}×${produto.comprimentoCm} cm`
                    : "—"}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-muted-foreground">Descrição</p>
                <p className="font-medium whitespace-pre-wrap">
                  {produto.descricao || "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fornecedores">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Fornecedores vinculados</CardTitle>
              <Button size="sm" onClick={() => setShowFornecedorModal(true)}>
                Gerenciar
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!produto.fornecedores || produto.fornecedores.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum fornecedor vinculado a este produto.
                </p>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Fornecedor</DataTableHead>
                      <DataTableHead>Prazo</DataTableHead>
                      <DataTableHead>Preço</DataTableHead>
                      <DataTableHead>Qtd. mínima</DataTableHead>
                      <DataTableHead>Código no fornecedor</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {produto.fornecedores.map((vinculo) => (
                      <DataTableRow key={vinculo.id}>
                        <DataTableCell className="flex items-center gap-2">
                          {vinculo.principal && (
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          )}
                          {vinculo.fornecedor.nome}
                        </DataTableCell>
                        <DataTableCell>
                          {vinculo.prazoEntregaDias != null
                            ? `${vinculo.prazoEntregaDias} dias`
                            : "—"}
                        </DataTableCell>
                        <DataTableCell>
                          {vinculo.precoUnitario
                            ? formatBRL(vinculo.precoUnitario)
                            : formatBRL(vinculo.preco)}
                        </DataTableCell>
                        <DataTableCell>{vinculo.quantidadeMinima ?? "—"}</DataTableCell>
                        <DataTableCell>
                          {vinculo.codigoNoFornecedor || "—"}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estoque">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estoque por armazém</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!produto.estoques || produto.estoques.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Sem registros de estoque.
                </p>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Armazém</DataTableHead>
                      <DataTableHead>Quantidade</DataTableHead>
                      <DataTableHead>Estoque de segurança</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {produto.estoques.map((estoque, index) => (
                      <DataTableRow key={index}>
                        <DataTableCell>{estoque.armazem?.nome || "—"}</DataTableCell>
                        <DataTableCell>{estoque.quantidade}</DataTableCell>
                        <DataTableCell>
                          {estoque.estoqueSeguranca ?? "—"}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ml">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anúncios vinculados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!produto.ProdutoMercadoLivre ||
              produto.ProdutoMercadoLivre.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum anúncio do Mercado Livre vinculado.
                </p>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Anúncio</DataTableHead>
                      <DataTableHead>Status</DataTableHead>
                      <DataTableHead>Preço</DataTableHead>
                      <DataTableHead>Estoque ML</DataTableHead>
                      <DataTableHead />
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {produto.ProdutoMercadoLivre.map((anuncio) => (
                      <DataTableRow key={anuncio.mlItemId}>
                        <DataTableCell className="max-w-xs truncate">
                          {anuncio.mlTitle}
                        </DataTableCell>
                        <DataTableCell>
                          <Badge variant="outline">{anuncio.mlStatus}</Badge>
                        </DataTableCell>
                        <DataTableCell>
                          {anuncio.mlPrice ? formatBRL(anuncio.mlPrice) : "—"}
                        </DataTableCell>
                        <DataTableCell>{anuncio.mlAvailableQuantity}</DataTableCell>
                        <DataTableCell>
                          {anuncio.mlPermalink && (
                            <a
                              href={anuncio.mlPermalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                            >
                              Ver <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compras</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!produto.pedidos || produto.pedidos.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma compra registrada.
                  </p>
                ) : (
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHead>Fornecedor</DataTableHead>
                        <DataTableHead>Qtd.</DataTableHead>
                        <DataTableHead>Custo</DataTableHead>
                        <DataTableHead>Data</DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {produto.pedidos.map((item, index) => (
                        <DataTableRow key={index}>
                          <DataTableCell>{item.pedido.fornecedor.nome}</DataTableCell>
                          <DataTableCell>{item.quantidade}</DataTableCell>
                          <DataTableCell>{formatBRL(item.custo)}</DataTableCell>
                          <DataTableCell>
                            {item.pedido.dataConclusao
                              ? formatDateBR(item.pedido.dataConclusao)
                              : item.pedido.status}
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saídas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!produto.detalhesSaida || produto.detalhesSaida.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma saída registrada.
                  </p>
                ) : (
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHead>Quantidade</DataTableHead>
                        <DataTableHead>Data</DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {produto.detalhesSaida.map((item, index) => (
                        <DataTableRow key={index}>
                          <DataTableCell>{item.quantidade}</DataTableCell>
                          <DataTableCell>{formatDateBR(item.saida.data)}</DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ProdutoEditarDialog
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        produto={produto}
        onSave={() => {
          setShowEditModal(false);
          loadProduto();
        }}
      />

      <ProdutoFornecedorDialog
        isOpen={showFornecedorModal}
        onClose={() => {
          setShowFornecedorModal(false);
          loadProduto();
        }}
        produto={produto}
      />

      <ProdutoEstoqueDialog
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        produto={produto}
        stockDetails={stockDetails}
        isLoading={loadingStock}
      />
    </div>
  );
}
