"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Produto } from "../types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Search, Truck, X } from "lucide-react";
import { ProdutoEstoqueDialog } from "./dialogs/ProdutoEstoqueDialog";
import { ProdutoPagination } from "./ProdutoPagination";
import { ProdutoEditarDialog } from "./dialogs/ProdutoEditarDialog";
import { ProdutoFornecedorDialog } from "./dialogs/ProdutoFornecedorDialog";
import { BulkAssignDialog } from "./dialogs/BulkAssignDialog";
import { ReposicaoModal } from "./ReposicaoModal";
import { ProdutoTableRow } from "./ProdutoTableRow";
import { Button } from "@/components/ui/button";

interface ProdutoListProps {
  produtos: Produto[];
  onDelete: (id: string) => void;
  onEdit: (produto: Produto) => void;
  refreshTrigger?: number;
  onRefreshReplenishment?: () => void;
  onBulkApplied?: () => void;
}

interface StockItem {
  produtoId: string;
  armazemId: string;
  quantidade: number;
  estoqueSeguranca?: number;
  armazem?: { id: string; nome: string };
}

type WindowWithReplenishment = Window & {
  __refreshReplenishment?: () => void;
};

const ProdutoList = ({
  produtos,
  onDelete,
  onEdit,
  refreshTrigger = 0,
  onRefreshReplenishment,
  onBulkApplied,
}: ProdutoListProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    searchTerm: "",
    stockFilter: "all" as "all" | "low" | "none" | "available",
    fornecedorId: "all",
    mlFilter: "all" as "all" | "linked" | "unlinked",
    semCusto: false,
  });
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showReposicaoModal, setShowReposicaoModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockDetails, setStockDetails] = useState<StockItem[]>([]);
  const [stockData, setStockData] = useState<{ [key: string]: number }>({});
  const [estoqueSegurancaData, setEstoqueSegurancaData] = useState<{
    [key: string]: number;
  }>({});
  const [replenishmentStatus, setReplenishmentStatus] = useState<{
    [key: string]: "ok" | "atencao" | "critico";
  }>({});
  const [lastReplenishmentFetch, setLastReplenishmentFetch] = useState<number>(0);
  const [isLoadingReplenishment, setIsLoadingReplenishment] = useState(false);
  const [armazens, setArmazens] = useState<{ id: string; nome: string }[]>([]);
  const [pendenciasPorProduto, setPendenciasPorProduto] = useState<
    Record<string, Pendencia[]>
  >({});
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pendenciaFiltroURL = searchParams.get("pendencia");
  const itemsPerPage = 10;
  const REPLENISHMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

  const fetchStockTotals = useCallback(async () => {
    if (produtos.length === 0) return;

    try {
      const ids = produtos.map((p) => p.id).join(",");
      const response = await fetch(`/api/estoque/produtos-batch?ids=${ids}`);
      if (!response.ok) throw new Error("Erro ao buscar estoque");

      const batch: Record<
        string,
        { totalQuantity: number; estoqueSeguranca: number }
      > = await response.json();

      const stockMap: { [key: string]: number } = {};
      const estoqueSegurancaMap: { [key: string]: number } = {};
      for (const [produtoId, info] of Object.entries(batch)) {
        stockMap[produtoId] = info.totalQuantity;
        estoqueSegurancaMap[produtoId] = info.estoqueSeguranca;
      }

      setStockData(stockMap);
      setEstoqueSegurancaData(estoqueSegurancaMap);
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
    }
  }, [produtos]);

  useEffect(() => {
    fetchStockTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos.length, refreshTrigger]);

  const fetchPendencias = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/produtos/pendencias?pageSize=2000"
      );
      if (!response.ok) return;
      const data: { itens: { produtoId: string; pendencias: Pendencia[] }[] } =
        await response.json();
      const mapa: Record<string, Pendencia[]> = {};
      for (const item of data.itens) {
        mapa[item.produtoId] = item.pendencias;
      }
      setPendenciasPorProduto(mapa);
    } catch (error) {
      console.error("Erro ao buscar pendências:", error);
    }
  }, []);

  useEffect(() => {
    fetchPendencias();
  }, [fetchPendencias, refreshTrigger]);

  useEffect(() => {
    const fetchArmazens = async () => {
      try {
        const response = await fetch("/api/estoque/armazens");
        if (response.ok) {
          const todos: { id: string; nome: string }[] = await response.json();
          setArmazens(todos.filter((a) => a.nome !== FULL_ARMAZEM_NOME));
        }
      } catch (error) {
        console.error("Erro ao buscar armazéns:", error);
      }
    };

    fetchArmazens();
  }, []);

  const fetchReplenishmentStatus = async (forceRefresh = false) => {
    const now = Date.now();
    const cacheValid = now - lastReplenishmentFetch < REPLENISHMENT_CACHE_TTL;

    if (cacheValid && !forceRefresh) {
      return;
    }

    setIsLoadingReplenishment(true);
    try {
      const statusPromises = produtos.map(async (produto) => {
        try {
          const response = await fetch(`/api/replenishment/suggestions/${produto.id}`);
          if (!response.ok) return { produtoId: produto.id, status: "ok" as const };
          const data = await response.json();
          return { produtoId: produto.id, status: data.suggestion?.status || "ok" };
        } catch {
          return { produtoId: produto.id, status: "ok" as const };
        }
      });

      const statusResults = await Promise.all(statusPromises);
      const statusMap = statusResults.reduce(
        (acc, { produtoId, status }) => {
          acc[produtoId] = status;
          return acc;
        },
        {} as { [key: string]: "ok" | "atencao" | "critico" }
      );

      setReplenishmentStatus(statusMap);
      setLastReplenishmentFetch(Date.now());
    } catch (error) {
      console.error("Erro ao buscar status de reposição:", error);
    } finally {
      setIsLoadingReplenishment(false);
    }
  };

  // Status de reposição não é buscado automaticamente: seriam 40+ chamadas de API por carregamento. Carrega só quando o usuário abre o modal.
  useEffect(() => {
    (window as WindowWithReplenishment).__refreshReplenishment = () =>
      fetchReplenishmentStatus(true);

    return () => {
      delete (window as WindowWithReplenishment).__refreshReplenishment;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStockDetails = useCallback(async (produto: Produto) => {
    try {
      setSelectedProduto(produto);
      setIsLoadingStock(true);
      setShowStockModal(true);

      const response = await fetch(`/api/estoque/produto/${produto.id}`);
      if (!response.ok) throw new Error("Erro ao buscar detalhes do estoque");

      const stockItems: StockItem[] = await response.json();
      setStockDetails(stockItems);
    } catch (error) {
      console.error("Erro ao buscar detalhes do estoque:", error);
    } finally {
      setIsLoadingStock(false);
    }
  }, []);

  const handleEdit = useCallback((produto: Produto) => {
    setSelectedProduto(produto);
    setShowEditModal(true);
  }, []);

  const handleViewSuppliers = useCallback((produto: Produto) => {
    setSelectedProduto(produto);
    setShowFornecedorModal(true);
  }, []);

  const handleViewReplenishment = useCallback((produto: Produto) => {
    setSelectedProduto(produto);
    setShowReposicaoModal(true);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkApplied = useCallback(() => {
    setSelectedIds(new Set());
    onBulkApplied?.();
  }, [onBulkApplied]);

  const fornecedoresDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>();
    produtos.forEach((produto) => {
      if (produto.fornecedorPrincipal) {
        mapa.set(
          produto.fornecedorPrincipal.id,
          produto.fornecedorPrincipal.nome
        );
      }
    });
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }));
  }, [produtos]);

  const produtosSemCustoOuFornecedor = useMemo(
    () =>
      produtos.filter(
        (produto) => !produto.custoMedio || !produto.fornecedorPrincipal
      ),
    [produtos]
  );

  const filteredProdutos = produtos.filter((produto) => {
    const matchesSearch =
      produto.nome
        .toLowerCase()
        .includes(filterOptions.searchTerm.toLowerCase()) ||
      produto.sku
        .toLowerCase()
        .includes(filterOptions.searchTerm.toLowerCase()) ||
      (produto.codigoEAN &&
        produto.codigoEAN
          .toLowerCase()
          .includes(filterOptions.searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterOptions.stockFilter !== "all") {
      const estoque = stockData[produto.id] || 0;
      const estoqueMinimo = estoqueSegurancaData[produto.id] || 0;

      const matchesStock = (() => {
        switch (filterOptions.stockFilter) {
          case "low":
            return estoque <= estoqueMinimo && estoque > 0;
          case "none":
            return estoque === 0;
          case "available":
            return estoque > 0;
          default:
            return true;
        }
      })();

      if (!matchesStock) return false;
    }

    if (
      filterOptions.fornecedorId !== "all" &&
      produto.fornecedorPrincipal?.id !== filterOptions.fornecedorId
    ) {
      return false;
    }

    if (filterOptions.mlFilter !== "all") {
      const vinculado = produto._vinculadoML ?? false;
      if (filterOptions.mlFilter === "linked" && !vinculado) return false;
      if (filterOptions.mlFilter === "unlinked" && vinculado) return false;
    }

    if (filterOptions.semCusto && produto.custoMedio) {
      return false;
    }

    if (pendenciaFiltroURL) {
      const pendenciasDoProduto = pendenciasPorProduto[produto.id] || [];
      if (!pendenciasDoProduto.some((p) => p.codigo === pendenciaFiltroURL)) {
        return false;
      }
    }

    return true;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProdutos.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredProdutos.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="space-y-4">
      {pendenciaFiltroURL && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Mostrando apenas produtos com a pendência{" "}
              <strong>{pendenciaFiltroURL}</strong>.
            </span>
            <button
              type="button"
              className="text-sm font-medium underline underline-offset-2"
              onClick={() => router.replace(pathname)}
            >
              Limpar filtro
            </button>
          </AlertDescription>
        </Alert>
      )}

      {produtosSemCustoOuFornecedor.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {produtosSemCustoOuFornecedor.length} produto(s) sem custo médio
              ou sem fornecedor cadastrado. Isso impede o cálculo correto da
              Reposição.
            </span>
            <button
              type="button"
              className="text-sm font-medium underline underline-offset-2"
              onClick={() =>
                setFilterOptions((prev) => ({
                  ...prev,
                  semCusto: true,
                  fornecedorId: "all",
                  mlFilter: "all",
                  stockFilter: "all",
                  searchTerm: "",
                }))
              }
            >
              Ver produtos sem custo
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou EAN"
            className="pl-8 h-9"
            value={filterOptions.searchTerm}
            onChange={(e) =>
              setFilterOptions((prev) => ({
                ...prev,
                searchTerm: e.target.value,
              }))
            }
          />
        </div>

        <Select
          value={filterOptions.stockFilter}
          onValueChange={(value) =>
            setFilterOptions((prev) => ({
              ...prev,
              stockFilter: value as typeof prev.stockFilter,
            }))
          }
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Estoque" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo estoque</SelectItem>
            <SelectItem value="available">Com estoque</SelectItem>
            <SelectItem value="low">Estoque baixo</SelectItem>
            <SelectItem value="none">Sem estoque</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterOptions.fornecedorId}
          onValueChange={(value) =>
            setFilterOptions((prev) => ({ ...prev, fornecedorId: value }))
          }
        >
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os fornecedores</SelectItem>
            {fornecedoresDisponiveis.map((fornecedor) => (
              <SelectItem key={fornecedor.id} value={fornecedor.id}>
                {fornecedor.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterOptions.mlFilter}
          onValueChange={(value) =>
            setFilterOptions((prev) => ({
              ...prev,
              mlFilter: value as typeof prev.mlFilter,
            }))
          }
        >
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Mercado Livre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ML: todos</SelectItem>
            <SelectItem value="linked">Vinculado ao ML</SelectItem>
            <SelectItem value="unlinked">Não vinculado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterOptions.semCusto ? "sem-custo" : "todos"}
          onValueChange={(value) =>
            setFilterOptions((prev) => ({
              ...prev,
              semCusto: value === "sem-custo",
            }))
          }
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Custo médio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Custo: todos</SelectItem>
            <SelectItem value="sem-custo">Sem custo definido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} produto(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-4 w-4 mr-1" />
              Limpar seleção
            </Button>
            <Button size="sm" onClick={() => setShowBulkAssignModal(true)}>
              <Truck className="h-4 w-4 mr-1" />
              Atribuir custo/fornecedor
            </Button>
          </div>
        </div>
      )}

      <SectionCard contentClassName="p-0">
        <DataTable>
          <DataTableHeader>
            <DataTableRow className="hover:bg-transparent">
              <DataTableHead className="pl-4">
                <Checkbox
                  checked={
                    currentItems.length > 0 &&
                    currentItems.every((p) => selectedIds.has(p.id))
                  }
                  onCheckedChange={(checked) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      currentItems.forEach((p) =>
                        checked ? next.add(p.id) : next.delete(p.id)
                      );
                      return next;
                    });
                  }}
                  aria-label="Selecionar todos os produtos visíveis"
                />
              </DataTableHead>
              <DataTableHead>Imagem</DataTableHead>
              <DataTableHead sticky>Produto</DataTableHead>
              <DataTableHead>Fornecedor</DataTableHead>
              <DataTableHead>Estoque Local</DataTableHead>
              <DataTableHead className="text-right">Full</DataTableHead>
              <DataTableHead className="text-right">Vendas ML</DataTableHead>
              <DataTableHead>Custo Médio</DataTableHead>
              <DataTableHead>Pendências</DataTableHead>
              <DataTableHead className="pr-4 text-right">Ações</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {currentItems.length > 0 ? (
              currentItems.map((produto) => (
                <ProdutoTableRow
                  key={produto.id}
                  produto={produto}
                  stockQuantity={stockData[produto.id]}
                  stockMinimum={estoqueSegurancaData[produto.id]}
                  isLoadingStock={stockData[produto.id] === undefined}
                  replenishmentStatus={replenishmentStatus[produto.id]}
                  armazens={armazens}
                  selected={selectedIds.has(produto.id)}
                  pendencias={pendenciasPorProduto[produto.id] || []}
                  onToggleSelected={toggleSelected}
                  onDelete={onDelete}
                  onEdit={handleEdit}
                  onViewSuppliers={handleViewSuppliers}
                  onViewStock={fetchStockDetails}
                  onViewReplenishment={handleViewReplenishment}
                  onStockAdjusted={fetchStockTotals}
                />
              ))
            ) : (
              <DataTableRow className="hover:bg-transparent">
                <DataTableCell
                  colSpan={10}
                  className="text-center py-8 text-muted-foreground"
                >
                  {filterOptions.searchTerm
                    ? "Nenhum produto encontrado com os critérios de busca."
                    : "Nenhum produto cadastrado. Adicione seu primeiro produto usando o botão 'Novo Produto'."}
                </DataTableCell>
              </DataTableRow>
            )}
          </DataTableBody>
        </DataTable>
      </SectionCard>

      {filteredProdutos.length > itemsPerPage && (
        <ProdutoPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={filteredProdutos.length}
          currentFirstItem={indexOfFirstItem + 1}
          currentLastItem={Math.min(indexOfLastItem, filteredProdutos.length)}
        />
      )}

      {selectedProduto && (
        <>
          <ProdutoEditarDialog
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            produto={selectedProduto}
            onSave={onEdit}
          />

          <ProdutoFornecedorDialog
            isOpen={showFornecedorModal}
            onClose={() => setShowFornecedorModal(false)}
            produto={selectedProduto}
          />

          <ProdutoEstoqueDialog
            isOpen={showStockModal}
            onClose={() => setShowStockModal(false)}
            produto={selectedProduto}
            stockDetails={stockDetails}
            isLoading={isLoadingStock}
          />

          {selectedProduto && (
            <ReposicaoModal
              isOpen={showReposicaoModal}
              onClose={() => setShowReposicaoModal(false)}
              produto={selectedProduto}
            />
          )}
        </>
      )}

      <BulkAssignDialog
        isOpen={showBulkAssignModal}
        onClose={() => setShowBulkAssignModal(false)}
        produtoIds={Array.from(selectedIds)}
        onApplied={handleBulkApplied}
      />
    </div>
  );
};

export default ProdutoList;
