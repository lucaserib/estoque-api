"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Store,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  Link,
  Package,
  RotateCcw,
  History,
  ShoppingCart,
  Settings,
  Eye,
  Edit,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import MercadoLivreConfigHelp from "@/app/components/MercadoLivreConfigHelp";
import {
  MercadoLivreAccount,
  ProdutoMercadoLivre,
  MLSyncResult,
  MercadoLivreSyncHistory,
} from "@/types/mercadolivre";
import { exibirValorEmReais } from "@/utils/currency";
import Image from "next/image";

export default function MercadoLivreConfigPage() {
  const [accounts, setAccounts] = useState<MercadoLivreAccount[]>([]);
  const [products, setProducts] = useState<ProdutoMercadoLivre[]>([]);
  const [syncHistory, setSyncHistory] = useState<MercadoLivreSyncHistory[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("produtos");

  // Estados de loading
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncResult, setSyncResult] = useState<MLSyncResult | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  // Estado de debug
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    redirectUri?: string;
    authUrl?: string;
    hasCredentials?: boolean;
    error?: string;
  }>({});

  // Novos estados para analytics
  const [analyticsData, setAnalyticsData] = useState<{
    sales: {
      totalSales: number;
      totalRevenue: number;
      averageTicket: number;
      period: string;
    } | null;
    fees: {
      listingFee: number;
      saleFee: number;
      paymentFee: number;
      shippingFee: number;
      category: string;
    } | null;
    financial: {
      accountBalance: number;
      pendingBalance: number;
      availableBalance: number;
      currency: string;
    } | null;
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [skuSyncResult, setSkuSyncResult] = useState<{
    matched: number;
    unmatched: number;
    total: number;
    results: Array<{
      mlItemId: string;
      localProductId?: string;
      sku: string;
      title: string;
      status: "matched" | "unmatched";
    }>;
  } | null>(null);
  const [loadingSkuSync, setLoadingSkuSync] = useState(false);

  // Filtros e paginação
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const checkAuthCallback = useCallback(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      toast.error(`Erro na autorização: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (code && state) {
      try {
        setConnecting(true);

        const response = await fetch("/api/mercadolivre/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });

        const data = await response.json();

        if (data.success) {
          toast.success(
            `Conta ${data.account.nickname} conectada com sucesso!`
          );
          await loadAccounts();
        } else {
          toast.error(data.error || "Erro ao conectar conta");
        }
      } catch (error) {
        console.error("Erro ao processar callback:", error);
        toast.error("Erro ao conectar conta");
      } finally {
        setConnecting(false);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/mercadolivre/auth?action=accounts");
      const data = await response.json();

      if (response.ok) {
        setAccounts(data);
        if (data.length > 0 && !selectedAccount) {
          setSelectedAccount(data[0].id);
        }
      } else {
        toast.error(data.error || "Erro ao carregar contas");
      }
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    checkAuthCallback();
  }, [loadAccounts, checkAuthCallback]);

  useEffect(() => {
    if (selectedAccount) {
      loadProducts(selectedAccount);
      loadSyncHistory(selectedAccount);
      loadAnalytics(selectedAccount);
    }
  }, [selectedAccount]);

  const loadProducts = async (accountId: string) => {
    try {
      const response = await fetch(
        `/api/mercadolivre/sync?accountId=${accountId}`
      );
      const data = await response.json();

      if (response.ok) {
        setProducts(data);
      } else {
        toast.error(data.error || "Erro ao carregar produtos");
      }
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos");
    }
  };

  const loadSyncHistory = async (accountId: string) => {
    try {
      const response = await fetch(
        `/api/mercadolivre/sync?accountId=${accountId}&action=history`
      );
      const data = await response.json();

      if (response.ok) {
        setSyncHistory(data);
      } else {
        console.error("Erro ao carregar histórico:", data.error);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  };

  const loadAnalytics = async (accountId: string) => {
    try {
      setLoadingAnalytics(true);
      const response = await fetch(
        `/api/mercadolivre/analytics?accountId=${accountId}&action=dashboard`
      );
      const data = await response.json();

      if (response.ok) {
        setAnalyticsData(data);
      } else {
        console.error("Erro ao carregar analytics:", data.error);
      }
    } catch (error) {
      console.error("Erro ao carregar analytics:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const connectAccount = async () => {
    try {
      setConnecting(true);

      const response = await fetch("/api/mercadolivre/auth?action=connect");
      const data = await response.json();

      if (data.authUrl) {
        // Salvar informações de debug
        setDebugInfo({
          authUrl: data.authUrl,
          redirectUri: data.redirectUri,
          hasCredentials: true,
        });

        console.log("URL de autorização gerada:", data.authUrl);
        window.location.href = data.authUrl;
      } else {
        setDebugInfo({
          error: data.error || "Erro ao gerar URL de autorização",
          hasCredentials: false,
        });
        toast.error("Erro ao gerar URL de autorização");
      }
    } catch (error) {
      console.error("Erro ao conectar conta:", error);
      setDebugInfo({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        hasCredentials: false,
      });
      toast.error("Erro ao conectar conta");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectAccount = async (accountId: string) => {
    if (!confirm("Tem certeza que deseja desconectar esta conta?")) return;

    try {
      const response = await fetch(
        `/api/mercadolivre/auth?accountId=${accountId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Conta desconectada com sucesso");
        await loadAccounts();
        if (selectedAccount === accountId) {
          setSelectedAccount(null);
          setProducts([]);
          setSyncHistory([]);
        }
      } else {
        toast.error(data.error || "Erro ao desconectar conta");
      }
    } catch (error) {
      console.error("Erro ao desconectar conta:", error);
      toast.error("Erro ao desconectar conta");
    }
  };

  const syncProducts = async (accountId: string, syncType: string = "full") => {
    if (!accountId) return;

    try {
      setSyncing(true);
      setSyncProgress(0);
      setShowSyncDialog(true);

      const response = await fetch("/api/mercadolivre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, syncType }),
      });

      const result: MLSyncResult = await response.json();
      setSyncResult(result);

      if (result.success) {
        toast.success(
          `Sincronização concluída! ${result.syncedItems} produtos sincronizados.`
        );
        await loadProducts(accountId);
        await loadSyncHistory(accountId);
      } else {
        toast.error("Sincronização finalizada com erros");
      }
    } catch (error) {
      console.error("Erro na sincronização:", error);
      toast.error("Erro durante a sincronização");
    } finally {
      setSyncing(false);
    }
  };

  const syncProductsBySKU = async (accountId: string) => {
    try {
      setLoadingSkuSync(true);
      const response = await fetch(
        `/api/mercadolivre/analytics?accountId=${accountId}&action=sync-sku`
      );
      const data = await response.json();

      if (response.ok) {
        setSkuSyncResult(data);
        toast.success(
          `Sincronização concluída: ${data.matched} produtos encontrados`
        );
      } else {
        toast.error(data.error || "Erro ao sincronizar produtos");
      }
    } catch (error) {
      console.error("Erro ao sincronizar produtos:", error);
      toast.error("Erro ao sincronizar produtos");
    } finally {
      setLoadingSkuSync(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: {
        label: "Ativo",
        variant: "default" as const,
        color: "bg-green-100 text-green-800",
      },
      paused: {
        label: "Pausado",
        variant: "secondary" as const,
        color: "bg-yellow-100 text-yellow-800",
      },
      closed: {
        label: "Finalizado",
        variant: "destructive" as const,
        color: "bg-red-100 text-red-800",
      },
      under_review: {
        label: "Em Revisão",
        variant: "outline" as const,
        color: "bg-blue-100 text-blue-800",
      },
      inactive: {
        label: "Inativo",
        variant: "secondary" as const,
        color: "bg-gray-100 text-gray-800",
      },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || {
      label: status,
      variant: "outline" as const,
      color: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge variant={statusInfo.variant} className={statusInfo.color}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getSyncStatusBadge = (status: string) => {
    const statusMap = {
      success: {
        label: "Sucesso",
        color: "bg-green-100 text-green-800",
        icon: CheckCircle,
      },
      error: {
        label: "Erro",
        color: "bg-red-100 text-red-800",
        icon: AlertCircle,
      },
      running: {
        label: "Executando",
        color: "bg-blue-100 text-blue-800",
        icon: Loader2,
      },
      partial: {
        label: "Parcial",
        color: "bg-yellow-100 text-yellow-800",
        icon: AlertCircle,
      },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || {
      label: status,
      color: "bg-gray-100 text-gray-800",
      icon: AlertCircle,
    };

    const Icon = statusInfo.icon;

    return (
      <Badge className={`${statusInfo.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Filtrar produtos
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.mlTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.produto?.sku?.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && product.mlStatus === statusFilter;
  });

  // Paginação
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Estatísticas
  const stats = {
    total: products.length,
    active: products.filter((p) => p.mlStatus === "active").length,
    paused: products.filter((p) => p.mlStatus === "paused").length,
    totalValue: products.reduce((sum, p) => sum + p.mlPrice, 0),
    totalQuantity: products.reduce((sum, p) => sum + p.mlAvailableQuantity, 0),
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Header name="Mercado Livre" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex justify-between items-center">
        <Header name="Integração Mercado Livre" />
        <Button
          onClick={connectAccount}
          disabled={connecting}
          className="gap-2"
        >
          {connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Conectar Conta
        </Button>
      </div>

      {/* Componente de Ajuda */}
      <MercadoLivreConfigHelp />

      {/* Debug Panel */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-800">Informações de Debug</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
            >
              {showDebugInfo ? "Ocultar" : "Mostrar"}
            </Button>
          </CardTitle>
        </CardHeader>
        {showDebugInfo && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Status da Conexão</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Contas ativas:</strong> {accounts.length}
                  </p>
                  <p>
                    <strong>Endpoint de auth:</strong> auth.mercadolivre.com.br
                  </p>
                  {debugInfo.hasCredentials !== undefined && (
                    <p>
                      <strong>Credenciais configuradas:</strong>{" "}
                      {debugInfo.hasCredentials ? "✅ Sim" : "❌ Não"}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">URLs de Debug</h4>
                <div className="text-xs space-y-1">
                  {debugInfo.authUrl && (
                    <div>
                      <strong>URL de autorização:</strong>
                      <div className="bg-gray-100 p-2 rounded mt-1 break-all">
                        {debugInfo.authUrl}
                      </div>
                    </div>
                  )}
                  {debugInfo.redirectUri && (
                    <div>
                      <strong>Redirect URI:</strong>
                      <div className="bg-gray-100 p-2 rounded mt-1 break-all">
                        {debugInfo.redirectUri}
                      </div>
                    </div>
                  )}
                  {debugInfo.error && (
                    <div>
                      <strong>Último erro:</strong>
                      <div className="bg-red-100 p-2 rounded mt-1 text-red-700">
                        {debugInfo.error}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Contas Conectadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Contas Conectadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Nenhuma conta conectada
              </h3>
              <p className="text-gray-500 mb-4">
                Conecte sua conta do Mercado Livre para sincronizar produtos
              </p>
              <Button onClick={connectAccount} disabled={connecting}>
                <Plus className="h-4 w-4 mr-2" />
                Conectar Primeira Conta
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedAccount === account.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedAccount(account.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                        <Store className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium">{account.nickname}</h3>
                        <p className="text-sm text-gray-500">
                          ID: {account.mlUserId} • Site: {account.siteId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Conectado
                      </Badge>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          syncProducts(account.id);
                        }}
                        disabled={syncing}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Sincronizar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          disconnectAccount(account.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {selectedAccount && products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ativos</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pausados</p>
                  <p className="text-2xl font-bold">{stats.paused}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-emerald-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Valor Total
                  </p>
                  <p className="text-2xl font-bold">
                    {exibirValorEmReais(stats.totalValue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Estoque</p>
                  <p className="text-2xl font-bold">{stats.totalQuantity}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conteúdo Principal */}
      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gerenciamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="produtos">
                  <Package className="h-4 w-4 mr-2" />
                  Produtos ({products.length})
                </TabsTrigger>
                <TabsTrigger value="analytics">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="historico">
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </TabsTrigger>
                <TabsTrigger value="pedidos">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Pedidos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="produtos" className="space-y-4">
                {/* Filtros */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Buscar produtos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todos os status</option>
                    <option value="active">Ativos</option>
                    <option value="paused">Pausados</option>
                    <option value="closed">Finalizados</option>
                  </select>
                </div>

                {/* Lista de Produtos */}
                {paginatedProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      {searchTerm || statusFilter !== "all"
                        ? "Nenhum produto encontrado"
                        : "Nenhum produto sincronizado"}
                    </h3>
                    {!searchTerm && statusFilter === "all" && (
                      <Button
                        onClick={() => syncProducts(selectedAccount)}
                        disabled={syncing}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Sincronizar Produtos
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>SKU Local</TableHead>
                            <TableHead>Preço ML</TableHead>
                            <TableHead>Quantidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Última Sinc.</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedProducts.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {product.mlThumbnail && (
                                    <Image
                                      src={product.mlThumbnail}
                                      alt={product.mlTitle}
                                      width={40}
                                      height={40}
                                      className="rounded"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium line-clamp-1">
                                      {product.mlTitle}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      ML: {product.mlItemId}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {product.produto?.sku || "N/A"}
                              </TableCell>
                              <TableCell>
                                {exibirValorEmReais(product.mlPrice)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {product.mlAvailableQuantity} un.
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(product.mlStatus)}
                              </TableCell>
                              <TableCell>
                                {new Date(
                                  product.lastSyncAt
                                ).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {product.mlPermalink && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <a
                                        href={product.mlPermalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(currentPage - 1)}
                        >
                          Anterior
                        </Button>
                        <span className="text-sm text-gray-600">
                          Página {currentPage} de {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(currentPage + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Analytics Cards */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        Estatísticas de Vendas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAnalytics ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : analyticsData?.sales ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Total de Vendas:
                            </span>
                            <span className="font-semibold">
                              {analyticsData.sales.totalSales}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Receita Total:
                            </span>
                            <span className="font-semibold">
                              {exibirValorEmReais(
                                analyticsData.sales.totalRevenue * 100
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Ticket Médio:
                            </span>
                            <span className="font-semibold">
                              {exibirValorEmReais(
                                analyticsData.sales.averageTicket * 100
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Período: {analyticsData.sales.period}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          Dados não disponíveis
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-blue-500" />
                        Taxas do Marketplace
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAnalytics ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : analyticsData?.fees ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Taxa de Venda:
                            </span>
                            <span className="font-semibold">
                              {(analyticsData.fees.saleFee * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Taxa de Pagamento:
                            </span>
                            <span className="font-semibold">
                              {(analyticsData.fees.paymentFee * 100).toFixed(1)}
                              %
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Taxa de Anúncio:
                            </span>
                            <span className="font-semibold">
                              {exibirValorEmReais(
                                analyticsData.fees.listingFee * 100
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Categoria: {analyticsData.fees.category}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          Dados não disponíveis
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* SKU Sync Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link className="h-5 w-5 text-purple-500" />
                      Sincronização por SKU
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">
                            Conectar produtos por SKU
                          </h3>
                          <p className="text-sm text-gray-600">
                            Sincronize seus produtos do ML com os produtos
                            locais usando o SKU
                          </p>
                        </div>
                        <Button
                          onClick={() => syncProductsBySKU(selectedAccount)}
                          disabled={loadingSkuSync}
                          className="gap-2"
                        >
                          {loadingSkuSync ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          Sincronizar SKU
                        </Button>
                      </div>

                      {skuSyncResult && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {skuSyncResult.matched}
                              </div>
                              <div className="text-sm text-gray-600">
                                Encontrados
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-yellow-600">
                                {skuSyncResult.unmatched}
                              </div>
                              <div className="text-sm text-gray-600">
                                Não encontrados
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {skuSyncResult.total}
                              </div>
                              <div className="text-sm text-gray-600">Total</div>
                            </div>
                          </div>

                          {skuSyncResult.results.length > 0 && (
                            <div className="max-h-60 overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Item ML</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {skuSyncResult.results
                                    .slice(0, 10)
                                    .map(
                                      (result: {
                                        mlItemId: string;
                                        localProductId?: string;
                                        sku: string;
                                        title: string;
                                        status: "matched" | "unmatched";
                                      }) => (
                                        <TableRow key={result.mlItemId}>
                                          <TableCell className="max-w-xs truncate">
                                            {result.title}
                                          </TableCell>
                                          <TableCell>{result.sku}</TableCell>
                                          <TableCell>
                                            <Badge
                                              variant={
                                                result.status === "matched"
                                                  ? "default"
                                                  : "secondary"
                                              }
                                              className={
                                                result.status === "matched"
                                                  ? "bg-green-100 text-green-800"
                                                  : ""
                                              }
                                            >
                                              {result.status === "matched"
                                                ? "Encontrado"
                                                : "Não encontrado"}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      )
                                    )}
                                </TableBody>
                              </Table>
                              {skuSyncResult.results.length > 10 && (
                                <div className="text-center text-sm text-gray-500 mt-2">
                                  ... e mais {skuSyncResult.results.length - 10}{" "}
                                  resultados
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="historico" className="space-y-4">
                {syncHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      Nenhuma sincronização executada
                    </h3>
                    <p className="text-gray-500">
                      Execute uma sincronização para ver o histórico
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Itens</TableHead>
                          <TableHead>Duração</TableHead>
                          <TableHead>Resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncHistory.map((history) => (
                          <TableRow key={history.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {formatDate(history.startedAt)}
                                </span>
                                {history.completedAt && (
                                  <span className="text-sm text-gray-500">
                                    Concluído: {formatDate(history.completedAt)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {history.syncType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getSyncStatusBadge(history.status)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>Total: {history.totalItems}</div>
                                <div className="text-green-600">
                                  ✓ {history.syncedItems}
                                </div>
                                {history.errorItems > 0 && (
                                  <div className="text-red-600">
                                    ✗ {history.errorItems}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {history.duration ? (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  {formatDuration(history.duration)}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {history.newItems > 0 && (
                                  <div className="text-blue-600">
                                    +{history.newItems} novos
                                  </div>
                                )}
                                {history.updatedItems > 0 && (
                                  <div className="text-orange-600">
                                    ↻ {history.updatedItems} atualizados
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pedidos" className="space-y-4">
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    Funcionalidade em desenvolvimento
                  </h3>
                  <p className="text-gray-500">
                    A gestão de pedidos do ML será implementada em breve
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Sincronização */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sincronizando Produtos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {syncing ? (
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Sincronizando produtos do Mercado Livre...</p>
                <Progress value={syncProgress} className="mt-2" />
              </div>
            ) : syncResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {syncResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <h3 className="font-medium">
                    {syncResult.success
                      ? "Sincronização Concluída"
                      : "Sincronização com Erros"}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total de Produtos:</p>
                    <p className="font-medium">{syncResult.totalItems}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Sincronizados:</p>
                    <p className="font-medium">{syncResult.syncedItems}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Novos:</p>
                    <p className="font-medium text-green-600">
                      {syncResult.newItems}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Atualizados:</p>
                    <p className="font-medium text-blue-600">
                      {syncResult.updatedItems}
                    </p>
                  </div>
                </div>

                {syncResult.duration && (
                  <div className="text-sm text-gray-600">
                    Duração: {formatDuration(syncResult.duration)}
                  </div>
                )}

                {syncResult.errors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Erros encontrados:</p>
                      <ul className="list-disc pl-4 text-sm">
                        {syncResult.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {syncResult.errors.length > 5 && (
                          <li>
                            ... e mais {syncResult.errors.length - 5} erros
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
