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
import Header from "@/app/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <Header title="Produto não encontrado" />
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
      <Header title={produto.nome} subtitle={`SKU ${produto.sku}`}>
        <Button variant="outline" onClick={() => router.push("/produtos")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </Header>

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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Qtd. mínima</TableHead>
                      <TableHead>Código no fornecedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produto.fornecedores.map((vinculo) => (
                      <TableRow key={vinculo.id}>
                        <TableCell className="flex items-center gap-2">
                          {vinculo.principal && (
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          )}
                          {vinculo.fornecedor.nome}
                        </TableCell>
                        <TableCell>
                          {vinculo.prazoEntregaDias != null
                            ? `${vinculo.prazoEntregaDias} dias`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {vinculo.precoUnitario
                            ? formatBRL(vinculo.precoUnitario)
                            : formatBRL(vinculo.preco)}
                        </TableCell>
                        <TableCell>{vinculo.quantidadeMinima ?? "—"}</TableCell>
                        <TableCell>
                          {vinculo.codigoNoFornecedor || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Armazém</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Estoque de segurança</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produto.estoques.map((estoque, index) => (
                      <TableRow key={index}>
                        <TableCell>{estoque.armazem?.nome || "—"}</TableCell>
                        <TableCell>{estoque.quantidade}</TableCell>
                        <TableCell>
                          {estoque.estoqueSeguranca ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anúncio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque ML</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produto.ProdutoMercadoLivre.map((anuncio) => (
                      <TableRow key={anuncio.mlItemId}>
                        <TableCell className="max-w-xs truncate">
                          {anuncio.mlTitle}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{anuncio.mlStatus}</Badge>
                        </TableCell>
                        <TableCell>
                          {anuncio.mlPrice ? formatBRL(anuncio.mlPrice) : "—"}
                        </TableCell>
                        <TableCell>{anuncio.mlAvailableQuantity}</TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Qtd.</TableHead>
                        <TableHead>Custo</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produto.pedidos.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.pedido.fornecedor.nome}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                          <TableCell>{formatBRL(item.custo)}</TableCell>
                          <TableCell>
                            {item.pedido.dataConclusao
                              ? formatDateBR(item.pedido.dataConclusao)
                              : item.pedido.status}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produto.detalhesSaida.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.quantidade}</TableCell>
                          <TableCell>{formatDateBR(item.saida.data)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
