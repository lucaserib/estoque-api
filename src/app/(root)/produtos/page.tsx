"use client";

import { useState, useEffect } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import Header from "@/app/components/Header";
import ProdutoList from "./components/ProdutoList";
import KitList from "./components/KitList";
import ProdutoFormModal from "./components/ProdutoFormModal";
import { Produto } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ProdutosPage = () => {
  const [activeTab, setActiveTab] = useState<"produtos" | "kits">("produtos");
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const handleDelete = async (id: string | number) => {
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
      <div className="container max-w-6xl mx-auto p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="bg-gray-200 dark:bg-gray-700 h-8 w-48 rounded-md"></div>
          <div className="bg-gray-200 dark:bg-gray-700 h-10 w-32 rounded-md"></div>
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 h-12 w-full rounded-md mb-6"></div>
        <div className="bg-gray-200 dark:bg-gray-700 h-96 w-full rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <Header name="Gestão de Produtos" />
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md text-red-700 dark:text-red-300 mt-6">
          <p className="text-center">{error}</p>
          <div className="flex justify-center mt-4">
            <Button onClick={refreshData} variant="outline" className="mx-auto">
              Tentar novamente
            </Button>
          </div>
        </div>
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
                className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900"
              >
                Produtos
              </TabsTrigger>
              <TabsTrigger
                value="kits"
                className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900"
              >
                Kits
              </TabsTrigger>
            </TabsList>
            <div className="p-6 min-h-[50vh]">
              <TabsContent value="produtos" className="mt-0">
                <ProdutoList
                  produtos={regularProducts}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  refreshTrigger={refreshTrigger}
                />
              </TabsContent>
              <TabsContent value="kits" className="mt-0">
                <KitList
                  kits={kits}
                  onDelete={handleDelete}
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
    </div>
  );
};

export default ProdutosPage;
