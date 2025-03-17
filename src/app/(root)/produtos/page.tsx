"use client";

import { useState, useEffect } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import Header from "@/app/components/Header";
import ProdutoList from "./components/ProdutoList";
import KitList from "./components/KitList";
import ProdutoFormModal from "./components/ProdutoFormModal";
import { ProdutoDeleteDialog } from "./components/dialogs/ProdutoDeleteDialog";
import { Produto } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Package, Box, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const ProdutosPage = () => {
  const [activeTab, setActiveTab] = useState<"produtos" | "kits">("produtos");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);
  const {
    data: initialProdutos,
    loading,
    error,
    refetch,
  } = useFetch<Produto>("/api/produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (initialProdutos) {
      setProdutos(
        initialProdutos.map((p) => ({ ...p, ean: p.ean?.toString() || "" }))
      );
    }
  }, [initialProdutos]);

  const kits = produtos.filter((p) => p.isKit);
  const regularProducts = produtos.filter((p) => !p.isKit);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/produtos?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setProdutos((prev) => prev.filter((p) => p.id !== id));
        toast.success("Produto excluído com sucesso");
        setRefreshTrigger((prev) => prev + 1);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao excluir produto");
      }
    } catch (error) {
      console.error("Erro ao deletar produto:", error);
      toast.error("Erro ao excluir produto");
    }
  };

  const handleEdit = (updatedProduto: Produto) => {
    setProdutos((prev) =>
      prev.map((p) => (p.id === updatedProduto.id ? updatedProduto : p))
    );
    toast.success("Produto atualizado com sucesso");
  };

  const handleSave = (newProduto: Produto) => {
    setProdutos((prev) => [
      ...prev,
      { ...newProduto, ean: newProduto.ean?.toString() || "" },
    ]);
    toast.success("Produto cadastrado com sucesso");
    setRefreshTrigger((prev) => prev + 1);
  };

  const refreshData = () => {
    refetch();
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
                    setProdutoToDelete(
                      produtos.find((p) => p.id === id) || null
                    )
                  }
                  onEdit={handleEdit}
                  refreshTrigger={refreshTrigger}
                />
              </TabsContent>
              <TabsContent value="kits" className="mt-0">
                <KitList
                  kits={kits}
                  onDelete={(id) =>
                    setProdutoToDelete(
                      produtos.find((p) => p.id === id) || null
                    )
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

      {/* Dialogo de confirmação de exclusão */}
      {produtoToDelete && (
        <ProdutoDeleteDialog
          isOpen={!!produtoToDelete}
          onClose={() => setProdutoToDelete(null)}
          produto={produtoToDelete}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

export default ProdutosPage;
