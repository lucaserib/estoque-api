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
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce de busca; incluir searchTimeout/handleProdutoSearch causaria refetch em loop
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Link className="h-5 w-5 text-primary" />
                Produtos de {fornecedor.nome}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-8 w-8 rounded-full border border-border"
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
                <Package className="h-5 w-5 text-primary" />
                Produtos Vinculados
              </h3>

              {isLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : produtosVinculados.length === 0 ? (
                <div className="bg-background p-6 rounded-lg border border-border text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Nenhum produto vinculado a este fornecedor.
                  </p>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHead className="pl-4">Produto</DataTableHead>
                        <DataTableHead>Preço</DataTableHead>
                        <DataTableHead>Mult.</DataTableHead>
                        <DataTableHead>Código NF</DataTableHead>
                        <DataTableHead className="pr-4 text-right">
                          Ações
                        </DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {produtosVinculados.map((vinculo) => (
                        <DataTableRow key={vinculo.id}>
                          <DataTableCell className="pl-4 font-medium">
                            <div>
                              <div className="font-medium">
                                {vinculo.produto?.nome || "Nome não disponível"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                SKU: {vinculo.produto?.sku || "N/A"}
                              </div>
                            </div>
                          </DataTableCell>
                          <DataTableCell>
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
                          </DataTableCell>
                          <DataTableCell>
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
                          </DataTableCell>
                          <DataTableCell>
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
                          </DataTableCell>
                          <DataTableCell className="pr-4 text-right">
                            <div className="flex justify-end space-x-1">
                              {editingId === vinculo.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveEdit(vinculo.id)}
                                    disabled={isSubmitting}
                                    className="h-8 w-8 p-0 text-success hover:bg-success/10"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingId(null)}
                                    disabled={isSubmitting}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
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
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(vinculo.id)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
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
            <div className="bg-background p-4 rounded-lg border border-border">
              <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
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
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Search className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {isSearching ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="border rounded-md overflow-hidden mt-2">
                    <ScrollArea className="max-h-40">
                      <div className="divide-y">
                        {searchResults.map((produto) => (
                          <div
                            key={produto.id}
                            className={`px-3 py-2 cursor-pointer hover:bg-muted flex justify-between items-center ${
                              selectedProdutoId === produto.id
                                ? "bg-primary/10"
                                : ""
                            }`}
                            onClick={() => setSelectedProdutoId(produto.id)}
                          >
                            <div>
                              <p className="font-medium">{produto.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {produto.sku}
                              </p>
                            </div>
                            {selectedProdutoId === produto.id && (
                              <div className="bg-primary text-primary-foreground rounded-full p-1">
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
                    <div className="text-center py-4 text-muted-foreground text-sm bg-background rounded-md border border-border">
                      <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
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
                  className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
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
