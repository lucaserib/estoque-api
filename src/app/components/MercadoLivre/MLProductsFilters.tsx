"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw } from "lucide-react";

interface MLProductsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (value: "asc" | "desc") => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  stockFilter: string;
  setStockFilter: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  accountsCount: number;
  statusCounts: Record<string, number>;
}

export default function MLProductsFilters({
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  statusFilter,
  setStatusFilter,
  stockFilter,
  setStockFilter,
  onRefresh,
  loading,
  accountsCount,
  statusCounts,
}: MLProductsFiltersProps) {
  const totalProducts = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0
  );
  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {/* Busca */}
      <div className="flex-1 min-w-[300px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar produtos por título ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Ordenação */}
      <div className="flex gap-2">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="smart">Inteligente</SelectItem>
            <SelectItem value="sales">Mais Vendidos</SelectItem>
            <SelectItem value="title">Título</SelectItem>
            <SelectItem value="price">Preço</SelectItem>
            <SelectItem value="stock">Estoque</SelectItem>
            <SelectItem value="lastSync">Última Sincronização</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as "asc" | "desc")}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Decrescente</SelectItem>
            <SelectItem value="asc">Crescente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
            <SelectItem value="under_review">Em Revisão</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo Estoque</SelectItem>
            <SelectItem value="ok">Em Estoque</SelectItem>
            <SelectItem value="low">Estoque Baixo</SelectItem>
            <SelectItem value="out">Sem Estoque</SelectItem>
            <SelectItem value="unlinked">Não Vinculado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Atualizar */}
      <Button
        onClick={onRefresh}
        disabled={loading}
        variant="outline"
        size="default"
      >
        <RefreshCw
          className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
        />
        Atualizar
      </Button>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">{totalProducts}</span>{" "}
          anúncios
        </div>
        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className="hover:text-success transition-colors"
        >
          <span className="font-medium text-success">
            {statusCounts.active || 0}
          </span>{" "}
          ativos
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("paused")}
          className="hover:text-warning transition-colors"
        >
          <span className="font-medium text-warning">
            {statusCounts.paused || 0}
          </span>{" "}
          pausados
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("closed")}
          className="hover:text-destructive transition-colors"
        >
          <span className="font-medium text-destructive">
            {statusCounts.closed || 0}
          </span>{" "}
          encerrados
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("under_review")}
          className="hover:text-info transition-colors"
        >
          <span className="font-medium text-info">
            {statusCounts.under_review || 0}
          </span>{" "}
          em revisão
        </button>
        {accountsCount > 0 && (
          <div>
            <span className="font-medium">{accountsCount}</span> conta(s)
          </div>
        )}
      </div>
    </div>
  );
}
