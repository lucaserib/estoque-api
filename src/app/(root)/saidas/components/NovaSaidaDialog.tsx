import { useState, useEffect, useRef } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Produto, Armazem, SaidaProduto, KitComponente } from "../types";
import BarcodeScannerSelecaoProdutos from "./BarcodeScannerSelecaoProdutos";

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
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
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
  QrCode,
  Scan,
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

// Interface para o tipo Kit
interface Kit {
  id: string;
  nome: string;
  sku: string;
  componentes?: KitComponente[];
}

// Interface que representa um produto no estoque da aplicação
interface ProdutoEstoque {
  id: string;
  nome: string;
  sku: string;
  preco: number;
  quantidadeDisponivel: number;
  unidade: string;
  categoria?: string;
  // Campos possíveis para EAN
  ean?: string;
  codigoEAN?: string;
  codigoBarras?: string;
  codigosBarrasAlternativos?: string[];
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
  const [modoBarcodeScanner, setModoBarcodeScanner] = useState(false);

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
        adicionarProdutoSaida(produtoToAdd, qty);
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
          adicionarKitSaida(kit, qty);

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

  const adicionarProdutoSaida = (produto: Produto, qty: number) => {
    setSaidaProdutos((prev) => {
      const existing = prev.find((p) => p.produtoId === produto.id && !p.isKit);

      if (existing) {
        const updated = prev.map((item) =>
          item.produtoId === produto.id && !item.isKit
            ? { ...item, quantidade: item.quantidade + qty }
            : item
        );
        return updated;
      }

      return [
        ...prev,
        {
          produtoId: produto.id,
          quantidade: qty,
          sku: produto.sku,
          nome: produto.nome,
          isKit: false,
        },
      ];
    });

    setSku("");
    setSearchTerm("");
    setQuantidade(1);
    setMessage("");
    setOpenCombobox(false);
  };

  const adicionarKitSaida = (kit: Kit, qty: number) => {
    setSaidaProdutos((prev) => {
      const existing = prev.find((p) => p.produtoId === kit.id && p.isKit);

      if (existing) {
        const updated = prev.map((item) =>
          item.produtoId === kit.id && item.isKit
            ? { ...item, quantidade: item.quantidade + qty }
            : item
        );
        return updated;
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

  // Alternar entre modo manual e modo de scanner
  const toggleScannerMode = () => {
    setModoBarcodeScanner(!modoBarcodeScanner);
  };

  // Manejador de adição de produto via scanner
  const handleProdutoScaneado = (produto: Produto, quantidade: number) => {
    adicionarProdutoSaida(produto, quantidade);
  };

  // Manejador de remoção de produto
  const handleRemoverProduto = (sku: string) => {
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Package className="h-5 w-5 text-primary" />
                Registrar Nova Saída
              </DialogTitle>
              <div className="flex items-center gap-2">
                {armazemId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleScannerMode}
                    className="flex items-center gap-1.5 h-8 text-primary hover:bg-primary/10"
                  >
                    {modoBarcodeScanner ? (
                      <>
                        <Search className="h-4 w-4" />
                        Modo Manual
                      </>
                    ) : (
                      <>
                        <Scan className="h-4 w-4" />
                        Ler Código de Barras
                      </>
                    )}
                  </Button>
                )}
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
                className="text-base font-medium text-foreground mb-1 flex items-center gap-2"
              >
                <Warehouse className="h-4 w-4 text-primary" />
                Armazém
              </Label>
              <Select
                value={armazemId || ""}
                onValueChange={(value) => setArmazemId(value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full h-10 bg-card border-input">
                  <SelectValue placeholder="Selecione um armazém" />
                </SelectTrigger>
                <SelectContent>
                  {armazens.length === 0 ? (
                    <div className="p-2 text-center text-muted-foreground">
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
                <p className="mt-1 text-sm text-warning">
                  Selecione um armazém para continuar
                </p>
              )}
            </div>

            {armazemId && modoBarcodeScanner ? (
              /* Modo de leitura por código de barras */
              <BarcodeScannerSelecaoProdutos
                produtos={produtos as unknown as ProdutoEstoque[]}
                produtosSelecionados={saidaProdutos}
                onAdicionarProduto={handleProdutoScaneado}
                onRemoverProduto={handleRemoverProduto}
                onVoltarModoManual={() => setModoBarcodeScanner(false)}
              />
            ) : (
              /* Modo de adição manual de produtos */
              <>
                {/* Product search and quantity */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Product search autocomplete */}
                  <div className="md:col-span-4">
                    <Label
                      htmlFor="produto"
                      className="text-base font-medium text-foreground mb-1"
                    >
                      Produto ou Kit (SKU ou Nome)
                    </Label>
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          disabled={!armazemId || isSubmitting}
                          className={`w-full justify-between h-10 bg-card border-input ${
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
                                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
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
                                    <span className="text-xs text-muted-foreground">
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
                      className="text-base font-medium text-foreground mb-1"
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
                      className="h-10 bg-card border-input"
                    />
                  </div>
                </div>

                {/* Add product button */}
                <Button
                  type="button"
                  onClick={handleAddProduto}
                  disabled={
                    !armazemId || !sku || quantidade <= 0 || isSubmitting
                  }
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Item
                </Button>
              </>
            )}

            {/* List of added products */}
            {!modoBarcodeScanner && saidaProdutos.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Itens na Saída
                </h3>

                <div className="border border-border rounded-lg overflow-hidden">
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow className="hover:bg-transparent">
                        <DataTableHead className="pl-4">Produto</DataTableHead>
                        <DataTableHead>Tipo</DataTableHead>
                        <DataTableHead>Quantidade</DataTableHead>
                        <DataTableHead className="pr-4 text-right">Ações</DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {saidaProdutos.map((item) => (
                        <DataTableRow key={item.sku}>
                          <DataTableCell className="pl-4">
                            <div className="font-medium text-foreground">
                              {item.nome || "Produto"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {item.sku}
                            </div>
                          </DataTableCell>
                          <DataTableCell>
                            {item.isKit ? (
                              <Badge variant="outline" className="bg-info/10 text-info">
                                <Package className="h-3 w-3 mr-1" />
                                Kit
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-success/10 text-success">
                                Produto
                              </Badge>
                            )}
                          </DataTableCell>
                          <DataTableCell>
                            <Badge className="bg-info/10 text-info">
                              {item.quantidade} un.
                            </Badge>
                          </DataTableCell>
                          <DataTableCell className="pr-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoverProduto(item.sku)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sticky bottom-0 bg-card/90 border-t border-border p-4 rounded-b-xl">
            <div className="flex justify-between w-full">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="border-input"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleRegistrarSaida}
                disabled={
                  saidaProdutos.length === 0 || !armazemId || isSubmitting
                }
                className="gap-2"
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
