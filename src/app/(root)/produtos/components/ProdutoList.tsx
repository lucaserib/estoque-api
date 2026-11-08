"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Truck, X } from "lucide-react";
import type { Produto } from "../types";
import type { Pendencia } from "@/lib/pendencias";
import { FULL_ARMAZEM_NOME } from "@/lib/estoque";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { SectionCard } from "@/components/ui/section-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { ProductImage } from "@/components/ui/product-image";
import { formatBRL } from "@/lib/format";
import { ProdutoEstoqueDialog } from "./dialogs/ProdutoEstoqueDialog";
import { ProdutoEditarDialog } from "./dialogs/ProdutoEditarDialog";
import { ProdutoFornecedorDialog } from "./dialogs/ProdutoFornecedorDialog";
import { BulkAssignDialog } from "./dialogs/BulkAssignDialog";
import { ReposicaoModal } from "./ReposicaoModal";
import { ProdutoTableRow } from "./ProdutoTableRow";

export type AbaProdutos = "produtos" | "kits" | "inativos";

interface ItemLista {
  id: string;
  nome: string;
  sku: string;
  codigoEAN: string | null;
  isKit: boolean;
  ativo: boolean;
  imagemUrl: string | null;
  custoMedio: number | null;
  fornecedorPrincipal: { id: string; nome: string; prazoEntregaDias: number | null } | null;
  estoqueLocal: number;
  estoqueSeguranca: number;
  estoqueFull: number;
  vendas90d: number;
  anuncios: number;
  componentes: Array<{ produtoId: string; nome: string; sku: string; quantidade: number }>;
  kitsMontaveis: number | null;
  pendencias: Pendencia[];
}

interface RespostaLista {
  itens: ItemLista[];
  total: number;
  temMais: boolean;
  contagens: { produtos: number; kits: number; inativos: number };
  fornecedores: Array<{ id: string; nome: string }>;
  pendenciasPorCodigo: Record<string, number>;
}

interface ProdutoListProps {
  aba: AbaProdutos;
  versao: number;
  onDelete: (produto: { id: string; nome: string }) => void;
  onContagens?: (contagens: RespostaLista["contagens"]) => void;
}

const ROTULO_PENDENCIA: Record<string, string> = {
  SEM_CUSTO: "Sem custo",
  SEM_FORNECEDOR: "Sem fornecedor",
  SEM_FORNECEDOR_PRINCIPAL: "Sem fornecedor principal",
  SEM_PRECO: "Sem preço",
  MARGEM_NEGATIVA: "Margem negativa",
  SEM_FRETE: "Sem frete",
  SEM_TARIFA: "Sem tarifa",
  ESTOQUE_DIVERGENTE: "Estoque divergente",
  SEM_VINCULO_ML: "Sem anúncio",
  SEM_EAN: "Sem EAN",
  SEM_PRAZO_FORNECEDOR: "Sem prazo",
  VENDA_INCOMPLETA: "Venda incompleta",
};
const PENDENCIAS_PRIORITARIAS = ["SEM_CUSTO", "MARGEM_NEGATIVA", "SEM_FORNECEDOR", "SEM_PRECO", "ESTOQUE_DIVERGENTE"];

const POR_PAGINA = 30;

function paraProduto(item: ItemLista): Produto {
  return {
    ...item,
    codigoEAN: item.codigoEAN ?? undefined,
    _estoqueLocalTotal: item.estoqueLocal,
    _mlEstoqueFull: item.estoqueFull,
    _mlTotalVendas: item.vendas90d,
    _vinculadoML: item.anuncios > 0,
  };
}

function useDebounce<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

export default function ProdutoList({ aba, versao, onDelete, onContagens }: ProdutoListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pendencia = searchParams.get("pendencia") ?? "";

  const [busca, setBusca] = useState("");
  const buscaAtrasada = useDebounce(busca, 300);
  const [estoque, setEstoque] = useState("all");
  const [fornecedorId, setFornecedorId] = useState("all");
  const [ml, setMl] = useState("all");
  const [ordem, setOrdem] = useState("relevancia");

  const [itens, setItens] = useState<ItemLista[]>([]);
  const [total, setTotal] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [fornecedores, setFornecedores] = useState<RespostaLista["fornecedores"]>([]);
  const [pendenciasPorCodigo, setPendenciasPorCodigo] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bulkAberto, setBulkAberto] = useState(false);
  const [armazens, setArmazens] = useState<{ id: string; nome: string }[]>([]);

  const [produtoAtivo, setProdutoAtivo] = useState<Produto | null>(null);
  const [dialogo, setDialogo] = useState<"editar" | "fornecedor" | "estoque" | "reposicao" | null>(null);
  const [estoqueDetalhes, setEstoqueDetalhes] = useState<
    Array<{ produtoId: string; armazemId: string; quantidade: number; estoqueSeguranca?: number; armazem?: { id: string; nome: string } }>
  >([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(false);

  const requisicao = useRef(0);
  const sentinela = useRef<HTMLDivElement | null>(null);
  const onContagensRef = useRef(onContagens);
  onContagensRef.current = onContagens;

  const parametros = useMemo(() => {
    const p = new URLSearchParams({
      porPagina: String(POR_PAGINA),
      ordem,
      tipo: aba === "kits" ? "kits" : aba === "inativos" ? "todos" : "produtos",
      status: aba === "inativos" ? "inativos" : "ativos",
    });
    if (buscaAtrasada.trim()) p.set("q", buscaAtrasada.trim());
    if (estoque !== "all") p.set("estoque", estoque);
    if (fornecedorId !== "all") p.set("fornecedorId", fornecedorId);
    if (ml !== "all") p.set("ml", ml);
    if (pendencia) p.set("pendencia", pendencia);
    return p;
  }, [aba, buscaAtrasada, estoque, fornecedorId, ml, ordem, pendencia]);

  const buscarPagina = useCallback(
    async (numero: number) => {
      const id = ++requisicao.current;
      const p = new URLSearchParams(parametros);
      p.set("pagina", String(numero));
      if (numero === 1) setCarregando(true);
      else setCarregandoMais(true);
      try {
        const res = await fetch(`/api/produtos/lista?${p}`);
        if (!res.ok) throw new Error("Não foi possível carregar os produtos.");
        const body: RespostaLista = await res.json();
        if (id !== requisicao.current) return;
        setItens((atual) => (numero === 1 ? body.itens : [...atual, ...body.itens]));
        setTotal(body.total);
        setTemMais(body.temMais);
        setPagina(numero);
        setFornecedores(body.fornecedores);
        setPendenciasPorCodigo(body.pendenciasPorCodigo);
        setErro(null);
        onContagensRef.current?.(body.contagens);
      } catch (e) {
        if (id === requisicao.current) setErro(e instanceof Error ? e.message : "Erro ao carregar produtos.");
      } finally {
        if (id === requisicao.current) {
          setCarregando(false);
          setCarregandoMais(false);
        }
      }
    },
    [parametros]
  );

  useEffect(() => {
    setSelecionados(new Set());
    buscarPagina(1);
  }, [buscarPagina, versao]);

  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || !temMais) return;
    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting && !carregando && !carregandoMais) buscarPagina(pagina + 1);
      },
      { rootMargin: "400px" }
    );
    observer.observe(alvo);
    return () => observer.disconnect();
  }, [temMais, carregando, carregandoMais, pagina, buscarPagina]);

  useEffect(() => {
    fetch("/api/estoque/armazens")
      .then((r) => (r.ok ? r.json() : []))
      .then((todos: { id: string; nome: string }[]) => setArmazens(todos.filter((a) => a.nome !== FULL_ARMAZEM_NOME)))
      .catch(() => setArmazens([]));
  }, []);

  const definirPendencia = (codigo: string | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (codigo) p.set("pendencia", codigo);
    else p.delete("pendencia");
    router.replace(p.toString() ? `${pathname}?${p}` : pathname);
  };

  const abrir = useCallback((tipo: NonNullable<typeof dialogo>, produto: Produto) => {
    setProdutoAtivo(produto);
    setDialogo(tipo);
  }, []);

  const abrirEstoque = useCallback(async (produto: Produto) => {
    setProdutoAtivo(produto);
    setDialogo("estoque");
    setCarregandoEstoque(true);
    try {
      const res = await fetch(`/api/estoque/produto/${produto.id}`);
      setEstoqueDetalhes(res.ok ? await res.json() : []);
    } finally {
      setCarregandoEstoque(false);
    }
  }, []);

  const atualizarItem = useCallback((produto: Produto) => {
    setItens((atual) =>
      atual.map((i) =>
        i.id === produto.id
          ? { ...i, nome: produto.nome, sku: produto.sku, codigoEAN: produto.codigoEAN ?? null, imagemUrl: produto.imagemUrl ?? i.imagemUrl }
          : i
      )
    );
  }, []);

  const alternarSelecao = useCallback((id: string) => {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }, []);

  const atalhosPendencia = PENDENCIAS_PRIORITARIAS.filter((c) => (pendenciasPorCodigo[c] ?? 0) > 0);
  const filtrosAtivos = busca || estoque !== "all" || fornecedorId !== "all" || ml !== "all" || pendencia;
  const ehKits = aba === "kits";

  return (
    <div className="space-y-4">
      {(atalhosPendencia.length > 0 || pendencia) && aba !== "inativos" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Precisa de atenção:</span>
          {atalhosPendencia.map((codigo) => (
            <button
              key={codigo}
              type="button"
              onClick={() => definirPendencia(pendencia === codigo ? null : codigo)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                pendencia === codigo
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 hover:bg-accent/40"
              }`}
            >
              {ROTULO_PENDENCIA[codigo] ?? codigo} · {pendenciasPorCodigo[codigo]}
            </button>
          ))}
          {pendencia && !atalhosPendencia.includes(pendencia) && (
            <span className="rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {ROTULO_PENDENCIA[pendencia] ?? pendencia}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou EAN"
            className="h-9 pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={estoque} onValueChange={setEstoque}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo estoque</SelectItem>
            <SelectItem value="available">Com estoque</SelectItem>
            <SelectItem value="low">Estoque baixo</SelectItem>
            <SelectItem value="none">Sem estoque</SelectItem>
          </SelectContent>
        </Select>
        {!ehKits && (
          <Select value={fornecedorId} onValueChange={setFornecedorId}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {fornecedores.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={ml} onValueChange={setMl}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anúncios: todos</SelectItem>
            <SelectItem value="linked">Com anúncio</SelectItem>
            <SelectItem value="unlinked">Sem anúncio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={setOrdem}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevancia">Mais relevantes</SelectItem>
            <SelectItem value="vendas">Mais vendidos</SelectItem>
            <SelectItem value="estoque">Maior estoque</SelectItem>
            <SelectItem value="nome">Nome (A–Z)</SelectItem>
          </SelectContent>
        </Select>
        {filtrosAtivos && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1"
            onClick={() => {
              setBusca("");
              setEstoque("all");
              setFornecedorId("all");
              setMl("all");
              definirPendencia(null);
            }}
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {selecionados.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selecionados.size} selecionado(s)</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelecionados(new Set())}>
              <X className="mr-1 h-4 w-4" />
              Limpar seleção
            </Button>
            <Button size="sm" onClick={() => setBulkAberto(true)}>
              <Truck className="mr-1 h-4 w-4" />
              Atribuir custo/fornecedor
            </Button>
          </div>
        </div>
      )}

      <SectionCard contentClassName="p-0">
        <DataTable>
          <DataTableHeader>
            <DataTableRow className="hover:bg-transparent">
              {!ehKits && (
                <DataTableHead className="pl-4">
                  <Checkbox
                    checked={itens.length > 0 && itens.every((p) => selecionados.has(p.id))}
                    onCheckedChange={(marcado) =>
                      setSelecionados(marcado ? new Set(itens.map((p) => p.id)) : new Set())
                    }
                    aria-label="Selecionar todos os carregados"
                  />
                </DataTableHead>
              )}
              <DataTableHead className={ehKits ? "pl-4" : undefined}>Imagem</DataTableHead>
              <DataTableHead sticky>{ehKits ? "Kit" : "Produto"}</DataTableHead>
              {ehKits ? <DataTableHead>Composição</DataTableHead> : <DataTableHead>Fornecedor</DataTableHead>}
              <DataTableHead>{ehKits ? "Dá para montar" : "Estoque local"}</DataTableHead>
              <DataTableHead className="text-right">Full</DataTableHead>
              <DataTableHead className="text-right">Vendas 90d</DataTableHead>
              <DataTableHead>{ehKits ? "Custo do kit" : "Custo médio"}</DataTableHead>
              <DataTableHead>Pendências</DataTableHead>
              <DataTableHead className="pr-4 text-right">Ações</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {carregando && itens.length === 0 ? (
              <DataTableRow className="hover:bg-transparent">
                <DataTableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </DataTableCell>
              </DataTableRow>
            ) : erro ? (
              <DataTableRow className="hover:bg-transparent">
                <DataTableCell colSpan={10} className="py-8 text-center">
                  <p className="text-sm text-destructive-text">{erro}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => buscarPagina(1)}>
                    Tentar novamente
                  </Button>
                </DataTableCell>
              </DataTableRow>
            ) : itens.length === 0 ? (
              <DataTableRow className="hover:bg-transparent">
                <DataTableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  {filtrosAtivos
                    ? "Nenhum produto com esses filtros."
                    : aba === "kits"
                      ? "Nenhum kit. Kits do Bling chegam pela sincronização; kits de quantidade (\"kit com 2\") são criados ao vincular o anúncio."
                      : aba === "inativos"
                        ? "Nenhum produto inativo."
                        : "Nenhum produto ainda. Use \"Novo produto\" para buscar no Bling ou cadastrar."}
                </DataTableCell>
              </DataTableRow>
            ) : ehKits ? (
              itens.map((kit) => (
                <DataTableRow key={kit.id} className="group">
                  <DataTableCell className="pl-4">
                    <ProductImage src={kit.imagemUrl} alt={kit.nome} size={40} />
                  </DataTableCell>
                  <DataTableCell emphasis sticky>
                    <Link href={`/produtos/${kit.id}`} className="block min-w-0 hover:underline">
                      <p className="truncate">{kit.nome}</p>
                      <p className="text-xs font-normal text-muted-foreground">{kit.sku}</p>
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="text-sm text-muted-foreground">
                    {kit.componentes.length === 0
                      ? "Sem componentes"
                      : kit.componentes.map((c) => `${c.quantidade}× ${c.nome}`).join(" + ")}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusPill tone={(kit.kitsMontaveis ?? 0) > 0 ? "success" : "critical"}>
                      {kit.kitsMontaveis ?? 0}
                    </StatusPill>
                  </DataTableCell>
                  <DataTableCell numeric>{kit.estoqueFull || "-"}</DataTableCell>
                  <DataTableCell numeric>{kit.vendas90d || "-"}</DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {kit.custoMedio != null ? formatBRL(kit.custoMedio) : "Falta custo de componente"}
                  </DataTableCell>
                  <DataTableCell>
                    {kit.pendencias.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1" title={kit.pendencias.map((p) => p.mensagem).join("\n")}>
                        {kit.pendencias.slice(0, 2).map((p) => (
                          <StatusPill key={p.codigo} tone="warning">
                            {ROTULO_PENDENCIA[p.codigo] ?? p.codigo}
                          </StatusPill>
                        ))}
                      </div>
                    )}
                  </DataTableCell>
                  <DataTableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                        <Link href={`/produtos/${kit.id}`}>Abrir</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-destructive-text"
                        onClick={() => onDelete({ id: kit.id, nome: kit.nome })}
                      >
                        Excluir
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            ) : (
              itens.map((item) => {
                const produto = paraProduto(item);
                return (
                  <ProdutoTableRow
                    key={item.id}
                    produto={produto}
                    stockQuantity={item.estoqueLocal}
                    stockMinimum={item.estoqueSeguranca}
                    isLoadingStock={false}
                    armazens={armazens}
                    selected={selecionados.has(item.id)}
                    pendencias={item.pendencias}
                    onToggleSelected={alternarSelecao}
                    onDelete={(id) => onDelete({ id, nome: item.nome })}
                    onEdit={(p) => abrir("editar", p)}
                    onViewSuppliers={(p) => abrir("fornecedor", p)}
                    onViewStock={abrirEstoque}
                    onViewReplenishment={(p) => abrir("reposicao", p)}
                    onStockAdjusted={() => buscarPagina(1)}
                  />
                );
              })
            )}
          </DataTableBody>
        </DataTable>
      </SectionCard>

      <div ref={sentinela} className="flex flex-col items-center gap-2 py-2 text-sm text-muted-foreground">
        {itens.length > 0 && (
          <span>
            {itens.length} de {total}
          </span>
        )}
        {temMais && (
          <Button variant="outline" size="sm" disabled={carregandoMais} onClick={() => buscarPagina(pagina + 1)}>
            {carregandoMais ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Carregar mais
          </Button>
        )}
      </div>

      {produtoAtivo && (
        <>
          <ProdutoEditarDialog
            isOpen={dialogo === "editar"}
            onClose={() => setDialogo(null)}
            produto={produtoAtivo}
            onSave={atualizarItem}
          />
          <ProdutoFornecedorDialog
            isOpen={dialogo === "fornecedor"}
            onClose={() => {
              setDialogo(null);
              buscarPagina(1);
            }}
            produto={produtoAtivo}
          />
          <ProdutoEstoqueDialog
            isOpen={dialogo === "estoque"}
            onClose={() => setDialogo(null)}
            produto={produtoAtivo}
            stockDetails={estoqueDetalhes}
            isLoading={carregandoEstoque}
          />
          <ReposicaoModal isOpen={dialogo === "reposicao"} onClose={() => setDialogo(null)} produto={produtoAtivo} />
        </>
      )}

      <BulkAssignDialog
        isOpen={bulkAberto}
        onClose={() => setBulkAberto(false)}
        produtoIds={Array.from(selecionados)}
        onApplied={() => {
          setSelecionados(new Set());
          buscarPagina(1);
        }}
      />
    </div>
  );
}
