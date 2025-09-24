"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, Loader2 } from "lucide-react";
import { exibirValorEmReais } from "@/utils/currency";

interface Product {
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlThumbnail?: string;
}

interface LocalProduct {
  id: string;
  nome: string;
  sku: string;
  precoVenda: number;
}

interface MLProductLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: Product | null;
  localProducts: LocalProduct[];
  onLinkProduct: (mlProductId: string, localProductId: string) => Promise<void>;
  loading: boolean;
}

export default function MLProductLinkModal({
  isOpen,
  onClose,
  selectedProduct,
  localProducts,
  onLinkProduct,
  loading,
}: MLProductLinkModalProps) {
  const [selectedLocalProduct, setSelectedLocalProduct] = useState("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedLocalProduct("");
      setLinking(false);
    }
  }, [isOpen]);

  const handleLinkProduct = async () => {
    if (!selectedProduct || !selectedLocalProduct) return;

    setLinking(true);
    try {
      await onLinkProduct(selectedProduct.mlItemId, selectedLocalProduct);
      onClose();
    } catch (error) {
      console.error("Erro ao vincular produto:", error);
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular Produto do Mercado Livre</DialogTitle>
          <DialogDescription>
            Vincule este produto do Mercado Livre a um produto local para 
            sincronizar estoque automaticamente.
          </DialogDescription>
        </DialogHeader>

        {selectedProduct && (
          <div className="space-y-6">
            {/* Produto do Mercado Livre */}
            <div>
              <h4 className="font-medium mb-3">Produto do Mercado Livre</h4>
              <div className="flex items-center space-x-4 p-4 border rounded-lg bg-muted/50">
                {selectedProduct.mlThumbnail && (
                  <img
                    src={selectedProduct.mlThumbnail}
                    alt={selectedProduct.mlTitle}
                    className="w-16 h-16 rounded-md object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="font-medium mb-1">
                    {selectedProduct.mlTitle}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {selectedProduct.mlItemId}
                  </div>
                  <Badge variant="outline">
                    {exibirValorEmReais(selectedProduct.mlPrice)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Seleção do Produto Local */}
            <div>
              <h4 className="font-medium mb-3">Selecionar Produto Local</h4>
              {localProducts.length === 0 ? (
                <div className="p-4 border rounded-lg text-center text-muted-foreground">
                  <div className="font-medium mb-1">
                    Nenhum produto local encontrado
                  </div>
                  <div className="text-sm">
                    Cadastre produtos locais primeiro para poder vinculá-los
                  </div>
                </div>
              ) : (
                <Select
                  value={selectedLocalProduct}
                  onValueChange={setSelectedLocalProduct}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um produto local..." />
                  </SelectTrigger>
                  <SelectContent>
                    {localProducts.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        <div className="flex flex-col items-start py-1">
                          <span className="font-medium">{produto.nome}</span>
                          <div className="text-xs text-muted-foreground mt-1">
                            SKU: {produto.sku} | {exibirValorEmReais(produto.precoVenda)}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Informação sobre a vinculação */}
            {selectedLocalProduct && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">⚡ Sincronização Automática</div>
                  <div>
                    Após a vinculação, o estoque do Mercado Livre será 
                    automaticamente atualizado com base no estoque local.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={linking}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleLinkProduct}
            disabled={!selectedLocalProduct || linking || localProducts.length === 0}
          >
            {linking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <Link className="h-4 w-4 mr-2" />
                Vincular Produto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
