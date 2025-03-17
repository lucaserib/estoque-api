import { useEffect, useState } from "react";
import { Produto } from "../../types";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Truck,
  Loader2,
  Plus,
  Edit,
  Check,
  Trash,
} from "lucide-react";

interface Fornecedor {
  id: string;
  nome: string;
}

interface ProdutoFornecedor {
  id: string;
  fornecedor: Fornecedor;
  preco: number;
  multiplicador: number;
  codigoNF: string;
}

interface ProdutoFornecedorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto;
}

export function ProdutoFornecedorDialog({
  isOpen,
  onClose,
  produto,
}: ProdutoFornecedorDialogProps) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedoresVinculados, setFornecedoresVinculados] = useState<
    ProdutoFornecedor[]
  >([]);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [preco, setPreco] = useState("");
  const [multiplicador, setMultiplicador] = useState("1");
  const [codigoNF, setCodigoNF] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load suppliers and linked suppliers when component mounts
  useEffect(() => {
    if (isOpen) {
      fetchFornecedores();
      fetchFornecedoresVinculados();
    }
  }, [isOpen, produto.id]);

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

  const fetchFornecedores = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/fornecedores");
      if (!response.ok) throw new Error("Erro ao buscar fornecedores");

      const data = await response.json();
      if (Array.isArray(data)) {
        setFornecedores(data);
      }
    } catch (error) {
      console.error("Erro ao buscar fornecedores", error);
      setMessage("Erro ao buscar fornecedores");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFornecedoresVinculados = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/produto-fornecedor?produtoId=${produto.id}`
      );
      if (!response.ok)
        throw new Error("Erro ao buscar fornecedores vinculados");

      const data = await response.json();
      if (Array.isArray(data)) {
        setFornecedoresVinculados(data);
      }
    } catch (error) {
      console.error("Erro ao buscar fornecedores vinculados", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVincularFornecedor = async () => {
    if (!fornecedorId || !preco || !multiplicador || !codigoNF) {
      setMessage("Preencha todos os campos para vincular um fornecedor");
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
          produtoId: produto.id,
          fornecedorId,
          preco: parseInt((parseFloat(preco) * 100).toString()), // Convert to cents
          multiplicador: parseFloat(multiplicador),
          codigoNF,
        }),
      });

      if (response.ok) {
        const novoFornecedor = await response.json();
        const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
        if (fornecedor) {
          setFornecedoresVinculados((prev) => [
            ...prev,
            { ...novoFornecedor, fornecedor },
          ]);
        }
        setMessage("Fornecedor vinculado com sucesso");
        setMessageType("success");
        setFornecedorId("");
        setPreco("");
        setMultiplicador("1");
        setCodigoNF("");
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao vincular fornecedor");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao vincular fornecedor", error);
      setMessage("Erro ao vincular fornecedor");
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
        setFornecedoresVinculados(
          fornecedoresVinculados.filter((vinculo) => vinculo.id !== vinculoId)
        );
        setMessage("Vínculo removido com sucesso");
        setMessageType("success");
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
    setPreco((vinculo.preco / 100).toString()); // Convert from cents
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
          preco: parseInt((parseFloat(preco) * 100).toString()),
          multiplicador: parseFloat(multiplicador),
          codigoNF,
        }),
      });

      if (response.ok) {
        const fornecedorAtualizado = await response.json();
        const fornecedor = fornecedoresVinculados.find(
          (vinculo) => vinculo.id === vinculoId
        )?.fornecedor;

        setFornecedoresVinculados((prev) =>
          prev.map((vinculo) =>
            vinculo.id === vinculoId
              ? { ...fornecedorAtualizado, fornecedor: fornecedor } // Keep the original supplier
              : vinculo
          )
        );

        setEditingId(null); // Exit edit mode
        setMessage("Fornecedor atualizado com sucesso");
        setMessageType("success");
        setPreco("");
        setMultiplicador("1");
        setCodigoNF("");
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao atualizar fornecedor");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao atualizar fornecedor", error);
      setMessage("Erro ao atualizar fornecedor");
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
                Fornecedores de {produto.nome}
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
            {/* Fornecedores vinculados */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-indigo-500" />
                Fornecedores Vinculados
              </h3>

              {isLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
              ) : fornecedoresVinculados.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                  <Truck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum fornecedor vinculado a este produto.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                      <TableRow>
                        <TableHead className="font-medium">
                          Fornecedor
                        </TableHead>
                        <TableHead className="font-medium">Preço</TableHead>
                        <TableHead className="font-medium">Mult.</TableHead>
                        <TableHead className="font-medium">Código NF</TableHead>
                        <TableHead className="font-medium text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fornecedoresVinculados.map((vinculo) => (
                        <TableRow key={vinculo.id}>
                          <TableCell className="font-medium">
                            {vinculo.fornecedor?.nome || "Nome não disponível"}
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
                              `R$ ${(vinculo.preco / 100).toFixed(2)}`
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

            {/* Adicionar Novo Fornecedor */}
            {message && (
              <Alert
                variant={messageType === "success" ? "success" : "destructive"}
                className="my-2"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 dark:bg-gray-800/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-500" />
                Vincular Novo Fornecedor
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Select value={fornecedorId} onValueChange={setFornecedorId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((fornecedor) => (
                        <SelectItem
                          key={fornecedor.id}
                          value={fornecedor.id}
                          disabled={fornecedoresVinculados.some(
                            (v) => v.fornecedor.id === fornecedor.id
                          )}
                        >
                          {fornecedor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codigoNF">Código NF</Label>
                  <Input
                    id="codigoNF"
                    placeholder="Código para nota fiscal"
                    value={codigoNF}
                    onChange={(e) => setCodigoNF(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Button
                onClick={handleVincularFornecedor}
                disabled={isSubmitting || !fornecedorId}
                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Vincular Fornecedor
                  </>
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="sticky bottom-0 bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 rounded-b-xl">
          <Button onClick={onClose} className="px-6">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
