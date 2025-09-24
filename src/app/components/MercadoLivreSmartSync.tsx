"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Link,
  Unlink,
  Eye,
  Search,
  Package,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import MLImage from "./shared/MLImage";
import { exibirValorEmReais } from "@/utils/currency";

interface SmartProduct {
  mlItemId: string;
  title: string;
  price: number;
  thumbnail?: string;
  permalink: string;
  status: string;
  availableQuantity: number;
  soldQuantity: number;
  realSku?: string;
  matchStatus: 'matched' | 'potential_match' | 'similar_found' | 'unmatched';
  localProduct?: {
    id: string;
    nome: string;
    sku: string;
  };
  suggestedMatches: Array<{
    id: string;
    nome: string;
    sku: string;
  }>;
  existingML?: {
    id: string;
    syncStatus: string;
    lastSyncAt: string;
  };
}

interface SmartSyncProps {
  accountId: string;
}

export default function MercadoLivreSmartSync({ accountId }: SmartSyncProps) {
  const [produtos, setProdutos] = useState<SmartProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<'smart' | 'unmatched' | 'matched' | 'all'>('smart');
  const [selectedProduct, setSelectedProduct] = useState<SmartProduct | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedLocalProduct, setSelectedLocalProduct] = useState<string>('');
  const [linking, setLinking] = useState(false);
  const [summary, setSummary] = useState<{
    total?: number;
    processed?: number;
    matched?: number;
    potential_matches?: number;
    similar_found?: number;
    unmatched?: number;
  }>({});

  useEffect(() => {
    fetchSmartProducts();

    // Auto-refresh a cada 30 segundos quando a aba está ativa
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSmartProducts();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [accountId, syncMode]);

  const fetchSmartProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/mercadolivre/produtos-inteligente?accountId=${accountId}&mode=${syncMode}`
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar produtos');
      }

      const data = await response.json();
      setProdutos(data.produtos || []);
      setSummary(data.summary || {});
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkProduct = async (mlItemId: string, localProductId: string) => {
    setLinking(true);
    try {
      const response = await fetch('/api/mercadolivre/produtos-inteligente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          mlItemId,
          localProductId,
          action: 'link',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao vincular produto');
      }

      toast.success('Produto vinculado com sucesso!');
      setLinkDialogOpen(false);
      setSelectedProduct(null);
      fetchSmartProducts(); // Recarregar lista
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao vincular produto');
    } finally {
      setLinking(false);
    }
  };

  const handleIgnoreProduct = async (mlItemId: string) => {
    try {
      const response = await fetch('/api/mercadolivre/produtos-inteligente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          mlItemId,
          action: 'ignore',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao ignorar produto');
      }

      toast.success('Produto marcado como ignorado');
      fetchSmartProducts(); // Recarregar lista
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao ignorar produto');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" />Vinculado</Badge>;
      case 'potential_match':
        return <Badge variant="warning" className="gap-1"><AlertCircle className="h-3 w-3" />Match Potencial</Badge>;
      case 'similar_found':
        return <Badge variant="secondary" className="gap-1"><Search className="h-3 w-3" />Similares</Badge>;
      case 'unmatched':
        return <Badge variant="destructive" className="gap-1"><HelpCircle className="h-3 w-3" />Não Vinculado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openLinkDialog = (product: SmartProduct) => {
    setSelectedProduct(product);
    setSelectedLocalProduct('');
    setLinkDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header com resumo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Sincronização Inteligente de Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <Select value={syncMode} onValueChange={(value) => setSyncMode(value as 'smart' | 'unmatched' | 'matched' | 'all')}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart">🎯 Inteligente</SelectItem>
                    <SelectItem value="unmatched">❌ Não Vinculados</SelectItem>
                    <SelectItem value="matched">✅ Vinculados</SelectItem>
                    <SelectItem value="all">📋 Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchSmartProducts} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.total || 0}</div>
                <div className="text-sm text-gray-500">Total ML</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.potential_matches || 0}</div>
                <div className="text-sm text-gray-500">Match Potencial</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{summary.similar_found || 0}</div>
                <div className="text-sm text-gray-500">Similares</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.unmatched || 0}</div>
                <div className="text-sm text-gray-500">Não Vinculados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{summary.matched || 0}</div>
                <div className="text-sm text-gray-500">Vinculados</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de produtos */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Carregando produtos inteligentes...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto ML</TableHead>
                  <TableHead>SKU Real</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Produto Local</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((produto) => (
                  <TableRow key={produto.mlItemId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MLImage
                          src={produto.thumbnail || ""}
                          alt={produto.title}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-md object-cover"
                        />
                        <div>
                          <div className="font-medium text-sm line-clamp-2 max-w-xs">
                            {produto.title}
                          </div>
                          <div className="text-xs text-gray-500">{produto.mlItemId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {produto.realSku ? (
                        <Badge variant="outline" className="font-mono">
                          {produto.realSku}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">Sem SKU</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(produto.matchStatus)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {exibirValorEmReais(produto.price * 100)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={produto.availableQuantity > 0 ? "success" : "destructive"}>
                        {produto.availableQuantity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {produto.localProduct ? (
                        <div>
                          <div className="font-medium text-sm">{produto.localProduct.nome}</div>
                          <div className="text-xs text-gray-500">{produto.localProduct.sku}</div>
                        </div>
                      ) : produto.suggestedMatches.length > 0 ? (
                        <div className="text-sm text-blue-600">
                          {produto.suggestedMatches.length} sugestão(ões)
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Não vinculado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {produto.matchStatus !== 'matched' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openLinkDialog(produto)}
                            className="h-8"
                          >
                            <Link className="h-3 w-3 mr-1" />
                            Vincular
                          </Button>
                        )}
                        {produto.matchStatus === 'unmatched' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleIgnoreProduct(produto.mlItemId)}
                            className="h-8 text-gray-500"
                          >
                            <Unlink className="h-3 w-3 mr-1" />
                            Ignorar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(produto.permalink, '_blank')}
                          className="h-8"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de vinculação */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular Produto ML com Produto Local</DialogTitle>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
                <h4 className="font-medium mb-2">Produto Mercado Livre</h4>
                <div className="flex items-center gap-3">
                  <MLImage
                    src={selectedProduct.thumbnail || ""}
                    alt={selectedProduct.title}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-md object-cover"
                  />
                  <div>
                    <div className="font-medium">{selectedProduct.title}</div>
                    <div className="text-sm text-gray-500">{selectedProduct.mlItemId}</div>
                    {selectedProduct.realSku && (
                      <div className="text-sm">
                        <Badge variant="outline" className="font-mono">
                          SKU: {selectedProduct.realSku}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Selecionar Produto Local</h4>

                {selectedProduct.suggestedMatches.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Sugestões baseadas em SKU/nome:</p>
                    <div className="space-y-2">
                      {selectedProduct.suggestedMatches.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className={`p-3 border rounded-md cursor-pointer transition-colors ${
                            selectedLocalProduct === suggestion.id
                              ? 'bg-blue-50 border-blue-200'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedLocalProduct(suggestion.id)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{suggestion.nome}</div>
                              <div className="text-sm text-gray-500">SKU: {suggestion.sku}</div>
                            </div>
                            {selectedLocalProduct === suggestion.id && (
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500 mt-4">
                  💡 Para vincular com outros produtos, utilize a busca manual na aba principal de produtos ML.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedProduct && handleLinkProduct(selectedProduct.mlItemId, selectedLocalProduct)}
              disabled={!selectedLocalProduct || linking}
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
    </div>
  );
}