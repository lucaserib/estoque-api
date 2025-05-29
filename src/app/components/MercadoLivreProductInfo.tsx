// src/components/MercadoLivreProductInfo.tsx

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink,
  Store,
  DollarSign,
  Package,
  Calendar,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { ProdutoMercadoLivre } from "@/types/mercadolivre";
import { exibirValorEmReais } from "@/utils/currency";
import { toast } from "sonner";

interface MercadoLivreProductInfoProps {
  produtoId: string;
  className?: string;
}

export default function MercadoLivreProductInfo({
  produtoId,
  className,
}: MercadoLivreProductInfoProps) {
  const [mlProducts, setMlProducts] = useState<ProdutoMercadoLivre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMlProducts();
  }, [produtoId]);

  const loadMlProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar produtos ML vinculados a este produto
      const response = await fetch(
        `/api/produtos/mercadolivre?produtoId=${produtoId}`
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar dados do Mercado Livre");
      }

      const data = await response.json();
      setMlProducts(data);
    } catch (error) {
      console.error("Erro ao carregar produtos ML:", error);
      setError(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: {
        label: "Ativo",
        variant: "default" as const,
        color: "text-green-600",
      },
      paused: {
        label: "Pausado",
        variant: "secondary" as const,
        color: "text-yellow-600",
      },
      closed: {
        label: "Finalizado",
        variant: "destructive" as const,
        color: "text-red-600",
      },
      under_review: {
        label: "Em Revisão",
        variant: "outline" as const,
        color: "text-blue-600",
      },
      inactive: {
        label: "Inativo",
        variant: "secondary" as const,
        color: "text-gray-600",
      },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || {
      label: status,
      variant: "outline" as const,
      color: "text-gray-600",
    };

    return (
      <Badge variant={statusInfo.variant} className={statusInfo.color}>
        {statusInfo.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={loadMlProducts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mlProducts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-yellow-500" />
            Mercado Livre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Store className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Este produto não está vinculado ao Mercado Livre
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Conecte sua conta ML e sincronize para ver os dados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4 text-yellow-500" />
          Mercado Livre
          <Badge variant="outline" className="ml-auto">
            {mlProducts.length}{" "}
            {mlProducts.length === 1 ? "anúncio" : "anúncios"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mlProducts.map((mlProduct, index) => (
          <div key={mlProduct.id}>
            {index > 0 && <Separator />}

            <div className="space-y-3">
              {/* Cabeçalho do produto */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  {mlProduct.mlThumbnail && (
                    <img
                      src={mlProduct.mlThumbnail}
                      alt={mlProduct.mlTitle}
                      className="w-12 h-12 object-cover rounded border"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-2 mb-1">
                      {mlProduct.mlTitle}
                    </h4>
                    <p className="text-xs text-gray-500">
                      ID: {mlProduct.mlItemId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(mlProduct.mlStatus)}
                  {mlProduct.mlPermalink && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a
                        href={mlProduct.mlPermalink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Informações do produto */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">Preço</p>
                    <p className="font-medium">
                      {exibirValorEmReais(mlProduct.mlPrice)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">Disponível</p>
                    <p className="font-medium">
                      {mlProduct.mlAvailableQuantity} un.
                    </p>
                  </div>
                </div>
              </div>

              {/* Categoria e última sincronização */}
              <div className="space-y-2">
                {mlProduct.mlCategoryId && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>Categoria:</span>
                    <Badge variant="outline" className="text-xs">
                      {mlProduct.mlCategoryId}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span>Última sincronização:</span>
                  <span>{formatDate(mlProduct.lastSyncAt.toString())}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Botão de atualização */}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMlProducts}
            className="w-full h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Atualizar dados ML
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
