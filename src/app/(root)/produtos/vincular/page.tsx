"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Link2,
  Loader2,
  Search,
  CheckCircle2,
  Package,
  Store,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";

interface MLProduct {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlAvailableQuantity: number;
  mlThumbnail?: string;
  mlPermalink: string;
  mlStatus: string;
  mlShippingMode?: string;
}

interface LocalProduct {
  id: string;
  sku: string;
  nome: string;
  ean: string | null;
  estoqueTotal: number;
}

function VincularProdutosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [mlAccount, setMlAccount] = useState<{ id: string } | null>(null);
  const [produtosPendentes, setProdutosPendentes] = useState<MLProduct[]>([]);
  const [produtosLocais, setProdutosLocais] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const [searchML, setSearchML] = useState("");
  const [searchLocal, setSearchLocal] = useState("");
  const [selectedML, setSelectedML] = useState<string | null>(null);
  const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
  const [syncStock, setSyncStock] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      loadData();
    }
  }, [status]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Buscar conta ML ativa
      const mlRes = await fetch("/api/mercadolivre/auth?action=accounts");
      if (mlRes.ok) {
        const mlAccounts = await mlRes.json();
        const activeML = Array.isArray(mlAccounts)
          ? mlAccounts.find((acc: { isActive: boolean }) => acc.isActive)
          : mlAccounts.accounts?.find(
              (acc: { isActive: boolean }) => acc.isActive
            );

        if (activeML) {
          setMlAccount(activeML);

          // Buscar produtos pendentes
          const pendentesRes = await fetch(
            `/api/produtos/pendentes?mlAccountId=${activeML.id}`
          );
          if (pendentesRes.ok) {
            const data = await pendentesRes.json();
            setProdutosPendentes(data.pendentes || []);
            setProdutosLocais(data.locais || []);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleVincular = async () => {
    if (!selectedML || !selectedLocal) {
      toast.error("Selecione um produto ML e um produto local");
      return;
    }

    setLinking(true);
    try {
      const response = await fetch("/api/produtos/vincular-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mlProductId: selectedML,
          localProductId: selectedLocal,
          syncStock,
        }),
      });

      if (!response.ok) throw new Error("Erro ao vincular");

      const result = await response.json();

      toast.success(
        `Produto vinculado! ${
          result.data.stockSynced ? "Estoque sincronizado." : ""
        }`
      );

      // Remover da lista de pendentes
      setProdutosPendentes((prev) => prev.filter((p) => p.id !== selectedML));

      // Limpar seleção
      setSelectedML(null);
      setSelectedLocal(null);
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao vincular produto");
    } finally {
      setLinking(false);
    }
  };

  const filteredML = produtosPendentes.filter(
    (p) =>
      p.mlTitle.toLowerCase().includes(searchML.toLowerCase()) ||
      p.mlItemId.toLowerCase().includes(searchML.toLowerCase())
  );

  const filteredLocal = produtosLocais.filter(
    (p) =>
      p.nome.toLowerCase().includes(searchLocal.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchLocal.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto p-6">
        <Header
          title="Vincular Produtos"
          subtitle="Conectar produtos locais com anúncios do Mercado Livre"
        />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!mlAccount) {
    return (
      <div className="container mx-auto p-6">
        <Header
          title="Vincular Produtos"
          subtitle="Conectar produtos locais com anúncios do Mercado Livre"
        />
        <Card>
          <CardContent className="p-8 text-center">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              Conecte sua conta do Mercado Livre
            </h3>
            <p className="text-muted-foreground mb-6">
              Para vincular produtos, primeiro conecte sua conta do Mercado
              Livre.
            </p>
            <Button onClick={() => router.push("/produtos/importar")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ir para Integrações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Header
        title="Vincular Produtos Pendentes"
        subtitle={`${produtosPendentes.length} produtos aguardando vinculação`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/produtos")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={() => router.push("/produtos/importar")}>
            <Store className="h-4 w-4 mr-2" />
            Integrações
          </Button>
        </div>
      </Header>

      {produtosPendentes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">
              Todos os produtos estão vinculados!
            </h3>
            <p className="text-muted-foreground mb-6">
              Não há produtos pendentes de vinculação no momento.
            </p>
            <Button onClick={() => router.push("/produtos")}>
              <Package className="h-4 w-4 mr-2" />
              Ver Produtos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Área de Vinculação */}
          <Card>
            <CardHeader>
              <CardTitle>Selecione os Produtos para Vincular</CardTitle>
              <CardDescription>
                Escolha um produto do Mercado Livre e vincule com um produto
                local
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produtos ML Pendentes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Store className="h-4 w-4 text-yellow-500" />
                      Mercado Livre ({filteredML.length})
                    </h3>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por título ou MLB..."
                      value={searchML}
                      onChange={(e) => setSearchML(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                    {filteredML.map((produto) => (
                      <div
                        key={produto.id}
                        onClick={() => setSelectedML(produto.id)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 transition-colors ${
                          selectedML === produto.id
                            ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {produto.mlThumbnail && (
                            <Image
                              src={produto.mlThumbnail}
                              alt={produto.mlTitle}
                              width={60}
                              height={60}
                              className="rounded object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {produto.mlTitle}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {produto.mlItemId}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                R$ {(produto.mlPrice / 100).toFixed(2)}
                              </Badge>
                              <Badge
                                variant={
                                  produto.mlAvailableQuantity > 0
                                    ? "default"
                                    : "destructive"
                                }
                                className="text-xs"
                              >
                                ML: {produto.mlAvailableQuantity} un.
                              </Badge>
                              {produto.mlShippingMode === "fulfillment" && (
                                <Badge className="text-xs bg-purple-500 hover:bg-purple-600">
                                  Full
                                </Badge>
                              )}
                            </div>
                          </div>
                          {selectedML === produto.id && (
                            <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredML.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>Nenhum produto encontrado</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Produtos Locais */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      Produtos Locais ({filteredLocal.length})
                    </h3>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome ou SKU..."
                      value={searchLocal}
                      onChange={(e) => setSearchLocal(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                    {filteredLocal.map((produto) => (
                      <div
                        key={produto.id}
                        onClick={() => setSelectedLocal(produto.id)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 transition-colors ${
                          selectedLocal === produto.id
                            ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {produto.nome}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {produto.sku}
                            </p>
                            {produto.ean && (
                              <p className="text-xs text-gray-400">
                                EAN: {produto.ean}
                              </p>
                            )}
                            <Badge
                              variant={
                                produto.estoqueTotal > 0
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs mt-1"
                            >
                              Estoque: {produto.estoqueTotal} un.
                            </Badge>
                          </div>
                          {selectedLocal === produto.id && (
                            <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredLocal.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>Nenhum produto encontrado</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ação de Vinculação */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="syncStock"
                    checked={syncStock}
                    onCheckedChange={(checked) =>
                      setSyncStock(checked as boolean)
                    }
                  />
                  <label
                    htmlFor="syncStock"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Sincronizar estoque local → Mercado Livre
                  </label>
                </div>

                <Button
                  onClick={handleVincular}
                  disabled={!selectedML || !selectedLocal || linking}
                  className="w-full"
                  size="lg"
                >
                  {linking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Vincular Produtos Selecionados
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function VincularProdutosPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6 flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <VincularProdutosContent />
    </Suspense>
  );
}
