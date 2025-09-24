"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  Info,
  BarChart,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import MercadoLivreConfigHelp from "@/app/components/MercadoLivreConfigHelp";
import {
  MercadoLivreAccount,
  MercadoLivreAccountWithDetails,
  ProdutoMercadoLivre,
  MLSyncResult,
  MercadoLivreSyncHistory,
} from "@/types/mercadolivre";
import { exibirValorEmReais } from "@/utils/currency";
import MLImage from "@/app/components/shared/MLImage";
import MercadoLivreSmartSync from "@/app/components/MercadoLivreSmartSync";
import MercadoLivreAutoSync from "@/app/components/MercadoLivreAutoSync";

export default function MercadoLivreConfigPage() {
  const { data: session, status } = useSession();

  const [accounts, setAccounts] = useState<MercadoLivreAccountWithDetails[]>(
    []
  );
  const [products, setProducts] = useState<ProdutoMercadoLivre[]>([]);
  const [syncHistory, setSyncHistory] = useState<MercadoLivreSyncHistory[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sync-inteligente");

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
    isNgrok?: boolean;
    currentUrl?: string;
  }>({});

  // Novos estados para analytics melhorados
  const [analyticsData, setAnalyticsData] = useState<{
    userInfo?: {
      id: number;
      nickname: string;
      country_id: string;
      site_id: string;
      reputation?: any;
    };
    metrics?: {
      totalListings: number;
      activeListings: number;
      pausedListings: number;
      totalViews: number;
      totalQuestions: number;
      reputationLevel: string;
    };
    stock?: {
      totalProducts: number;
      lowStockProducts: Array<{
        id: string;
        title: string;
        availableQuantity: number;
        price: number;
        status: string;
      }>;
      outOfStockProducts: Array<{
        id: string;
        title: string;
        price: number;
        status: string;
      }>;
    };
    shipping?: {
      mercadoEnviosEnabled: boolean;
      freeShippingEnabled: boolean;
      shippingMethods: Array<{
        id: string;
        name: string;
        enabled: boolean;
      }>;
    };
    financial?: {
      accountBalance: number;
      pendingBalance: number;
      availableBalance: number;
      currency: string;
    };
    sales?: {
      totalSales: number;
      totalRevenue: number;
      averageTicket: number;
      period: string;
    };
    fees?: {
      listingFee: number;
      saleFee: number;
      paymentFee: number;
      shippingFee: number;
      category: string;
    };
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

  // Estados para controle de ngrok e callback
  const [isNgrokMode, setIsNgrokMode] = useState(false);
  const [callbackProcessed, setCallbackProcessed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Estados para importação ML
  const [importData, setImportData] = useState<{
    newProducts: Array<{
      mlItemId: string;
      title: string;
      price: number;
      thumbnail: string;
      status: string;
      isFull: boolean;
      condition: string;
      availableQuantity: number;
    }>;
    existingProducts: Array<any>;
    summary: {
      total: number;
      new: number;
      existing: number;
      fullProducts: number;
      flexProducts: number;
    };
  } | null>(null);
  const [loadingImportData, setLoadingImportData] = useState(false);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    errors: number;
    products: Array<any>;
  } | null>(null);

  // Estados para gestão de produtos importados
  const [importedProducts, setImportedProducts] = useState<Array<{
    id: string;
    nome: string;
    sku: string;
    custoMedio: number | null;
    configurationStatus: string;
    hasCost: boolean;
    hasSupplier: boolean;
    needsConfiguration: boolean;
    mlData: any;
  }>>([]);
  const [loadingImportedProducts, setLoadingImportedProducts] = useState(false);
  const [managementFilter, setManagementFilter] = useState("all");
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    nome: string;
    sku: string;
    custoMedio: number;
  } | null>(null);
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [importedProductsStats, setImportedProductsStats] = useState<{
    total: number;
    pending: number;
    configured: number;
    fullProducts: number;
    flexProducts: number;
  }>({
    total: 0,
    pending: 0,
    configured: 0,
    fullProducts: 0,
    flexProducts: 0,
  });

  // Executar apenas no client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Funções auxiliares para formatação segura
  const formatDateSafe = (date: string | Date) => {
    if (!isClient) return "Carregando...";
    try {
      return new Date(date).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });
    } catch {
      return "Data inválida";
    }
  };

  const formatDateShort = (date: string | Date) => {
    if (!isClient) return "Carregando...";
    try {
      return new Date(date).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });
    } catch {
      return "Data inválida";
    }
  };

  // Função para detectar se está no ngrok
  const isNgrokUrl = useCallback((url: string = window.location.hostname) => {
    return (
      url.includes(".ngrok") ||
      url.includes(".ngrok.io") ||
      url.includes(".ngrok-free.app")
    );
  }, []);

  // Função para obter URL base do localhost
  const getLocalhostUrl = useCallback((path: string = "/configuracoes") => {
    if (typeof window === "undefined") return "http://localhost:3000";

    // Detectar a porta atual ou usar 3000 como fallback
    const currentPort = window.location.port || "3000";
    return `http://localhost:${currentPort}${path}`;
  }, []);

  // Função para corrigir URLs de imagem com protocolo duplicado
  const fixImageUrl = (url: string): string => {
    if (!url) return "";

    let fixedUrl = url.trim();

    // Remover http:// duplicado
    if (fixedUrl.startsWith("http://http")) {
      fixedUrl = fixedUrl.replace("http://http", "http");
    }

    // Remover https:// duplicado
    if (fixedUrl.startsWith("https://https")) {
      fixedUrl = fixedUrl.replace("https://https", "https");
    }

    // Se a URL ainda não tem protocolo mas tem um domínio válido, adicionar https://
    if (!fixedUrl.startsWith("http://") && !fixedUrl.startsWith("https://")) {
      // Verificar se é um domínio válido (contém ponto e não tem //)
      if (fixedUrl.includes(".") && !fixedUrl.startsWith("//")) {
        fixedUrl = `https://${fixedUrl}`;
      }
    }

    // Garantir que URLs do Mercado Livre usem HTTPS
    if (fixedUrl.includes("mlstatic.com") && fixedUrl.startsWith("http://")) {
      fixedUrl = fixedUrl.replace("http://", "https://");
    }

    return fixedUrl;
  };

  // Função para verificar e processar callback do Mercado Livre
  const processMLCallback = useCallback(async () => {
    if (callbackProcessed) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    const isCallback = code || error;
    const isFromNgrok = isNgrokUrl();

    console.log("🔍 Processando callback ML:", {
      isCallback,
      isFromNgrok,
      hasCode: !!code,
      hasError: !!error,
      currentUrl: window.location.href,
    });

    // Atualizar debug info
    setDebugInfo((prev) => ({
      ...prev,
      isNgrok: isFromNgrok,
      currentUrl: window.location.href,
    }));

    if (!isCallback) return;

    setCallbackProcessed(true);

    // Se há erro na autorização
    if (error) {
      console.error("❌ Erro na autorização ML:", error);

      if (isFromNgrok) {
        // Salvar erro e redirecionar para localhost
        localStorage.setItem(
          "mlAuthError",
          JSON.stringify({
            error: error,
            timestamp: Date.now(),
          })
        );
        console.log("🔄 Redirecionando para localhost devido ao erro...");
        window.location.href = getLocalhostUrl("/configuracoes?ml_error=true");
        return;
      }

      toast.error(`Erro na autorização: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // Se há código de autorização
    if (code && state) {
      console.log("✅ Código de autorização recebido, processando...");
      console.log("🔍 Detalhes do callback:", {
        code: code.substring(0, 20) + "...",
        state,
        isFromNgrok,
        currentHost: window.location.hostname,
        timestamp: new Date().toISOString(),
      });

      try {
        setConnecting(true);

        console.log("📡 Enviando POST para /api/mercadolivre/auth...");
        const response = await fetch("/api/mercadolivre/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });

        console.log("📥 Status da resposta:", response.status);
        const data = await response.json();
        console.log("📡 Resposta da API:", {
          success: data.success,
          hasAccount: !!data.account,
          error: data.error,
          status: response.status,
        });

        if (data.success) {
          console.log("🎉 Conta conectada com sucesso:", data.account.nickname);

          if (isFromNgrok) {
            // Salvar sucesso e redirecionar para localhost
            console.log("💾 Salvando resultado no localStorage...");
            localStorage.setItem(
              "mlAuthSuccess",
              JSON.stringify({
                success: true,
                account: data.account,
                timestamp: Date.now(),
              })
            );
            console.log("🔄 Redirecionando para localhost com sucesso...");
            window.location.href = getLocalhostUrl(
              "/configuracoes?ml_connected=true"
            );
            return;
          }

          // Se já estamos no localhost, processar diretamente
          toast.success(
            `Conta ${data.account.nickname} conectada com sucesso!`
          );
          await loadAccounts();
        } else {
          console.error("❌ Erro ao conectar conta:", data.error);

          if (isFromNgrok) {
            console.log("💾 Salvando erro no localStorage...");
            localStorage.setItem(
              "mlAuthError",
              JSON.stringify({
                error: data.error || "Erro ao conectar conta",
                timestamp: Date.now(),
              })
            );
            window.location.href = getLocalhostUrl(
              "/configuracoes?ml_error=true"
            );
            return;
          }

          toast.error(data.error || "Erro ao conectar conta");
        }
      } catch (error) {
        console.error("💥 Erro ao processar callback:", error);

        if (isFromNgrok) {
          localStorage.setItem(
            "mlAuthError",
            JSON.stringify({
              error: "Erro ao processar callback",
              timestamp: Date.now(),
            })
          );
          window.location.href = getLocalhostUrl(
            "/configuracoes?ml_error=true"
          );
          return;
        }

        toast.error("Erro ao conectar conta");
      } finally {
        setConnecting(false);

        // Limpar URL apenas se não for ngrok
        if (!isFromNgrok) {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    }
  }, [callbackProcessed, isNgrokUrl, getLocalhostUrl]);

  // Processar resultados salvos no localStorage (vindos do ngrok)
  const processStoredResults = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mlConnected = urlParams.get("ml_connected");
    const mlError = urlParams.get("ml_error");

    if (mlConnected) {
      const authSuccess = localStorage.getItem("mlAuthSuccess");
      if (authSuccess) {
        try {
          const data = JSON.parse(authSuccess);
          // Verificar se não é muito antigo (max 2 minutos)
          if (Date.now() - data.timestamp < 120000) {
            console.log("✅ Processando sucesso salvo:", data.account.nickname);

            // Notificação mais destacada
            toast.success(
              `🎉 Conta do Mercado Livre conectada com sucesso!\n✅ Usuário: ${data.account.nickname}\n📊 Agora você pode gerenciar seus produtos e ver estatísticas!`,
              { duration: 6000 }
            );

            localStorage.removeItem("mlAuthSuccess");
            // Recarregar contas após sucesso
            setTimeout(() => loadAccounts(), 1000);
          }
        } catch (e) {
          console.error("Erro ao processar authSuccess:", e);
        }
      }
      // Limpar URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (mlError) {
      const authError = localStorage.getItem("mlAuthError");
      if (authError) {
        try {
          const data = JSON.parse(authError);
          // Verificar se não é muito antigo (max 2 minutos)
          if (Date.now() - data.timestamp < 120000) {
            console.log("❌ Processando erro salvo:", data.error);
            toast.error(`❌ Erro ao conectar conta: ${data.error}`);
            localStorage.removeItem("mlAuthError");
          }
        } catch (e) {
          console.error("Erro ao processar authError:", e);
        }
      }
      // Limpar URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      console.log("📋 Carregando contas ML...");
      const response = await fetch("/api/mercadolivre/auth?action=accounts");
      const data = await response.json();

      if (response.ok) {
        console.log(`📊 ${data.length} contas encontradas`);
        setAccounts(data);
        if (data.length > 0 && !selectedAccount) {
          setSelectedAccount(data[0].id);
          console.log("🎯 Conta selecionada:", data[0].nickname);
        }
      } else {
        console.error("❌ Erro ao carregar contas:", data.error);
        toast.error(data.error || "Erro ao carregar contas");
      }
    } catch (error) {
      console.error("💥 Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  // Efeito principal de inicialização
  useEffect(() => {
    if (status !== "authenticated") return;

    console.log("🚀 Inicializando página ML Config...");

    // Detectar se está no ngrok
    const isNgrok = isNgrokUrl();
    setIsNgrokMode(isNgrok);

    console.log("🌐 Modo ngrok:", isNgrok);
    console.log("📍 URL atual:", window.location.href);

    // Processar resultados salvos primeiro
    processStoredResults();

    // Depois processar callback se necessário
    processMLCallback();

    // Carregar contas
    loadAccounts();
  }, [
    status,
    processStoredResults,
    processMLCallback,
    loadAccounts,
    isNgrokUrl,
  ]);

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
        `/api/mercadolivre/analytics?accountId=${accountId}&type=dashboard`
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
    // Verificar se já existe uma conta conectada
    if (accounts.length > 0) {
      toast.info(
        "Você já possui uma conta conectada. Desconecte a atual para conectar uma nova."
      );
      return;
    }

    try {
      setConnecting(true);
      console.log("🔗 Iniciando conexão com Mercado Livre...");

      const response = await fetch("/api/mercadolivre/auth?action=connect");
      const data = await response.json();

      console.log("📡 Resposta da API de conexão:", {
        success: data.success,
        hasAuthUrl: !!data.authUrl,
        hasError: !!data.error,
      });

      if (data.authUrl) {
        // Salvar informações de debug
        setDebugInfo((prev) => ({
          ...prev,
          authUrl: data.authUrl,
          redirectUri: data.redirectUri,
          hasCredentials: true,
          error: undefined,
        }));

        console.log("✅ URL de autorização gerada com sucesso");
        console.log("🔄 Redirecionando para autorização ML...");

        // Redirecionar para ML
        window.location.href = data.authUrl;
      } else {
        console.error("❌ Erro ao gerar URL de autorização:", data.error);
        setDebugInfo((prev) => ({
          ...prev,
          error: data.error || "Erro ao gerar URL de autorização",
          hasCredentials: false,
        }));
        toast.error(data.error || "Erro ao gerar URL de autorização");
      }
    } catch (error) {
      console.error("💥 Erro ao conectar conta:", error);
      setDebugInfo((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        hasCredentials: false,
      }));
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
      
      // Toast inicial
      toast.info("🔄 Iniciando sincronização com Mercado Livre...", {
        duration: 2000
      });

      const response = await fetch("/api/mercadolivre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, syncType }),
      });

      const result: MLSyncResult = await response.json();
      setSyncResult(result);

      if (result.success) {
        const successMessage = [
          `✅ Sincronização concluída!`,
          `📦 ${result.totalItems} produtos encontrados`,
          `🔄 ${result.syncedItems} produtos sincronizados`,
          result.newItems > 0 ? `🆕 ${result.newItems} produtos novos` : '',
          result.updatedItems > 0 ? `📝 ${result.updatedItems} produtos atualizados` : '',
        ].filter(Boolean).join('\n');

        toast.success(successMessage, { 
          duration: 6000 
        });
        
        // Recarregar dados
        await Promise.all([
          loadProducts(accountId),
          loadSyncHistory(accountId),
          loadAnalytics(accountId)
        ]);
      } else {
        toast.error(`❌ Sincronização com erros: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error("Erro na sincronização:", error);
      toast.error("💥 Erro durante a sincronização: " + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setSyncing(false);
    }
  };

  const syncProductsBySKU = async (accountId: string) => {
    try {
      setLoadingSkuSync(true);
      const response = await fetch(
        `/api/mercadolivre/analytics?accountId=${accountId}&type=sync`
      );
      const data = await response.json();

      if (response.ok) {
        setSkuSyncResult(data.syncResults);
        toast.success(
          `Sincronização concluída: ${data.syncResults.matched} produtos encontrados`
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

  const loadImportableProducts = async (accountId: string) => {
    try {
      setLoadingImportData(true);
      const response = await fetch(
        `/api/produtos/importar-ml?accountId=${accountId}`
      );
      const data = await response.json();

      if (response.ok) {
        setImportData(data);
        setSelectedForImport(new Set()); // Reset selection
        toast.success(
          `${data.summary.new} produtos encontrados para importação`
        );
      } else {
        toast.error(data.error || "Erro ao carregar produtos");
      }
    } catch (error) {
      console.error("Erro ao carregar produtos para importação:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoadingImportData(false);
    }
  };

  const importSelectedProducts = async (accountId: string) => {
    if (selectedForImport.size === 0) {
      toast.error("Selecione pelo menos um produto para importar");
      return;
    }

    try {
      setImporting(true);
      toast.info(`Importando ${selectedForImport.size} produtos...`);

      const response = await fetch("/api/produtos/importar-ml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          selectedItems: Array.from(selectedForImport),
          defaultValues: {
            custoMedio: 0,
          },
        }),
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        toast.success(
          `✅ ${result.imported} produtos importados com sucesso!`
        );
        
        // Recarregar dados
        await Promise.all([
          loadProducts(accountId),
          loadImportableProducts(accountId), // Atualizar lista de importação
        ]);
        
        // Limpar seleção
        setSelectedForImport(new Set());
      } else {
        toast.error(`Importação com erros: ${result.errors} falhas`);
      }
    } catch (error) {
      console.error("Erro ao importar produtos:", error);
      toast.error("Erro durante a importação");
    } finally {
      setImporting(false);
    }
  };

  const toggleProductSelection = (mlItemId: string) => {
    const newSelection = new Set(selectedForImport);
    if (newSelection.has(mlItemId)) {
      newSelection.delete(mlItemId);
    } else {
      newSelection.add(mlItemId);
    }
    setSelectedForImport(newSelection);
  };

  const selectAllProducts = () => {
    if (!importData?.newProducts) return;
    
    if (selectedForImport.size === importData.newProducts.length) {
      // Desselecionar todos
      setSelectedForImport(new Set());
    } else {
      // Selecionar todos
      setSelectedForImport(new Set(importData.newProducts.map(p => p.mlItemId)));
    }
  };

  const loadImportedProducts = async (statusFilter: string = "all") => {
    try {
      setLoadingImportedProducts(true);
      const response = await fetch(
        `/api/produtos/ml-importados?status=${statusFilter}`
      );
      const data = await response.json();

      if (response.ok) {
        setImportedProducts(data.products);
        setImportedProductsStats(data.stats);
      } else {
        toast.error(data.error || "Erro ao carregar produtos importados");
      }
    } catch (error) {
      console.error("Erro ao carregar produtos importados:", error);
      toast.error("Erro ao carregar produtos importados");
    } finally {
      setLoadingImportedProducts(false);
    }
  };

  const updateProduct = async (updates: {
    nome?: string;
    sku?: string;
    custoMedio?: number;
  }) => {
    if (!editingProduct) return;

    try {
      setUpdatingProduct(true);
      const response = await fetch("/api/produtos/ml-importados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.id,
          updates,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Produto atualizado com sucesso!");
        setEditingProduct(null);
        await loadImportedProducts(managementFilter);
      } else {
        toast.error("Erro ao atualizar produto");
      }
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      toast.error("Erro ao atualizar produto");
    } finally {
      setUpdatingProduct(false);
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

  // Verificar sessão
  if (status === "loading") {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Header name="Mercado Livre" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Verificando autenticação...</span>
        </div>
      </div>
    );
  }

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

      {/* Aviso quando estiver no ngrok */}
      {isNgrokMode && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin">
                <Loader2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-blue-800">
                  Processando autorização do Mercado Livre
                </h3>
                <p className="text-sm text-blue-600">
                  Você será redirecionado automaticamente para o localhost em
                  alguns segundos...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Componente de Ajuda */}
      <MercadoLivreConfigHelp />

      {/* Banner de boas-vindas quando há conta conectada */}
      {accounts.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">
                  🎉 Mercado Livre conectado com sucesso!
                </h3>
                <p className="text-sm text-green-700">
                  Você possui {accounts.length} conta
                  {accounts.length > 1 ? "s" : ""} conectada
                  {accounts.length > 1 ? "s" : ""}. Agora você pode gerenciar
                  produtos, ver estatísticas de vendas e sincronizar seu
                  estoque.
                </p>
              </div>
              <div className="text-right">
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600"
                >
                  ✅ Ativo
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <p>
                    <strong>Modo ngrok:</strong>{" "}
                    {isNgrokMode ? "✅ Sim" : "❌ Não"}
                  </p>
                  <p>
                    <strong>Callback processado:</strong>{" "}
                    {callbackProcessed ? "✅ Sim" : "❌ Não"}
                  </p>
                  <p>
                    <strong>Status sessão:</strong> {status}
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
                <h4 className="font-medium text-sm mb-2">URLs e Logs</h4>
                <div className="text-xs space-y-1">
                  {debugInfo.currentUrl && (
                    <div>
                      <strong>URL atual:</strong>
                      <div className="bg-gray-100 p-2 rounded mt-1 break-all">
                        {debugInfo.currentUrl}
                      </div>
                    </div>
                  )}
                  {debugInfo.authUrl && (
                    <div>
                      <strong>URL de autorização:</strong>
                      <div className="bg-gray-100 p-2 rounded mt-1 break-all">
                        {debugInfo.authUrl.substring(0, 100)}...
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

            {/* Actions do Debug */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2">Ações de Debug</h4>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("🔄 Recarregando contas...");
                    loadAccounts();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Recarregar Contas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.clear();
                    toast.info("Cache do localStorage limpo");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar Cache
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("🔍 Estado atual:", {
                      accounts,
                      selectedAccount,
                      isNgrokMode,
                      callbackProcessed,
                      debugInfo,
                    });
                  }}
                >
                  <Info className="h-4 w-4 mr-1" />
                  Log Estado
                </Button>
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
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Contas Mercado Livre</h3>
              <Button
                onClick={connectAccount}
                disabled={connecting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Conectar Conta
                  </>
                )}
              </Button>
            </div>

            {accounts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma conta do Mercado Livre conectada.
                <br />
                Clique em "Conectar Conta" para adicionar uma conta.
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <Card key={account.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{account.nickname}</h4>
                          <Badge variant="secondary">{account.siteId}</Badge>
                          {account.userInfo?.sellerReputation
                            ?.powerSellerStatus === "platinum" && (
                            <Badge
                              variant="outline"
                              className="text-purple-600 border-purple-600"
                            >
                              ⭐ Power Seller
                            </Badge>
                          )}
                        </div>

                        {account.userInfo && (
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>
                              Nome: {account.userInfo.firstName}{" "}
                              {account.userInfo.lastName}
                            </p>
                            <p>Email: {account.userInfo.email}</p>
                            <p>Tipo: {account.userInfo.userType}</p>
                            <p>Pontos: {account.userInfo.points}</p>
                            {account.userInfo.sellerReputation?.levelId && (
                              <p>
                                Reputação:{" "}
                                {account.userInfo.sellerReputation.levelId}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(account.id);
                            loadAnalytics(account.id);
                          }}
                        >
                          <BarChart className="mr-1 h-4 w-4" />
                          Analytics
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(account.id);
                            syncProducts(account.id, "full");
                          }}
                          disabled={syncing}
                          className="gap-2"
                        >
                          {syncing && selectedAccount === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          {syncing && selectedAccount === account.id
                            ? "Sincronizando..."
                            : "Atualizar Produtos"}
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => disconnectAccount(account.id)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Desconectar
                        </Button>
                      </div>
                    </div>

                    {/* Dados de Analytics */}
                    {analyticsData && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-medium mb-2">Dashboard ML</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {analyticsData.metrics && (
                            <>
                              <div>
                                <p className="text-gray-600">Anúncios Ativos</p>
                                <p className="font-medium">
                                  {analyticsData.metrics.activeListings}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Total Anúncios</p>
                                <p className="font-medium">
                                  {analyticsData.metrics.totalListings}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Pausados</p>
                                <p className="font-medium">
                                  {analyticsData.metrics.pausedListings}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Reputação</p>
                                <p className="font-medium">
                                  {analyticsData.metrics.reputationLevel}
                                </p>
                              </div>
                            </>
                          )}
                          {analyticsData.financial && (
                            <>
                              <div>
                                <p className="text-gray-600">
                                  Saldo Disponível
                                </p>
                                <p className="font-medium">
                                  {exibirValorEmReais(
                                    analyticsData.financial.availableBalance
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Saldo Pendente</p>
                                <p className="font-medium">
                                  {exibirValorEmReais(
                                    analyticsData.financial.pendingBalance
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Saldo Total</p>
                                <p className="font-medium">
                                  {exibirValorEmReais(
                                    analyticsData.financial.accountBalance
                                  )}
                                </p>
                              </div>
                            </>
                          )}
                          {analyticsData.stock && (
                            <div>
                              <p className="text-gray-600">Estoque Baixo</p>
                              <p className="font-medium text-yellow-600">
                                {analyticsData.stock.lowStockProducts.length}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {selectedAccount && products.length > 0 && (
        <div className="space-y-4">
          {/* Última Sincronização */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-blue-800">Última Sincronização</h3>
                    <p className="text-sm text-blue-600">
                      {products.length > 0 && isClient
                        ? `${formatDateSafe(products[0]?.lastSyncAt)} - ${products.length} produtos sincronizados`
                        : "Aguardando primeira sincronização..."
                      }
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => syncProducts(selectedAccount, "full")}
                  disabled={syncing}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Estatísticas */}
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
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="sync-inteligente">
                  <Package className="h-4 w-4 mr-2" />
                  Sincronização Inteligente
                </TabsTrigger>
                <TabsTrigger value="auto-sync">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronização Automática
                </TabsTrigger>
                <TabsTrigger value="produtos">
                  <Package className="h-4 w-4 mr-2" />
                  Produtos ({products.length})
                </TabsTrigger>
                <TabsTrigger value="gerenciar">
                  <Settings className="h-4 w-4 mr-2" />
                  Gerenciar
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

              <TabsContent value="sync-inteligente" className="space-y-4">
                {selectedAccount && (
                  <MercadoLivreSmartSync accountId={selectedAccount} />
                )}
              </TabsContent>

              <TabsContent value="auto-sync" className="space-y-4">
                {selectedAccount && (
                  <MercadoLivreAutoSync accountId={selectedAccount} />
                )}
              </TabsContent>

              <TabsContent value="produtos" className="space-y-4">
                {/* Filtros e Ações */}
                <div className="flex flex-col md:flex-row gap-4 items-end">
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
                  
                  <Button
                    onClick={() => syncProducts(selectedAccount!, "full")}
                    disabled={syncing}
                    variant="outline"
                    className="gap-2"
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {syncing ? "Sincronizando..." : "Buscar Novos"}
                  </Button>
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
                                  {product.mlThumbnail ? (
                                    <MLImage
                                      src={product.mlThumbnail}
                                      alt={product.mlTitle || "Produto ML"}
                                      width={40}
                                      height={40}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                                      ML
                                    </div>
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
                                {formatDateShort(product.lastSyncAt)}
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

              <TabsContent value="importar" className="space-y-4">
                {/* Header da Importação */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Importar Produtos do Mercado Livre</h3>
                    <p className="text-sm text-gray-600">
                      Importe seus produtos do ML para o sistema local e configure custos manualmente
                    </p>
                  </div>
                  <Button
                    onClick={() => selectedAccount && loadImportableProducts(selectedAccount)}
                    disabled={loadingImportData}
                    className="gap-2"
                  >
                    {loadingImportData ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {loadingImportData ? "Carregando..." : "Buscar Produtos ML"}
                  </Button>
                </div>

                {/* Resumo da Importação */}
                {importData && (
                  <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {importData.summary.total}
                          </div>
                          <div className="text-sm text-gray-600">Total ML</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {importData.summary.new}
                          </div>
                          <div className="text-sm text-gray-600">Novos</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-600">
                            {importData.summary.existing}
                          </div>
                          <div className="text-sm text-gray-600">Já Importados</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">
                            {importData.summary.fullProducts}
                          </div>
                          <div className="text-sm text-gray-600">Full</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-600">
                            {importData.summary.flexProducts}
                          </div>
                          <div className="text-sm text-gray-600">Flex</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Lista de Produtos para Importar */}
                {importData?.newProducts && importData.newProducts.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Produtos Disponíveis para Importação ({importData.newProducts.length})
                        </CardTitle>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={selectAllProducts}
                          >
                            {selectedForImport.size === importData.newProducts.length
                              ? "Desselecionar Todos"
                              : "Selecionar Todos"}
                          </Button>
                          <Button
                            onClick={() => selectedAccount && importSelectedProducts(selectedAccount)}
                            disabled={importing || selectedForImport.size === 0}
                            className="gap-2"
                          >
                            {importing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            {importing
                              ? "Importando..."
                              : `Importar Selecionados (${selectedForImport.size})`}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {importData.newProducts.map((product) => (
                          <div
                            key={product.mlItemId}
                            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                              selectedForImport.has(product.mlItemId)
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => toggleProductSelection(product.mlItemId)}
                          >
                            <div className="flex items-center gap-4">
                              <input
                                type="checkbox"
                                checked={selectedForImport.has(product.mlItemId)}
                                onChange={() => toggleProductSelection(product.mlItemId)}
                                className="w-4 h-4"
                              />
                              
                              {product.thumbnail && (
                                <img
                                  src={product.thumbnail}
                                  alt={product.title}
                                  className="w-12 h-12 object-cover rounded border"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                              
                              <div className="flex-1">
                                <h4 className="font-medium line-clamp-1">
                                  {product.title}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>R$ {product.price.toFixed(2)}</span>
                                  <span>Estoque: {product.availableQuantity}</span>
                                  <Badge
                                    variant={product.isFull ? "default" : "secondary"}
                                    className={
                                      product.isFull
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-orange-100 text-orange-800"
                                    }
                                  >
                                    {product.isFull ? "🚚 Full" : "📦 Flex"}
                                  </Badge>
                                  {getStatusBadge(product.status)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : importData?.newProducts && importData.newProducts.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        Todos os produtos já foram importados!
                      </h3>
                      <p className="text-gray-500">
                        Todos os seus produtos do Mercado Livre já estão no sistema local.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        Clique em "Buscar Produtos ML" para começar
                      </h3>
                      <p className="text-gray-500">
                        Carregaremos todos os seus produtos do Mercado Livre para você escolher quais importar.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Resultado da Importação */}
                {importResult && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-800">
                            Importação Concluída!
                          </h4>
                          <p className="text-sm text-green-700">
                            {importResult.imported} produtos importados com sucesso
                            {importResult.errors > 0 && ` (${importResult.errors} erros)`}
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Agora você pode configurar custos e impostos na aba "Produtos" ou na página de produtos.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="gerenciar" className="space-y-4">
                {/* Header da Gestão */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Gerenciar Produtos Importados</h3>
                    <p className="text-sm text-gray-600">
                      Configure custos, impostos e SKUs dos produtos importados do ML
                    </p>
                  </div>
                  <Button
                    onClick={() => loadImportedProducts(managementFilter)}
                    disabled={loadingImportedProducts}
                    className="gap-2"
                  >
                    {loadingImportedProducts ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Atualizar
                  </Button>
                </div>

                {/* Estatísticas */}
                {importedProductsStats.total > 0 && (
                  <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-purple-600">
                            {importedProductsStats.total}
                          </div>
                          <div className="text-sm text-gray-600">Total</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600">
                            {importedProductsStats.pending}
                          </div>
                          <div className="text-sm text-gray-600">Pendentes</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {importedProductsStats.configured}
                          </div>
                          <div className="text-sm text-gray-600">Configurados</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">
                            {importedProductsStats.fullProducts}
                          </div>
                          <div className="text-sm text-gray-600">Full</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-600">
                            {importedProductsStats.flexProducts}
                          </div>
                          <div className="text-sm text-gray-600">Flex</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Filtros */}
                <div className="flex gap-4 items-center">
                  <label className="text-sm font-medium">Filtrar por:</label>
                  <select
                    value={managementFilter}
                    onChange={(e) => {
                      setManagementFilter(e.target.value);
                      loadImportedProducts(e.target.value);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todos os produtos</option>
                    <option value="pending">Pendentes de configuração</option>
                    <option value="configured">Já configurados</option>
                  </select>
                </div>

                {/* Lista de Produtos */}
                {loadingImportedProducts ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">Carregando produtos...</p>
                    </CardContent>
                  </Card>
                ) : importedProducts.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Produtos Importados ({importedProducts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {importedProducts.map((product) => (
                          <div
                            key={product.id}
                            className="border rounded-lg p-4 hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-4">
                              {product.mlData?.mlThumbnail && (
                                <img
                                  src={product.mlData.mlThumbnail}
                                  alt={product.nome}
                                  className="w-16 h-16 object-cover rounded border"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                              
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-medium">{product.nome}</h4>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                      <span>SKU: {product.sku}</span>
                                      {product.mlData && (
                                        <>
                                          <span>ML: R$ {product.mlData.mlPrice.toFixed(2)}</span>
                                          <Badge
                                            variant={product.mlData.isFull ? "default" : "secondary"}
                                            className={
                                              product.mlData.isFull
                                                ? "bg-purple-100 text-purple-800"
                                                : "bg-orange-100 text-orange-800"
                                            }
                                          >
                                            {product.mlData.isFull ? "🚚 Full" : "📦 Flex"}
                                          </Badge>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {product.needsConfiguration ? (
                                      <Badge variant="destructive">
                                        ⚠️ Pendente
                                      </Badge>
                                    ) : (
                                      <Badge variant="default" className="bg-green-100 text-green-800">
                                        ✅ Configurado
                                      </Badge>
                                    )}
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingProduct({
                                        id: product.id,
                                        nome: product.nome,
                                        sku: product.sku,
                                        custoMedio: product.custoMedio ? product.custoMedio / 100 : 0,
                                      })}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                  <div>
                                    <span className="text-gray-500">Custo:</span>
                                    <span className="ml-1 font-medium">
                                      {product.custoMedio 
                                        ? `R$ ${(product.custoMedio / 100).toFixed(2)}`
                                        : "Não definido"
                                      }
                                    </span>
                                  </div>
                                  {product.custoMedio && product.mlData && (
                                    <div>
                                      <span className="text-gray-500">Margem:</span>
                                      <span className="ml-1 font-medium">
                                        {(((product.mlData.mlPrice - (product.custoMedio / 100)) / product.mlData.mlPrice) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-gray-500">Status ML:</span>
                                    <span className="ml-1">
                                      {getStatusBadge(product.mlData?.mlStatus || "unknown")}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Importado:</span>
                                    <span className="ml-1">
                                      {isClient && product.mlData?.lastSyncAt 
                                        ? formatDateSafe(product.mlData.lastSyncAt)
                                        : "--"
                                      }
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        Nenhum produto importado encontrado
                      </h3>
                      <p className="text-gray-500">
                        {managementFilter === "pending" 
                          ? "Todos os produtos já foram configurados!"
                          : "Importe produtos do ML primeiro na aba 'Importar ML'."
                        }
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Dialog de Edição */}
                {editingProduct && (
                  <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Editar Produto</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Nome</label>
                          <input
                            type="text"
                            value={editingProduct.nome}
                            onChange={(e) => setEditingProduct({
                              ...editingProduct,
                              nome: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">SKU</label>
                          <input
                            type="text"
                            value={editingProduct.sku}
                            onChange={(e) => setEditingProduct({
                              ...editingProduct,
                              sku: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Custo Médio (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingProduct.custoMedio}
                            onChange={(e) => setEditingProduct({
                              ...editingProduct,
                              custoMedio: parseFloat(e.target.value) || 0
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div className="flex gap-2 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setEditingProduct(null)}
                            className="flex-1"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={() => updateProduct({
                              nome: editingProduct.nome,
                              sku: editingProduct.sku,
                              custoMedio: editingProduct.custoMedio,
                            })}
                            disabled={updatingProduct}
                            className="flex-1"
                          >
                            {updatingProduct ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Salvar"
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Métricas do Vendedor */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-blue-500" />
                        Métricas do Vendedor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAnalytics ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : analyticsData?.metrics ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Total de Anúncios:
                            </span>
                            <span className="font-semibold">
                              {analyticsData.metrics.totalListings}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Anúncios Ativos:
                            </span>
                            <span className="font-semibold text-green-600">
                              {analyticsData.metrics.activeListings}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Anúncios Pausados:
                            </span>
                            <span className="font-semibold text-yellow-600">
                              {analyticsData.metrics.pausedListings}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Nível de Reputação:
                            </span>
                            <span className="font-semibold">
                              {analyticsData.metrics.reputationLevel}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          Dados não disponíveis
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Estoque */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-500" />
                        Controle de Estoque
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAnalytics ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : analyticsData?.stock ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Total de Produtos:
                            </span>
                            <span className="font-semibold">
                              {analyticsData.stock.totalProducts}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Estoque Baixo:
                            </span>
                            <span className="font-semibold text-yellow-600">
                              {analyticsData.stock.lowStockProducts.length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Sem Estoque:
                            </span>
                            <span className="font-semibold text-red-600">
                              {analyticsData.stock.outOfStockProducts.length}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          Dados não disponíveis
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Informações de Envio */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-purple-500" />
                        Configurações de Envio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAnalytics ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : analyticsData?.shipping ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Mercado Envios:
                            </span>
                            <span
                              className={`font-semibold ${
                                analyticsData.shipping.mercadoEnviosEnabled
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {analyticsData.shipping.mercadoEnviosEnabled
                                ? "Ativo"
                                : "Inativo"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Frete Grátis:
                            </span>
                            <span
                              className={`font-semibold ${
                                analyticsData.shipping.freeShippingEnabled
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {analyticsData.shipping.freeShippingEnabled
                                ? "Ativo"
                                : "Inativo"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Métodos de Envio:
                            </span>
                            <span className="font-semibold">
                              {analyticsData.shipping.shippingMethods.length}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          Dados não disponíveis
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Informações Financeiras */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        Informações Financeiras
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAnalytics ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : analyticsData?.financial ? (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Saldo Disponível:
                            </span>
                            <span className="font-semibold text-green-600">
                              {exibirValorEmReais(
                                analyticsData.financial.availableBalance
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Saldo Pendente:
                            </span>
                            <span className="font-semibold text-yellow-600">
                              {exibirValorEmReais(
                                analyticsData.financial.pendingBalance
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Saldo Total:
                            </span>
                            <span className="font-semibold">
                              {exibirValorEmReais(
                                analyticsData.financial.accountBalance
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Moeda: {analyticsData.financial.currency}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          Dados não disponíveis (requer permissões especiais)
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

                {/* Alertas de Estoque */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      Alertas de Estoque
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingAnalytics ? (
                      <div className="flex items-center justify-center p-6">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : analyticsData?.stock ? (
                      <div className="space-y-4">
                        {/* Produtos com estoque baixo */}
                        {analyticsData.stock.lowStockProducts.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 text-yellow-600">
                              Produtos com Estoque Baixo (≤ 5 unidades)
                            </h4>
                            <div className="max-h-40 overflow-y-auto">
                              <div className="space-y-2">
                                {analyticsData.stock.lowStockProducts
                                  .slice(0, 10)
                                  .map((product) => (
                                    <div
                                      key={product.id}
                                      className="flex justify-between items-center p-2 bg-yellow-50 rounded"
                                    >
                                      <div className="flex-1">
                                        <p className="text-sm font-medium truncate">
                                          {product.title}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {exibirValorEmReais(product.price)}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="text-yellow-600 border-yellow-600"
                                      >
                                        {product.availableQuantity} un.
                                      </Badge>
                                    </div>
                                  ))}
                                {analyticsData.stock.lowStockProducts.length >
                                  10 && (
                                  <p className="text-xs text-gray-500 text-center">
                                    ... e mais{" "}
                                    {analyticsData.stock.lowStockProducts
                                      .length - 10}{" "}
                                    produtos
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Produtos sem estoque */}
                        {analyticsData.stock.outOfStockProducts.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 text-red-600">
                              Produtos Sem Estoque
                            </h4>
                            <div className="max-h-40 overflow-y-auto">
                              <div className="space-y-2">
                                {analyticsData.stock.outOfStockProducts
                                  .slice(0, 10)
                                  .map((product) => (
                                    <div
                                      key={product.id}
                                      className="flex justify-between items-center p-2 bg-red-50 rounded"
                                    >
                                      <div className="flex-1">
                                        <p className="text-sm font-medium truncate">
                                          {product.title}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {exibirValorEmReais(product.price)}
                                        </p>
                                      </div>
                                      <Badge variant="destructive">
                                        Sem estoque
                                      </Badge>
                                    </div>
                                  ))}
                                {analyticsData.stock.outOfStockProducts.length >
                                  10 && (
                                  <p className="text-xs text-gray-500 text-center">
                                    ... e mais{" "}
                                    {analyticsData.stock.outOfStockProducts
                                      .length - 10}{" "}
                                    produtos
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {analyticsData.stock.lowStockProducts.length === 0 &&
                          analyticsData.stock.outOfStockProducts.length ===
                            0 && (
                            <div className="text-center text-green-600 p-6">
                              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                              <p className="font-medium">Estoque em dia!</p>
                              <p className="text-sm">
                                Todos os produtos têm estoque adequado
                              </p>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 p-6">
                        Dados de estoque não disponíveis
                      </div>
                    )}
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
                                  {formatDateSafe(history.startedAt)}
                                </span>
                                {history.completedAt && (
                                  <span className="text-sm text-gray-500">
                                    Concluído:{" "}
                                    {formatDateSafe(history.completedAt)}
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
