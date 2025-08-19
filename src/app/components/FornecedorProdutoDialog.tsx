// src/components/FornecedorProdutoDialog.tsx
import { useEffect, useState, useCallback } from "react";
import { Fornecedor } from "@/app/(root)/fornecedores/types";
import { Produto } from "@/app/(root)/produtos/types";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Link,
  Save,
  AlertCircle,
  Package,
  Loader2,
  Plus,
  Edit,
  Check,
  Trash,
  Search,
} from "lucide-react";

interface ProdutoFornecedor {
  id: string;
  produtoId: string;
  preco: number | string | bigint;
  multiplicador: number;
  codigoNF: string;
  produto?: {
    id: string;
    nome: string;
    sku: string;
  };
}

interface FornecedorProdutoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fornecedor: Fornecedor;
}

export function FornecedorProdutoDialog({
  isOpen,
  onClose,
  fornecedor,
}: FornecedorProdutoDialogProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosVinculados, setProdutosVinculados] = useState<
    ProdutoFornecedor[]
  >([]);
  const [produtoSearch, setProdutoSearch] = useState("");
  const [produtoId, setProdutoId] = useState<string>("");
  const [preco, setPreco] = useState("");
  const [multiplicador, setMultiplicador] = useState("1");
  const [codigoNF, setCodigoNF] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Produto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(
    null
  );
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const fetchProdutosVinculados = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/produto-fornecedor?fornecedorId=${fornecedor.id}`
      );
      if (!response.ok) throw new Error("Erro ao buscar produtos vinculados");

      const data = await response.json();
      console.log("Produtos vinculados recebidos:", data);

      // Garantir que data seja sempre tratado como um array
      setProdutosVinculados(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar produtos vinculados", error);
      setProdutosVinculados([]); // Garantir que sempre tenhamos um array vazio em caso de erro
    } finally {
      setIsLoading(false);
    }
  }, [fornecedor.id]);

  // Load products and linked products when component mounts
  useEffect(() => {
    if (isOpen) {
      fetchProdutosVinculados();
    }
  }, [isOpen, fornecedor.id, fetchProdutosVinculados]);

  // Effect for cleanup on unmounting to prevent focus issues
  useEffect(() => {
    return () => {
      if (!isOpen) {
        setTimeout(() => {
          document.body.focus();
        }, 0);
      }
    };
  }, [isOpen]);

  // Effect for automatic search when typing
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (produtoSearch.trim()) {
      const timeout = setTimeout(() => {
        handleProdutoSearch();
      }, 500); // Buscar após 500ms de inatividade
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
      setSelectedProdutoId(null);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [produtoSearch, produtosVinculados]); // Adicionado produtosVinculados como dependência

  const handleProdutoSearch = async () => {
    if (!produtoSearch.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setMessage("");
    try {
      // Busca produtos pelo nome ou SKU
      const response = await fetch(
        `/api/produtos?search=${encodeURIComponent(produtoSearch.trim())}`
      );
      if (!response.ok) throw new Error("Erro ao buscar produtos");

      const data = await response.json();
      
      // Filtrar produtos que já estão vinculados
      const produtosNaoVinculados = data.filter(
        (produto: Produto) => 
          !produtosVinculados.some(vinculo => vinculo.produtoId === produto.id)
      );
      
      setSearchResults(produtosNaoVinculados);
      
      if (produtosNaoVinculados.length === 0 && data.length > 0) {
        setMessage("Todos os produtos encontrados já estão vinculados a este fornecedor");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao buscar produtos", error);
      setMessage("Erro ao buscar produtos");
      setMessageType("error");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVincularProduto = async () => {
    if (!selectedProdutoId || !preco || !multiplicador || !codigoNF) {
      setMessage("Preencha todos os campos para vincular um produto");
      setMessageType("error");
      return;
    }

    // Verificar se o produto já está vinculado
    if (produtosVinculados.some((vp) => vp.produtoId === selectedProdutoId)) {
      setMessage("Este produto já está vinculado a este fornecedor");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/produto-fornecedor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          produtoId: selectedProdutoId,
          fornecedorId: fornecedor.id,
          preco: parseFloat(preco),
          multiplicador: parseFloat(multiplicador),
          codigoNF,
        }),
      });

      if (response.ok) {
        const novoProduto = await response.json();
        const produto = searchResults.find((p) => p.id === selectedProdutoId);

        if (produto) {
          setProdutosVinculados((prev) => [
            ...prev,
            { ...novoProduto, produto },
          ]);
        }
        setMessage("Produto vinculado com sucesso");
        setMessageType("success");
        
        // Limpar mensagem de sucesso após 3 segundos
        setTimeout(() => {
          setMessage("");
          setMessageType("");
        }, 3000);
        setSelectedProdutoId(null);
        setProdutoSearch("");
        setPreco("");
        setMultiplicador("1");
        setCodigoNF("");
        setSearchResults([]);
        
        // Recarregar produtos vinculados para atualizar a lista
        await fetchProdutosVinculados();
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao vincular produto");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao vincular produto", error);
      setMessage("Erro ao vincular produto");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (vinculoId: string) => {
    if (!confirm("Tem certeza que deseja remover este vínculo?")) return;

    try {
      const response = await fetch(`/api/produto-fornecedor?id=${vinculoId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProdutosVinculados(
          produtosVinculados.filter((vinculo) => vinculo.id !== vinculoId)
        );
        setMessage("Vínculo removido com sucesso");
        setMessageType("success");
        
        // Limpar mensagem de sucesso após 3 segundos
        setTimeout(() => {
          setMessage("");
          setMessageType("");
        }, 3000);
      } else {
        setMessage("Erro ao remover vínculo");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao remover vínculo", error);
      setMessage("Erro ao remover vínculo");
      setMessageType("error");
    }
  };

  const handleEdit = (vinculo: ProdutoFornecedor) => {
    setEditingId(vinculo.id);
    // Converter o preço de centavos para reais, garantindo que seja um número
    const precoEmReais =
      typeof vinculo.preco === "number"
        ? (vinculo.preco / 100).toFixed(2)
        : (Number(vinculo.preco) / 100).toFixed(2);

    setPreco(precoEmReais);
    setMultiplicador(vinculo.multiplicador.toString());
    setCodigoNF(vinculo.codigoNF);
  };

  const handleSaveEdit = async (vinculoId: string) => {
    if (!preco || !multiplicador || !codigoNF) {
      setMessage("Preencha todos os campos para salvar a edição");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/produto-fornecedor", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: vinculoId,
          preco: parseFloat(preco),
          multiplicador: parseFloat(multiplicador),
          codigoNF,
        }),
      });

      if (response.ok) {
        const produtoAtualizado = await response.json();
        const produto = produtosVinculados.find(
          (vinculo) => vinculo.id === vinculoId
        )?.produto;

        setProdutosVinculados((prev) =>
          prev.map((vinculo) =>
            vinculo.id === vinculoId
              ? { ...produtoAtualizado, produto } // Keep the original product
              : vinculo
          )
        );

        setEditingId(null); // Exit edit mode
        setMessage("Vínculo atualizado com sucesso");
        setMessageType("success");
        
        // Limpar mensagem de sucesso após 3 segundos
        setTimeout(() => {
          setMessage("");
          setMessageType("");
        }, 3000);
        
        setPreco("");
        setMultiplicador("1");
        setCodigoNF("");
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao atualizar vínculo");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao atualizar vínculo", error);
      setMessage("Erro ao atualizar vínculo");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Ensure focus on a neutral element before closing
          document.body.focus();
          setTimeout(() => {
            onClose();
          }, 0);
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <Link className="h-5 w-5 text-indigo-500" />
                Produtos de {fornecedor.nome}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-12rem)]">
          <div className="p-6 pt-2 space-y-6">
            {/* Produtos vinculados */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-500" />
                Produtos Vinculados
              </h3>

              {isLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
              ) : produtosVinculados.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                  <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum produto vinculado a este fornecedor.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                      <TableRow>
                        <TableHead className="font-medium">Produto</TableHead>
                        <TableHead className="font-medium">Preço</TableHead>
                        <TableHead className="font-medium">Mult.</TableHead>
                        <TableHead className="font-medium">Código NF</TableHead>
                        <TableHead className="font-medium text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtosVinculados.map((vinculo) => (
                        <TableRow key={vinculo.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="font-medium">
                                {vinculo.produto?.nome || "Nome não disponível"}
                              </div>
                              <div className="text-xs text-gray-500">
                                SKU: {vinculo.produto?.sku || "N/A"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {editingId === vinculo.id ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={preco}
                                onChange={(e) => setPreco(e.target.value)}
                                disabled={isSubmitting}
                                className="w-24"
                              />
                            ) : (
                              `R$ ${(typeof vinculo.preco === "number"
                                ? vinculo.preco / 100
                                : Number(vinculo.preco) / 100
                              ).toFixed(2)}`
                            )}
                          </TableCell>
                          <TableCell>
                            {editingId === vinculo.id ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={multiplicador}
                                onChange={(e) =>
                                  setMultiplicador(e.target.value)
                                }
                                disabled={isSubmitting}
                                className="w-20"
                              />
                            ) : (
                              `${vinculo.multiplicador}x`
                            )}
                          </TableCell>
                          <TableCell>
                            {editingId === vinculo.id ? (
                              <Input
                                type="text"
                                value={codigoNF}
                                onChange={(e) => setCodigoNF(e.target.value)}
                                disabled={isSubmitting}
                              />
                            ) : (
                              vinculo.codigoNF
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1">
                              {editingId === vinculo.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveEdit(vinculo.id)}
                                    disabled={isSubmitting}
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingId(null)}
                                    disabled={isSubmitting}
                                    className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(vinculo)}
                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(vinculo.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Mensagem de sucesso ou erro */}
            {message && (
              <Alert
                variant={messageType === "success" ? "success" : "destructive"}
                className="my-2"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {/* Adicionar Novo Produto */}
            <div className="bg-gray-50 dark:bg-gray-800/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-500" />
                Vincular Novo Produto
              </h3>

              <div className="space-y-4">
                <div className="flex-1">
                  <Label htmlFor="produtoSearch" className="mb-2 block">
                    Buscar Produto
                  </Label>
                  <div className="relative">
                    <Input
                      id="produtoSearch"
                      placeholder="Digite SKU ou nome do produto (busca automática)"
                      value={produtoSearch}
                      onChange={(e) => setProdutoSearch(e.target.value)}
                      className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      ) : (
                        <Search className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
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
                            onClick={() => setSelectedProdutoId(produto.id)}
                          >
                            <div>
                              <p className="font-medium">{produto.nome}</p>
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
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
                      <Package className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p>Nenhum produto encontrado para &quot;{produtoSearch}&quot;</p>
                      <p className="text-xs mt-1">Verifique se o produto existe ou ajuste o termo de busca</p>
                    </div>
                  )
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="preco">Preço (R$)</Label>
                    <Input
                      id="preco"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={preco}
                      onChange={(e) => setPreco(e.target.value)}
                      disabled={isSubmitting || !selectedProdutoId}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="multiplicador">Multiplicador</Label>
                    <Input
                      id="multiplicador"
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="1"
                      value={multiplicador}
                      onChange={(e) => setMultiplicador(e.target.value)}
                      disabled={isSubmitting || !selectedProdutoId}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codigoNF">Código NF</Label>
                    <Input
                      id="codigoNF"
                      placeholder="Código para nota fiscal"
                      value={codigoNF}
                      onChange={(e) => setCodigoNF(e.target.value)}
                      disabled={isSubmitting || !selectedProdutoId}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleVincularProduto}
                  disabled={
                    isSubmitting ||
                    !selectedProdutoId ||
                    !preco ||
                    !multiplicador ||
                    !codigoNF
                  }
                  className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white mt-4"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Vincular Produto
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
