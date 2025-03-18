"use client";

import { useState, useEffect } from "react";
import { Produto } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Plus,
  Loader2,
  Save,
  Package,
  Barcode,
  AlertCircle,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FaTimes } from "react-icons/fa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProdutoFormModalProps {
  onClose: () => void;
  onSave: (produto: Produto) => void;
}

interface KitProduto {
  produtoId: string;
  quantidade: number;
}

const ProdutoFormModal = ({ onClose, onSave }: ProdutoFormModalProps) => {
  const [formType, setFormType] = useState<"produto" | "kit">("produto");
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [ean, setEan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  // Estado para kits
  const [produtoSearch, setProdutoSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Produto[]>([]);
  const [kitProdutos, setKitProdutos] = useState<KitProduto[]>([]);
  const [quantidade, setQuantidade] = useState(1);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);

  const handleProdutoSearch = async () => {
    if (!produtoSearch.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/produtos?=${produtoSearch}`);
      if (!response.ok) throw new Error("Erro ao buscar produtos");

      const data = await response.json();
      const filteredData = data.filter((p: Produto) => !p.isKit);
      setSearchResults(filteredData);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      setMessage("Erro ao buscar produtos");
      setMessageType("error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddProdutoToKit = () => {
    if (!selectedProdutoId || quantidade <= 0) {
      setMessage("Selecione um produto e informe uma quantidade válida");
      setMessageType("error");
      return;
    }

    // Verificar se o produto já está no kit
    if (kitProdutos.some((item) => item.produtoId === selectedProdutoId)) {
      setMessage("Este produto já foi adicionado ao kit");
      setMessageType("error");
      return;
    }

    const newKitProduto: KitProduto = {
      produtoId: selectedProdutoId,
      quantidade,
    };

    setKitProdutos([...kitProdutos, newKitProduto]);
    setSelectedProdutoId(null);
    setQuantidade(1);
    setProdutoSearch("");
    setSearchResults([]);
    setMessage("");
  };

  // Remover produto do kit
  const handleRemoveProdutoDoKit = (produtoId: string) => {
    setKitProdutos(kitProdutos.filter((item) => item.produtoId !== produtoId));
  };

  // Validar e enviar o formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setMessageType("");

    // Validação básica
    if (!nome.trim() || !sku.trim()) {
      setMessage("Nome e SKU são obrigatórios");
      setMessageType("error");
      setIsSubmitting(false);
      return;
    }

    // Validação específica para kits
    if (formType === "kit" && !kitProdutos.length) {
      setMessage("Um kit deve ter pelo menos um produto");
      setMessageType("error");
      setIsSubmitting(false);
      return;
    }

    try {
      // Construir o objeto para a API
      const produtoData = {
        nome,
        sku,
        ean: ean || null,
        isKit: formType === "kit",
        componentes: formType === "kit" ? kitProdutos : undefined,
      };

      // Endpoint correto com base no tipo
      const endpoint = formType === "kit" ? "/api/kits" : "/api/produtos";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(produtoData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ao criar ${formType}`);
      }

      const novoProduto = await response.json();

      // Transformar o BigInt EAN para string
      const produtoComEANString = {
        ...novoProduto,
        ean: novoProduto.ean ? novoProduto.ean.toString() : "",
      };

      setMessage(
        `${formType === "kit" ? "Kit" : "Produto"} criado com sucesso!`
      );
      setMessageType("success");

      // Chamar o callback com o novo produto
      onSave(produtoComEANString);

      // Limpar o formulário
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error(`Erro ao criar ${formType}:`, error);
      setMessage(
        error instanceof Error ? error.message : `Erro ao criar ${formType}`
      );
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay com blur */}
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"></div>

        {/* Modal container */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-xl text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl w-full">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Novo {formType === "kit" ? "Kit" : "Produto"}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Form content */}
          <div className="p-6">
            <form onSubmit={handleSubmit}>
              <Tabs
                defaultValue="produto"
                value={formType}
                onValueChange={(v) => setFormType(v as "produto" | "kit")}
                className="mb-6"
              >
                <TabsList className="grid grid-cols-2 w-full bg-gray-100 dark:bg-gray-800 p-1 rounded-md">
                  <TabsTrigger
                    value="produto"
                    className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
                  >
                    <Package className="h-4 w-4" />
                    Produto
                  </TabsTrigger>
                  <TabsTrigger
                    value="kit"
                    className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
                  >
                    <Package className="h-4 w-4" />
                    Kit
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Campos comuns para Produto e Kit */}
              <Card className="mb-6 border border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-md">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome</Label>
                      <Input
                        id="nome"
                        placeholder="Nome do produto"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        placeholder="Código SKU único"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="ean">EAN (Código de barras)</Label>
                      <div className="flex items-center">
                        <Barcode className="h-4 w-4 text-gray-400 mr-2" />
                        <Input
                          id="ean"
                          placeholder="EAN (opcional)"
                          value={ean}
                          onChange={(e) =>
                            setEan(e.target.value.replace(/[^0-9]/g, ""))
                          }
                          disabled={isSubmitting}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        O código EAN deve conter apenas números
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Campos específicos para Kit */}
              {formType === "kit" && (
                <Card className="mb-6 border border-gray-200 dark:border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md flex items-center gap-2">
                      <Package className="h-5 w-5 text-indigo-500" />
                      Componentes do Kit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row items-end gap-2">
                        <div className="flex-1">
                          <Label htmlFor="produtoSearch" className="mb-2 block">
                            Buscar Produto
                          </Label>
                          <div className="relative">
                            <Input
                              id="produtoSearch"
                              placeholder="Digite SKU ou nome do produto"
                              value={produtoSearch}
                              onChange={(e) => setProdutoSearch(e.target.value)}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleProdutoSearch}
                              className="absolute right-0 top-0 h-full"
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="w-full md:w-24">
                          <Label htmlFor="quantidade" className="mb-2 block">
                            Quantidade
                          </Label>
                          <Input
                            id="quantidade"
                            type="number"
                            min="1"
                            value={quantidade}
                            onChange={(e) =>
                              setQuantidade(parseInt(e.target.value) || 1)
                            }
                          />
                        </div>

                        <Button
                          type="button"
                          onClick={handleAddProdutoToKit}
                          disabled={!selectedProdutoId || isSubmitting}
                          className="w-full md:w-auto self-end mt-2 md:mt-0"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>

                      {isSearching ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="border rounded-md overflow-hidden mt-2">
                          <ScrollArea className="max-h-40">
                            <div className="divide-y">
                              {searchResults.map((produto) => (
                                <div
                                  key={produto.id}
                                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center ${
                                    selectedProdutoId === produto.id
                                      ? "bg-blue-50 dark:bg-blue-900/20"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    setSelectedProdutoId(produto.id)
                                  }
                                >
                                  <div>
                                    <p className="font-medium">
                                      {produto.nome}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      SKU: {produto.sku}
                                    </p>
                                  </div>
                                  {selectedProdutoId === produto.id && (
                                    <div className="bg-blue-500 text-white rounded-full p-1">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        produtoSearch &&
                        !isSearching && (
                          <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
                            Nenhum produto encontrado. Tente outro termo.
                          </div>
                        )
                      )}

                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Produtos no Kit ({kitProdutos.length})
                        </h4>

                        {kitProdutos.length === 0 ? (
                          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-md border border-dashed border-gray-300 dark:border-gray-700">
                            <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Adicione produtos ao seu kit
                            </p>
                          </div>
                        ) : (
                          <ScrollArea className="h-48 border rounded-md">
                            <div className="space-y-2 p-2">
                              {kitProdutos.map((kitProduto) => {
                                const produto = searchResults.find(
                                  (p) => p.id === kitProduto.produtoId
                                ) || {
                                  id: kitProduto.produtoId,
                                  nome: "Produto",
                                  sku: "SKU",
                                };

                                return (
                                  <div
                                    key={kitProduto.produtoId}
                                    className="flex justify-between items-center border rounded-md p-2 bg-gray-50 dark:bg-gray-800"
                                  >
                                    <div className="flex-1">
                                      <span className="text-sm text-gray-900 dark:text-gray-200">
                                        {produto?.nome ||
                                          "Produto não encontrado"}
                                      </span>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        SKU: {produto?.sku || "N/A"}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                      <Badge
                                        variant="outline"
                                        className="bg-blue-50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                                      >
                                        Qtd: {kitProduto.quantidade}
                                      </Badge>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleRemoveProdutoDoKit(
                                            kitProduto.produtoId
                                          )
                                        }
                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                      >
                                        <FaTimes className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {message && (
                <Alert
                  variant={
                    messageType === "success" ? "success" : "destructive"
                  }
                  className="mt-4 mb-4"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="border-gray-200 dark:border-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Cadastrar</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProdutoFormModal;
