"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFetch } from "@/app/hooks/useFetch";
import ProdutoList from "./components/ProdutoList";
import ProdutoFormModal from "./components/ProdutoFormModal";
import { ProdutoDeleteDialog } from "@/components/ProdutoDeleteDialog";
import { Produto } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle,
  Package,
  Box,
  RefreshCw,
  LucideLoaderCircle,
  Link2,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { KitList } from "./components/KitList";

interface ProdutoToDelete {
  id: string;
  nome: string;
  vinculos?: {
    hasKits: boolean;
    hasEstoque: boolean;
    hasPedidos: boolean;
    hasSaidas: boolean;
  };
}

interface BlingAccountStatus {
  id: string;
  isActive: boolean;
}

const ProdutosPage = () => {
  const [activeTab, setActiveTab] = useState<"produtos" | "kits">("produtos");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [produtoToDelete, setProdutoToDelete] =
    useState<ProdutoToDelete | null>(null);
  const {
    data: initialProdutos,
    loading,
    error,
    refetch,
  } = useFetch<Produto[]>("/api/produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [updatingVendas, setUpdatingVendas] = useState(false);
  const [updatingBlingStock, setUpdatingBlingStock] = useState(false);
  const [blingAccount, setBlingAccount] = useState<BlingAccountStatus | null>(
    null
  );
  const blingExpired = blingAccount !== null && !blingAccount.isActive;

  useEffect(() => {
    const loadBlingStatus = async () => {
      try {
        const response = await fetch("/api/bling/auth?action=accounts");
        if (!response.ok) return;

        const accounts: BlingAccountStatus[] = await response.json();
        const active = accounts.find((acc) => acc.isActive);
        setBlingAccount(active ?? accounts[0] ?? null);
      } catch (error) {
        console.error("Erro ao verificar status do Bling:", error);
      }
    };

    loadBlingStatus();
  }, []);

  useEffect(() => {
    if (initialProdutos && initialProdutos.length > 0) {
      const formattedProdutos = initialProdutos.map((p) => ({
        ...p,
        codigoEAN: p.codigoEAN?.toString() || "",
      }));

      setProdutos(formattedProdutos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProdutos]);

  useEffect(() => {
    setPendingCount(0);
  }, [refreshTrigger]);

  const kits = produtos.filter((p) => p.isKit);
  const regularProducts = produtos.filter((p) => !p.isKit);

  const refreshData = async () => {
    await refetch();
    setRefreshTrigger((prev) => prev + 1);
  };

  const atualizarDadosML = async () => {
    setUpdatingVendas(true);
    try {
      const response = await fetch("/api/produtos/vendas-ml");
      if (response.status === 503) {
        toast.error(
          "Não foi possível carregar todos os pedidos do Mercado Livre. Tente novamente em instantes."
        );
        return;
      }
      if (response.status === 429) {
        toast.error(
          "Muitas atualizações seguidas. Aguarde alguns minutos antes de tentar de novo."
        );
        return;
      }
      if (!response.ok) {
        throw new Error("Erro ao atualizar dados");
      }

      const data = await response.json();

      await refetch();

      const totalFull = (
        Object.values(data.estoqueFullPorProduto || {}) as number[]
      ).reduce((sum, val) => sum + val, 0);

      toast.success(
        `Dados atualizados! ${data.totalPedidos} pedidos (${data.periodo.descricao}) | ${totalFull} itens no Full`
      );

      if (data.parcial) {
        toast.warning(
          `Alguns pedidos não puderam ser carregados (${data.pedidosFaltantes} faltantes). Os números podem estar incompletos.`
        );
      }

      setRefreshTrigger((prev) => prev + 1);

      const replenishmentWindow = window as Window & {
        __refreshReplenishment?: () => void;
      };
      if (replenishmentWindow.__refreshReplenishment) {
        replenishmentWindow.__refreshReplenishment();
      }
    } catch (error) {
      console.error("Erro ao atualizar dados ML:", error);
      toast.error("Erro ao atualizar dados do Mercado Livre");
    } finally {
      setUpdatingVendas(false);
    }
  };

  const reconectarBling = async () => {
    try {
      const response = await fetch("/api/bling/auth?action=connect");
      if (!response.ok) throw new Error("Erro ao conectar Bling");
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Erro ao reconectar Bling:", error);
      toast.error("Erro ao iniciar reconexão com o Bling");
    }
  };

  const atualizarEstoqueBling = async () => {
    setUpdatingBlingStock(true);
    try {
      const response = await fetch("/api/produtos/estoque-bling", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData?.code === "BLING_RECONNECT_REQUIRED") {
          setBlingAccount((prev) => (prev ? { ...prev, isActive: false } : prev));
          toast.error("Sua conexão com o Bling expirou", {
            description: "Reconecte sua conta para atualizar o estoque.",
            action: { label: "Reconectar", onClick: () => reconectarBling() },
          });
          return;
        }
        if (errorData?.code === "RATE_LIMITED") {
          toast.error(
            "Muitas atualizações seguidas. Aguarde alguns minutos antes de tentar de novo."
          );
          return;
        }
        throw new Error(errorData?.message || "Erro ao sincronizar estoque");
      }

      const data = await response.json();

      toast.success(
        `Estoque sincronizado! ${data.stats.updated}/${data.stats.total} produtos atualizados`
      );

      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Erro ao atualizar estoque do Bling:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao sincronizar estoque do Bling"
      );
    } finally {
      setUpdatingBlingStock(false);
    }
  };

  const handleDeleteProduto = async (forceDelete: boolean) => {
    if (!produtoToDelete) return;

    try {
      const response = await fetch(
        `/api/produtos?id=${produtoToDelete.id}&forceDelete=${forceDelete}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.hasVinculos) {
          setProdutoToDelete({
            ...produtoToDelete,
            vinculos: errorData.vinculos,
          });
          return;
        }
        throw new Error(errorData.message || "Erro ao excluir produto");
      }

      setProdutos((prev) =>
        prev.filter((produto) => produto.id !== produtoToDelete.id)
      );
      toast.success("Produto excluído com sucesso!");
      setProdutoToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      toast.error("Não foi possível excluir o produto. Tente novamente.");
    }
  };

  const handleEdit = (updatedProduto: Produto) => {
    setProdutos((prev) =>
      prev.map((p) => (p.id === updatedProduto.id ? updatedProduto : p))
    );
    toast.success("Produto atualizado com sucesso");
  };

  const handleSave = (newProduto: Produto) => {
    setProdutos((prev) => [...prev, newProduto]);

    toast.success(
      `${newProduto.isKit ? "Kit" : "Produto"} cadastrado com sucesso`
    );

    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <PageHeader title="Produtos" subtitle="Catálogo, estoque e fornecedores" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-2">
            <LucideLoaderCircle className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Carregando Produtos</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <PageHeader title="Produtos" subtitle="Catálogo, estoque e fornecedores" />
        <Alert variant="destructive">
          <AlertDescription className="flex justify-between items-center">
            <span>{error}</span>
            <Button onClick={refreshData} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        title="Produtos"
        subtitle="Catálogo, estoque e fornecedores"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={atualizarEstoqueBling}
              disabled={updatingBlingStock}
              title="Sincronizar estoque local com Bling"
            >
              <RefreshCw
                className={`h-4 w-4 ${updatingBlingStock ? "animate-spin" : ""}`}
              />
              {updatingBlingStock ? "Sincronizando..." : "Atualizar Estoque Bling"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={atualizarDadosML}
              disabled={updatingVendas}
              title="Atualizar vendas e estoque Full do Mercado Livre"
            >
              <RefreshCw
                className={`h-4 w-4 ${updatingVendas ? "animate-spin" : ""}`}
              />
              {updatingVendas ? "Atualizando..." : "Atualizar Dados ML"}
            </Button>
            <Link href="/produtos/importar">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Integrações
              </Button>
            </Link>
            <Link href="/produtos/importar-estoque">
              <Button variant="outline" className="gap-2">
                <Box className="h-4 w-4" />
                Importar Estoque
              </Button>
            </Link>
            {pendingCount > 0 && (
              <Link href="/produtos/vincular">
                <Button variant="outline" className="gap-2 relative">
                  <Link2 className="h-4 w-4" />
                  Vincular Pendentes
                  <span className="ml-1 bg-warning text-warning-foreground text-xs rounded-full px-2 py-0.5">
                    {pendingCount}
                  </span>
                </Button>
              </Link>
            )}
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Novo Produto/Kit
            </Button>
          </div>
        }
      />

      {blingExpired && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-semibold">Conexão com o Bling expirou</p>
                <p className="text-sm text-muted-foreground">
                  Reconecte sua conta para voltar a importar produtos e
                  sincronizar estoque.
                </p>
              </div>
            </div>
            <Button onClick={reconectarBling}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconectar
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs
        defaultValue="produtos"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "produtos" | "kits")}
      >
        <TabsList className="h-auto justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="produtos"
            className="gap-2 rounded-none border-b-2 border-transparent px-0 pb-3 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Package className="h-4 w-4" />
            Produtos
            <span className="text-xs">{regularProducts.length}</span>
          </TabsTrigger>
          <TabsTrigger
            value="kits"
            className="gap-2 rounded-none border-b-2 border-transparent px-0 pb-3 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Box className="h-4 w-4" />
            Kits
            <span className="text-xs">{kits.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-6">
          <ProdutoList
            produtos={regularProducts}
            onDelete={(id) =>
              setProdutoToDelete({
                id,
                nome: regularProducts.find((p) => p.id === id)?.nome || "",
              })
            }
            onEdit={handleEdit}
            refreshTrigger={refreshTrigger}
            onRefreshReplenishment={() => {}}
            onBulkApplied={refreshData}
          />
        </TabsContent>
        <TabsContent value="kits" className="mt-6">
          <KitList
            kits={kits}
            onDelete={(id) =>
              setProdutoToDelete({
                id,
                nome: kits.find((p) => p.id === id)?.nome || "",
              })
            }
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>

      {showCreateModal && (
        <ProdutoFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
        />
      )}

      {produtoToDelete && (
        <ProdutoDeleteDialog
          isOpen={!!produtoToDelete}
          onClose={() => setProdutoToDelete(null)}
          produtoNome={produtoToDelete.nome}
          onConfirm={handleDeleteProduto}
          hasVinculos={produtoToDelete.vinculos}
        />
      )}
    </div>
  );
};

export default ProdutosPage;
