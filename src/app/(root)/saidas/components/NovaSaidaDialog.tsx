import { useState, useEffect, useRef } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Produto, Armazem, SaidaProduto, KitComponente } from "../types";

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
import { Badge } from "@/components/ui/badge";
import {
  X,
  Search,
  Plus,
  Trash2,
  Warehouse,
  Package,
  Loader2,
  ChevronDown,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NovaSaidaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function NovaSaidaDialog({
  isOpen,
  onClose,
  onSave,
}: NovaSaidaDialogProps) {
  // State for form fields
  const [sku, setSku] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [saidaProdutos, setSaidaProdutos] = useState<SaidaProduto[]>([]);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch armazens and produtos from API
  const { data: armazens = [] } = useFetch<Armazem[]>("/api/estoque/armazens");
  const { data: produtos = [], loading: produtosLoading } = useFetch<Produto[]>(
    armazemId ? `/api/produtos?armazemId=${armazemId}` : ""
  );

  // Filter products based on search term
  const filteredProdutos = produtos.filter(
    (produto) =>
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleAddProduto = async () => {
    if (!sku || quantidade <= 0) {
      setMessage("Insira um SKU válido e uma quantidade maior que zero.");
      setMessageType("error");
      return;
    }

    const qty = Number(quantidade);
    const produtoToAdd = produtos.find((p) => p.sku === sku);

    try {
      if (produtoToAdd && !produtoToAdd.isKit) {
        // Adicionar produto simples
        setSaidaProdutos((prev) => {
          const existing = prev.find(
            (p) => p.produtoId === produtoToAdd.id && !p.isKit
          );
          if (existing) {
            existing.quantidade += qty;
            return [...prev];
          }
          return [
            ...prev,
            {
              produtoId: produtoToAdd.id,
              quantidade: qty,
              sku: produtoToAdd.sku,
              nome: produtoToAdd.nome,
              isKit: false,
            },
          ];
        });
      } else {
        // Tentar buscar um kit com o SKU informado
        setMessage("Buscando kit...");
        setMessageType("");

        try {
          const kitResponse = await fetch(
            `/api/kits?sku=${encodeURIComponent(sku)}`
          );

          if (!kitResponse.ok) {
            const errorData = await kitResponse.json();
            setMessage(errorData.error || "Erro ao buscar o kit.");
            setMessageType("error");
            return;
          }

          const kitData = await kitResponse.json();

          if (!kitData || kitData.length === 0) {
            setMessage("Produto ou kit não encontrado.");
            setMessageType("error");
            return;
          }

          const kit = kitData[0];
          console.log("Kit encontrado:", kit);

          // Adicionar kit à lista de saída
          setSaidaProdutos((prev) => {
            const existing = prev.find(
              (p) => p.produtoId === kit.id && p.isKit
            );

            if (existing) {
              existing.quantidade += qty;
              return [...prev];
            }

            return [
              ...prev,
              {
                produtoId: kit.id,
                quantidade: qty,
                sku: kit.sku,
                nome: kit.nome,
                isKit: true,
              },
            ];
          });

          setSku("");
          setSearchTerm("");
          setQuantidade(1);
          setMessage("");
          setOpenCombobox(false);
        } catch (error) {
          console.error("Erro ao buscar kit:", error);
          setMessage(
            "Erro ao buscar o kit. Verifique o console para mais detalhes."
          );
          setMessageType("error");
        }
      }
    } catch (error) {
      console.error("Erro ao adicionar item:", error);
      setMessage(
        "Erro ao adicionar item. Verifique o console para mais detalhes."
      );
      setMessageType("error");
    }
  };

  const handleRegistrarSaida = async () => {
    if (saidaProdutos.length === 0 || !armazemId) {
      setMessage("Adicione itens e selecione um armazém.");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);

    try {
      // Preparar dados para envio
      const produtosFormatados = saidaProdutos.map((produto) => ({
        produtoId: produto.produtoId,
        quantidade: produto.quantidade,
        sku: produto.sku,
        nome: produto.nome,
        isKit: produto.isKit,
      }));

      console.log("Enviando dados para API:", {
        produtos: produtosFormatados,
        armazemId,
      });

      const response = await fetch("/api/saida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtos: produtosFormatados,
          armazemId,
        }),
      });

      const responseData = await response.json();
      console.log("Resposta da API:", responseData);

      if (response.ok) {
        setMessage("Saída registrada com sucesso!");
        setMessageType("success");
        setSaidaProdutos([]);
        onSave();
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage(responseData.error || "Erro ao registrar saída.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao registrar saída:", error);
      setMessage(
        "Erro ao registrar saída. Verifique o console para mais detalhes."
      );
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };
  {
    message && (
      <Alert
        variant={messageType === "success" ? "success" : "destructive"}
        className="mb-4"
      >
        {messageType === "success" ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertDescription className="whitespace-pre-line">
          {message}
        </AlertDescription>
      </Alert>
    );
  }

  // Handler for removing a product from the list
  const handleRemoveProduto = (sku: string) => {
    setSaidaProdutos((prev) => prev.filter((p) => p.sku !== sku));
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
                <Package className="h-5 w-5 text-indigo-500" />
                Registrar Nova Saída
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

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2 space-y-6">
            {/* Message alert */}
            {message && (
              <Alert
                variant={messageType === "success" ? "success" : "destructive"}
                className="mb-4"
              >
                {messageType === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {/* Armazém selection */}
            <div>
              <Label
                htmlFor="armazem"
                className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2"
              >
                <Warehouse className="h-4 w-4 text-indigo-500" />
                Armazém
              </Label>
              <Select
                value={armazemId || ""}
                onValueChange={(value) => setArmazemId(value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Selecione um armazém" />
                </SelectTrigger>
                <SelectContent>
                  {armazens.length === 0 ? (
                    <div className="p-2 text-center text-gray-500 dark:text-gray-400">
                      Nenhum armazém encontrado
                    </div>
                  ) : (
                    armazens.map((armazem) => (
                      <SelectItem key={armazem.id} value={armazem.id}>
                        {armazem.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!armazemId && (
                <p className="mt-1 text-sm text-amber-500 dark:text-amber-400">
                  Selecione um armazém para continuar
                </p>
              )}
            </div>

            {/* Product search and quantity */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {/* Product search autocomplete */}
              <div className="md:col-span-4">
                <Label
                  htmlFor="produto"
                  className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Produto ou Kit (SKU ou Nome)
                </Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={!armazemId || isSubmitting}
                      className={`w-full justify-between h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 ${
                        !armazemId ? "opacity-50" : ""
                      }`}
                    >
                      {sku ? sku : "Selecione um produto ou kit..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {produtosLoading ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mr-2" />
                              <span>Carregando...</span>
                            </div>
                          ) : (
                            "Nenhum produto encontrado"
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredProdutos.map((produto) => (
                            <CommandItem
                              key={produto.id}
                              value={produto.sku}
                              onSelect={(currentValue) => {
                                setSku(currentValue);
                                setOpenCombobox(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span>{produto.nome}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  SKU: {produto.sku}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity input */}
              <div className="md:col-span-2">
                <Label
                  htmlFor="quantidade"
                  className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Quantidade
                </Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  disabled={!armazemId || isSubmitting}
                  className="h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>

            {/* Add product button */}
            <Button
              type="button"
              onClick={handleAddProduto}
              disabled={!armazemId || !sku || quantidade <= 0 || isSubmitting}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-700 dark:hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>

            {/* List of added products */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-500" />
                Itens na Saída
              </h3>

              {saidaProdutos.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                  <Package className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum item adicionado ainda
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                      <TableRow>
                        <TableHead className="font-medium">Produto</TableHead>
                        <TableHead className="font-medium text-center">
                          Tipo
                        </TableHead>
                        <TableHead className="font-medium text-center">
                          Quantidade
                        </TableHead>
                        <TableHead className="font-medium text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saidaProdutos.map((item) => (
                        <TableRow
                          key={item.sku}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <TableCell>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {item.nome || "Produto"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {item.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.isKit ? (
                              <Badge
                                variant="outline"
                                className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                              >
                                <Package className="h-3 w-3 mr-1" />
                                Kit
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800"
                              >
                                Produto
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {item.quantidade} un.
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveProduto(item.sku)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>{" "}
          <DialogFooter className="sticky bottom-0 bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 rounded-b-xl">
            <div className="flex justify-between w-full">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="border-gray-300 dark:border-gray-600"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleRegistrarSaida}
                disabled={
                  saidaProdutos.length === 0 || !armazemId || isSubmitting
                }
                className="gap-2 bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Registrar Saída
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
