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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Barcode, PackageCheck, Info, Tag, DollarSign, X, Store, Loader2 } from "lucide-react";
import EANDisplay from "@/components/EANDisplay";

interface ProdutoDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto;
}

interface MLProductInfo {
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlAvailableQuantity: number;
  mlShippingMode?: string;
  mlPermalink?: string;
  mlStatus: string;
}

export function ProdutoDetalhesDialog({
  isOpen,
  onClose,
  produto,
}: ProdutoDetalhesDialogProps) {
  const [mlProducts, setMlProducts] = useState<MLProductInfo[]>([]);
  const [loadingML, setLoadingML] = useState(false);

  // Buscar produtos ML vinculados
  useEffect(() => {
    if (isOpen && produto.id) {
      fetchMLProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda ao abrir o dialog; fetchMLProducts é recriada a cada render
  }, [isOpen, produto.id]);

  const fetchMLProducts = async () => {
    setLoadingML(true);
    try {
      const response = await fetch(`/api/produtos/${produto.id}/mercadolivre`);
      if (response.ok) {
        const data = await response.json();
        setMlProducts(data.products || []);
      }
    } catch (error) {
      console.error("Erro ao buscar produtos ML:", error);
    } finally {
      setLoadingML(false);
    }
  };

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
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Info className="h-5 w-5 text-indigo-500" />
                Detalhes do Produto
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full border border-border"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2 space-y-6">
            <div className="bg-background p-4 rounded-lg border border-border">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">
                    Nome:
                  </span>
                  <span className="text-xl font-medium text-foreground">
                    {produto.nome}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Código EAN</p>
                    <EANDisplay produto={produto} className="mt-1" />
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">
                        SKU:
                      </span>
                      <div className="flex items-center">
                        <Barcode className="h-4 w-4 text-muted-foreground mr-1" />
                        <span className="text-base font-medium text-foreground">
                          {produto.sku}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <h3 className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-2">
                  <PackageCheck className="h-5 w-5" />
                  Informações de Estoque
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Estoque Total:
                    </span>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {produto.estoques
                        ? produto.estoques.reduce(
                            (sum, item) => sum + item.quantidade,
                            0
                          )
                        : 0}{" "}
                      unidades
                    </Badge>
                  </div>
                  {produto.estoques && produto.estoques.length > 0 ? (
                    <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                      {produto.estoques.map((estoque, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center text-sm bg-card/50 p-1.5 rounded"
                        >
                          <span>{estoque.armazem?.nome || "Armazém"}</span>
                          <Badge
                            variant="outline"
                            className="bg-card"
                          >
                            {estoque.quantidade} un.
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Produto sem estoque cadastrado
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800">
                <h3 className="font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5" />
                  Informações Financeiras
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Custo Médio:
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      R${" "}
                      {produto.custoMedio
                        ? (produto.custoMedio / 100).toFixed(2)
                        : "0.00"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Valor em Estoque:
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      R${" "}
                      {produto.custoMedio && produto.estoques
                        ? (
                            (produto.custoMedio / 100) *
                            produto.estoques.reduce(
                              (sum, item) => sum + item.quantidade,
                              0
                            )
                          ).toFixed(2)
                        : "0.00"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção Mercado Livre */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-100 dark:border-yellow-800">
              <h3 className="font-medium text-yellow-700 dark:text-yellow-300 flex items-center gap-2 mb-2">
                <Store className="h-5 w-5" />
                Mercado Livre
              </h3>
              {loadingML ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
                </div>
              ) : mlProducts.length > 0 ? (
                <div className="space-y-2">
                  {mlProducts.map((mlProduct) => (
                    <div
                      key={mlProduct.mlItemId}
                      className="bg-card/50 p-3 rounded border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground line-clamp-2">
                            {mlProduct.mlTitle}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {mlProduct.mlItemId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          R$ {(mlProduct.mlPrice / 100).toFixed(2)}
                        </Badge>
                        <Badge
                          variant={
                            mlProduct.mlAvailableQuantity > 0
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          Estoque ML: {mlProduct.mlAvailableQuantity} un.
                        </Badge>
                        {mlProduct.mlShippingMode === "fulfillment" && (
                          <Badge className="text-xs bg-purple-500 hover:bg-purple-600">
                            Full
                          </Badge>
                        )}
                        <Badge
                          variant={mlProduct.mlStatus === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {mlProduct.mlStatus === "active" ? "Ativo" : "Pausado"}
                        </Badge>
                      </div>
                      {mlProduct.mlPermalink && (
                        <a
                          href={mlProduct.mlPermalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 mt-2 inline-block"
                        >
                          Ver anúncio →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Produto não vinculado ao Mercado Livre
                </p>
              )}
            </div>

            {produto.isKit && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                <h3 className="font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-2 mb-2">
                  <Tag className="h-5 w-5" />
                  Informações do Kit
                </h3>
                {produto.componentes && produto.componentes.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    <div className="text-sm font-medium text-foreground">
                      Componentes:
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {produto.componentes.map((componente, index) => (
                        <div
                          key={index}
                          className="flex justify-between bg-card/50 p-2 rounded text-sm"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {componente.produto?.nome}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              SKU: {componente.produto?.sku}
                            </span>
                          </div>
                          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 self-center">
                            {componente.quantidade} un.
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Este kit não possui componentes cadastrados
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
