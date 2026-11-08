"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Star,
  Pencil,
  Link2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { BotaoExplicarIa } from "@/components/ia/BotaoExplicarIa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ProductImage } from "@/components/ui/product-image";
import { formatBRL, formatDateBR } from "@/lib/format";
import { ProdutoFornecedorDialog } from "../components/dialogs/ProdutoFornecedorDialog";
import type { Produto } from "../types";
import type { Pendencia } from "@/lib/pendencias";
import { calcularMargemUnitaria } from "@/lib/margem";
import { StatusPill } from "@/components/ui/status-pill";
import { AnunciosDoProduto, type AnuncioViaKit } from "./AnunciosDoProduto";

interface ProdutoFicha extends Omit<Produto, "componentes"> {
  componentes?: Array<{ quantidade: number; produto: { id: string; nome: string; sku: string; custoMedio: number | null } }>;
  descricao?: string | null;
  marca?: string | null;
  categoria?: string | null;
  pesoGramas?: number | null;
  alturaCm?: number | null;
  larguraCm?: number | null;
  comprimentoCm?: number | null;
  anunciosViaKit?: AnuncioViaKit[];
  ProdutoMercadoLivre?: Array<{
    id: string;
    mlSellerSku?: string | null;
    mlItemId: string;
    mlTitle: string;
    mlAvailableQuantity: number;
    mlSoldQuantity: number;
    mlSold90Days: number | null;
    mlStatus: string;
    mlPrice: number | null;
    mlPermalink: string | null;
    mlThumbnail: string | null;
    mlTarifaVenda?: number | null;
    mlCustoFrete?: number | null;
    mlCustosAtualizadosEm?: string | null;
    mlFreeShipping?: boolean;
  }>;
  fornecedores?: Array<{
    id: number;
    preco: number;
    multiplicador: number;
    codigoNF: string;
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
  movimentacoesEstoque?: Array<{
    id: string;
    quantidadeAnterior: number;
    quantidadeNova: number;
    origem: "IMPORTACAO_PLANILHA" | "AJUSTE_MANUAL" | "SINCRONIZACAO_FULL_ML" | "SINCRONIZACAO_BLING";
    observacao: string | null;
    createdAt: string;
    armazem: { nome: string };
  }>;
}

const ORIGEM_MOVIMENTACAO_LABEL: Record<string, string> = {
  IMPORTACAO_PLANILHA: "Importação de planilha",
  AJUSTE_MANUAL: "Ajuste manual",
  SINCRONIZACAO_FULL_ML: "Sincronização Full (ML)",
  SINCRONIZACAO_BLING: "Sincronização Bling",
};

interface ResultadoFinanceiro30Dias {
  unidades: number;
  margemContribuicao: number;
  lucroLiquido: number;
  vendasIncompletas: number;
}

export default function ProdutoFichaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const podeVerCusto = session?.user?.role === "ADMIN" || session?.user?.role === "COMPRAS";
  const [produto, setProduto] = useState<ProdutoFicha | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [aliquotaImposto, setAliquotaImposto] = useState(0);
  const [resultadoFinanceiro, setResultadoFinanceiro] = useState<ResultadoFinanceiro30Dias | null>(null);

  const [editandoCadastro, setEditandoCadastro] = useState(false);
  const [draftNome, setDraftNome] = useState("");
  const [draftEan, setDraftEan] = useState("");
  const [draftCusto, setDraftCusto] = useState("");
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);

  const [editandoSeguranca, setEditandoSeguranca] = useState<string | null>(null);
  const [draftSeguranca, setDraftSeguranca] = useState("");
  const [salvandoSeguranca, setSalvandoSeguranca] = useState(false);
  const [salvandoFornecedorId, setSalvandoFornecedorId] = useState<number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState("dados");

  const loadPendencias = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/produtos/pendencias?produtoId=${params.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setPendencias(data.pendencias || []);
      }
    } catch (error) {
      console.error("Erro ao buscar pendências:", error);
    }
  }, [params.id]);

  useEffect(() => {
    loadPendencias();
    fetch("/api/configuracoes-gerais")
      .then((res) => res.json())
      .then((data) => setAliquotaImposto(data.aliquotaImposto ?? 0))
      .catch(() => undefined);
    fetch(`/api/produtos/${params.id}/resultado-financeiro`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setResultadoFinanceiro(data))
      .catch(() => undefined);
  }, [loadPendencias, params.id]);

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

  const iniciarEdicaoCadastro = () => {
    if (!produto) return;
    setDraftNome(produto.nome);
    setDraftEan(produto.codigoEAN ? String(produto.codigoEAN) : "");
    setDraftCusto(produto.custoMedio != null ? String(produto.custoMedio / 100) : "");
    setEditandoCadastro(true);
  };

  const salvarCadastro = async () => {
    if (!produto) return;
    if (!draftNome.trim()) {
      toast.error("O nome do produto é obrigatório");
      return;
    }
    setSalvandoCadastro(true);
    try {
      const custoReais = draftCusto.trim() === "" ? null : Number(draftCusto.replace(",", "."));
      const response = await fetch("/api/produtos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: produto.id,
          nome: draftNome.trim(),
          sku: produto.sku,
          ean: draftEan.trim() || null,
          descricao: produto.descricao ?? null,
          marca: produto.marca ?? null,
          categoria: produto.categoria ?? null,
          pesoGramas: produto.pesoGramas ?? null,
          alturaCm: produto.alturaCm ?? null,
          larguraCm: produto.larguraCm ?? null,
          comprimentoCm: produto.comprimentoCm ?? null,
          ...(podeVerCusto && custoReais != null && !Number.isNaN(custoReais)
            ? { custoMedio: Math.round(custoReais * 100) }
            : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Erro ao salvar cadastro");
      }
      toast.success("Cadastro atualizado");
      setEditandoCadastro(false);
      await loadProduto();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar cadastro");
    } finally {
      setSalvandoCadastro(false);
    }
  };

  const salvarEstoqueSeguranca = async (armazemId: string) => {
    if (!produto) return;
    const valor = draftSeguranca.trim() === "" ? 0 : Number(draftSeguranca);
    if (Number.isNaN(valor) || valor < 0) {
      toast.error("Estoque de segurança inválido");
      return;
    }
    setSalvandoSeguranca(true);
    try {
      const response = await fetch("/api/estoque/estoqueSeguranca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId: produto.id, armazemId, estoqueSeguranca: valor }),
      });
      if (!response.ok) throw new Error();
      toast.success("Estoque de segurança atualizado");
      setEditandoSeguranca(null);
      await loadProduto();
    } catch {
      toast.error("Erro ao salvar estoque de segurança");
    } finally {
      setSalvandoSeguranca(false);
    }
  };

  const tornarFornecedorPrincipal = async (vinculo: NonNullable<ProdutoFicha["fornecedores"]>[number]) => {
    setSalvandoFornecedorId(vinculo.id);
    try {
      const response = await fetch("/api/produto-fornecedor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vinculo.id,
          preco: vinculo.preco / 100,
          multiplicador: vinculo.multiplicador,
          codigoNF: vinculo.codigoNF,
          prazoEntregaDias: vinculo.prazoEntregaDias,
          quantidadeMinima: vinculo.quantidadeMinima,
          codigoNoFornecedor: vinculo.codigoNoFornecedor,
          principal: true,
        }),
      });
      if (!response.ok) throw new Error();
      toast.success(`${vinculo.fornecedor.nome} agora é o fornecedor principal`);
      await loadProduto();
    } catch {
      toast.error("Erro ao definir fornecedor principal");
    } finally {
      setSalvandoFornecedorId(null);
    }
  };

  const salvarPrazoFornecedor = async (
    vinculo: NonNullable<ProdutoFicha["fornecedores"]>[number],
    prazoEntregaDias: number | null
  ) => {
    setSalvandoFornecedorId(vinculo.id);
    try {
      const response = await fetch("/api/produto-fornecedor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vinculo.id,
          preco: vinculo.preco / 100,
          multiplicador: vinculo.multiplicador,
          codigoNF: vinculo.codigoNF,
          prazoEntregaDias,
          quantidadeMinima: vinculo.quantidadeMinima,
          codigoNoFornecedor: vinculo.codigoNoFornecedor,
          principal: vinculo.principal,
        }),
      });
      if (!response.ok) throw new Error();
      toast.success("Prazo de entrega atualizado");
      await loadProduto();
    } catch {
      toast.error("Erro ao salvar prazo de entrega");
    } finally {
      setSalvandoFornecedorId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="mx-auto w-full max-w-5xl">
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

  const fornecedorPrincipal =
    produto.fornecedores?.find((f) => f.principal) ?? produto.fornecedores?.[0];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title={produto.nome}
        subtitle={`SKU ${produto.sku}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <BotaoExplicarIa
              pedido={{ tipo: "produto", produtoId: produto.id }}
              rotulo="Resumo do produto"
              perguntaAssistente={`O que devo fazer com o produto ${produto.nome} (SKU ${produto.sku})?`}
            />
            <Button variant="outline" onClick={() => router.push("/produtos")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-6 pt-6">
          <ProductImage
            src={produto.imagemUrl}
            alt={produto.nome}
            size={112}
            rounded="lg"
          />

          <div className="flex-1 space-y-3">
            {editandoCadastro ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="edit-nome">Nome</Label>
                  <Input id="edit-nome" value={draftNome} onChange={(e) => setDraftNome(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-ean">EAN</Label>
                  <Input id="edit-ean" value={draftEan} onChange={(e) => setDraftEan(e.target.value)} inputMode="numeric" />
                </div>
                {podeVerCusto && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-custo">Custo médio (R$)</Label>
                    <Input
                      id="edit-custo"
                      value={draftCusto}
                      onChange={(e) => setDraftCusto(e.target.value)}
                      inputMode="decimal"
                      placeholder="Não definido"
                    />
                  </div>
                )}
                <div className="sm:col-span-3 flex gap-2">
                  <Button size="sm" onClick={salvarCadastro} disabled={salvandoCadastro}>
                    <Check className="h-4 w-4 mr-2" />
                    {salvandoCadastro ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditandoCadastro(false)} disabled={salvandoCadastro}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{produto.nome}</h2>
                  {!produto.ativo && <Badge variant="outline">Inativo</Badge>}
                  {produto.isKit && <Badge variant="outline">Kit</Badge>}
                  <Button size="sm" variant="ghost" onClick={iniciarEdicaoCadastro}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Editar
                  </Button>
                </div>
                {produto.isKit && (produto.componentes?.length ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Composição:{" "}
                    {produto.componentes!.map((c, i) => (
                      <span key={c.produto.id}>
                        {i > 0 && " + "}
                        <Link href={`/produtos/${c.produto.id}`} className="text-primary hover:underline">
                          {c.quantidade}× {c.produto.nome}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Estoque local</p>
                    <p className="font-medium">{estoqueLocalTotal}</p>
                  </div>
                  {podeVerCusto && (
                    <div>
                      <p className="text-muted-foreground">Custo médio</p>
                      <p className="font-medium">
                        {produto.custoMedio != null ? formatBRL(produto.custoMedio) : "Não definido"}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Fornecedor principal</p>
                    <p className="font-medium">{fornecedorPrincipal?.fornecedor.nome ?? "Não definido"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Anúncios ML</p>
                    <p className="font-medium">
                      {(produto.ProdutoMercadoLivre?.length ?? 0) + (produto.anunciosViaKit?.length ?? 0)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {resultadoFinanceiro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado real dos últimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vendas</p>
                <p className="text-lg font-semibold">{resultadoFinanceiro.unidades} un.</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margem de contribuição</p>
                <p className="text-lg font-semibold">{formatBRL(resultadoFinanceiro.margemContribuicao)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lucro líquido</p>
                <p className="text-lg font-semibold">{formatBRL(resultadoFinanceiro.lucroLiquido)}</p>
              </div>
            </div>
            {resultadoFinanceiro.vendasIncompletas > 0 && (
              <p className="mt-3 text-sm text-warning-text">
                {resultadoFinanceiro.vendasIncompletas} venda(s) incompleta(s) no período — os números acima podem estar subestimados.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {pendencias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cadastro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendencias.map((p) => (
              <div
                key={p.codigo}
                className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusPill
                    tone={
                      p.severidade === "critica"
                        ? "critical"
                        : p.severidade === "atencao"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {p.codigo}
                  </StatusPill>
                  <span className="text-sm text-muted-foreground truncate">
                    {p.mensagem}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (p.codigo === "SEM_FORNECEDOR" || p.codigo === "SEM_FORNECEDOR_PRINCIPAL" || p.codigo === "SEM_PRAZO_FORNECEDOR") {
                      setAbaAtiva("fornecedores");
                      setShowFornecedorModal(true);
                    } else if (p.codigo === "ESTOQUE_DIVERGENTE") {
                      setAbaAtiva("estoque");
                    } else if (p.codigo === "SEM_VINCULO_ML") {
                      router.push(`/mercado-livre/produtos?stock=unlinked&q=${encodeURIComponent(produto.sku)}`);
                    } else if (p.codigo === "VENDA_INCOMPLETA") {
                      router.push(`/financeiro/vendas?produtoId=${params.id}&soIncompletas=true`);
                    } else {
                      iniciarEdicaoCadastro();
                    }
                  }}
                >
                  {p.acao}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}



      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
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
                      <DataTableHead />
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {produto.fornecedores.map((vinculo) => (
                      <DataTableRow key={vinculo.id}>
                        <DataTableCell className="flex items-center gap-2">
                          {vinculo.principal && (
                            <Star className="h-3.5 w-3.5 fill-warning text-warning-text" />
                          )}
                          {vinculo.fornecedor.nome}
                        </DataTableCell>
                        <DataTableCell>
                          <Input
                            type="number"
                            min={0}
                            defaultValue={vinculo.prazoEntregaDias ?? ""}
                            placeholder="dias"
                            className="h-8 w-20"
                            disabled={salvandoFornecedorId === vinculo.id}
                            onBlur={(e) => {
                              const valor = e.target.value.trim();
                              const novoPrazo = valor === "" ? null : Number(valor);
                              if (novoPrazo !== vinculo.prazoEntregaDias) {
                                salvarPrazoFornecedor(vinculo, novoPrazo);
                              }
                            }}
                          />
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
                        <DataTableCell>
                          {!vinculo.principal && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={salvandoFornecedorId === vinculo.id}
                              onClick={() => tornarFornecedorPrincipal(vinculo)}
                            >
                              Tornar principal
                            </Button>
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
                          {editandoSeguranca === estoque.armazemId ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                autoFocus
                                value={draftSeguranca}
                                onChange={(e) => setDraftSeguranca(e.target.value)}
                                className="h-8 w-20"
                                disabled={salvandoSeguranca}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={salvandoSeguranca}
                                onClick={() => salvarEstoqueSeguranca(estoque.armazemId)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={salvandoSeguranca}
                                onClick={() => setEditandoSeguranca(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="hover:underline"
                              onClick={() => {
                                setEditandoSeguranca(estoque.armazemId);
                                setDraftSeguranca(estoque.estoqueSeguranca != null ? String(estoque.estoqueSeguranca) : "");
                              }}
                            >
                              {estoque.estoqueSeguranca ?? "Definir"}
                            </button>
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

        <TabsContent value="ml">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Onde este produto é vendido</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AnunciosDoProduto
                produto={produto}
                anuncios={(produto.ProdutoMercadoLivre ?? []).map((a) => ({
                  ...a,
                  mlTarifaVenda: a.mlTarifaVenda ?? null,
                  mlCustoFrete: a.mlCustoFrete ?? null,
                }))}
                anunciosViaKit={produto.anunciosViaKit ?? []}
                aliquotaImposto={aliquotaImposto}
                onAlterado={loadProduto}
              />
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

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Movimentações de estoque</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!produto.movimentacoesEstoque ||
                produto.movimentacoesEstoque.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma movimentação registrada.
                  </p>
                ) : (
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHead>Armazém</DataTableHead>
                        <DataTableHead>De</DataTableHead>
                        <DataTableHead>Para</DataTableHead>
                        <DataTableHead>Origem</DataTableHead>
                        <DataTableHead>Data</DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {produto.movimentacoesEstoque.map((mov) => (
                        <DataTableRow key={mov.id}>
                          <DataTableCell>{mov.armazem.nome}</DataTableCell>
                          <DataTableCell>{mov.quantidadeAnterior}</DataTableCell>
                          <DataTableCell>{mov.quantidadeNova}</DataTableCell>
                          <DataTableCell>
                            {ORIGEM_MOVIMENTACAO_LABEL[mov.origem] ?? mov.origem}
                          </DataTableCell>
                          <DataTableCell>{formatDateBR(mov.createdAt)}</DataTableCell>
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

      <ProdutoFornecedorDialog
        isOpen={showFornecedorModal}
        onClose={() => {
          setShowFornecedorModal(false);
          loadProduto();
        }}
        produto={produto}
      />
    </div>
  );
}
