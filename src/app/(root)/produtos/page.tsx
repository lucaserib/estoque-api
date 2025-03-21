"use client";

import { useState, useEffect } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import Header from "@/app/components/Header";
import ProdutoList from "./components/ProdutoList";
import ProdutoFormModal from "./components/ProdutoFormModal";
import { ProdutoDeleteDialog } from "@/components/ProdutoDeleteDialog";
import { Produto } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Package, Box, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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

  useEffect(() => {
    if (initialProdutos) {
      // Garantir que todos os produtos tenham o campo EAN como string
      setProdutos(
        initialProdutos.map((p) => ({
          ...p,
          ean: p.ean?.toString() || "",
        }))
      );
    }
  }, [initialProdutos]);

  // Separar produtos e kits
  const kits = produtos.filter((p) => p.isKit);
  const regularProducts = produtos.filter((p) => !p.isKit);

  // Função para atualizar todo o estado após mudanças
  const refreshData = async () => {
    await refetch();
    setRefreshTrigger((prev) => prev + 1);
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
    // Adicionar o novo produto ao estado local
    setProdutos((prev) => [...prev, newProduto]);

    // Mostrar mensagem de sucesso
    toast.success(
      `${newProduto.isKit ? "Kit" : "Produto"} cadastrado com sucesso`
    );

    // Atualizar os dados
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card className="mb-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <Skeleton className="h-12 w-full rounded-t-lg" />
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <Header name="Gestão de Produtos" />
        <Alert variant="destructive" className="mt-6">
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
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <Header name="Gestão de Produtos" />
        <Button
          onClick={() => setShowCreateModal(true)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <PlusCircle className="h-4 w-4" />
          Novo Produto/Kit
        </Button>
      </div>

      <Card className="mb-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardContent className="p-0">
          <Tabs
            defaultValue="produtos"
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "produtos" | "kits")
            }
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg h-12">
              <TabsTrigger
                value="produtos"
                className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Produtos
                <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
                  {regularProducts.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="kits"
                className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 flex items-center gap-2"
              >
                <Box className="h-4 w-4" />
                Kits
                <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
                  {kits.length}
                </span>
              </TabsTrigger>
            </TabsList>
            <div className="p-6 min-h-[50vh]">
              <TabsContent value="produtos" className="mt-0">
                <ProdutoList
                  produtos={regularProducts}
                  onDelete={(id) =>
                    setProdutoToDelete({
                      id,
                      nome:
                        regularProducts.find((p) => p.id === id)?.nome || "",
                    })
                  }
                  onEdit={handleEdit}
                  refreshTrigger={refreshTrigger}
                />
              </TabsContent>
              <TabsContent value="kits" className="mt-0">
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
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {showCreateModal && (
        <ProdutoFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
        />
      )}

      {/* Delete Dialog */}
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
