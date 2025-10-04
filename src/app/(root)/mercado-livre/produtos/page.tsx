"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw, Package, Store } from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import { useMercadoLivreOptimized } from "@/hooks/useMercadoLivreOptimized";

// ✅ NOVOS COMPONENTES COMPONENTIZADOS
import MLProductsFilters from "@/app/components/MercadoLivre/MLProductsFilters";
import MLProductsTable from "@/app/components/MercadoLivre/MLProductsTable";
import MLProductLinkModal from "@/app/components/MercadoLivre/MLProductLinkModal";

interface MLProduct {
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlOriginalPrice?: number | null;
  mlBasePrice?: number | null;
  mlHasPromotion?: boolean;
  mlPromotionDiscount?: number | null;
  mlSavings?: number;
  mlAvailableQuantity: number;
  mlSoldQuantity: number;
  mlStatus: string;
  mlThumbnail?: string;
  mlPermalink: string;
  // ✅ ATUALIZADO: Compatível com API dinâmica
  produto?: {
    id: string;
    nome: string;
    sku: string;
    estoqueLocal?: number;
  } | null;
  localProduct?: {
    id: string;
    nome: string;
    sku: string;
  };
  localStock?: number;
  stockStatus?: "ok" | "low" | "out" | "unlinked";
  lastSync?: string;
  lastSyncAt?: string; // ✅ NOVO: Campo da API dinâmica
  syncStatus?: string;
  // ✅ ATUALIZADO: Compatível com API dinâmica
  salesData?: {
    quantityThisMonth?: number;
    revenueThisMonth?: number;
    salesVelocity?: number;
    daysInMonth?: number;
    // Campos antigos para compatibilidade
    quantity30d?: number;
    revenue30d?: number;
  } | null;
}

interface LocalProduct {
  id: string;
  nome: string;
  sku: string;
  custoMedio: number;
  precoVenda: number;
}

interface MLAccount {
  id: string;
  nickname: string;
  siteId: string;
  isActive: boolean;
}

export default function MercadoLivreProdutosPage() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<MLProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<MLProduct[]>([]);
  const [localProducts, setLocalProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active"); // ✅ PADRÃO: Anúncios ativos
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("sales"); // ✅ PADRÃO: Mais vendidos
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Estados do modal de vinculação
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMLProduct, setSelectedMLProduct] = useState<MLProduct | null>(
    null
  );
  const [selectedLocalProduct, setSelectedLocalProduct] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const [accounts, setAccounts] = useState<MLAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      loadAccounts();
    }
  }, [status]);

  useEffect(() => {
    if (selectedAccount) {
      loadProducts();
      loadLocalProducts();
    }
  }, [selectedAccount]);

  // Recarregar produtos quando filtros mudarem
  useEffect(() => {
    if (selectedAccount) {
      loadProducts();
    }
  }, [selectedAccount, sortBy, sortOrder, statusFilter, stockFilter]);

  // ✅ NOVO: Auto-refetch inicial quando abre a aba (com toast apenas se não for inicial)
  useEffect(() => {
    if (selectedAccount && products.length > 0) {
      // Refetch silencioso para garantir dados atualizados
      console.log("🔄 Auto-refetch: Atualizando dados ao abrir aba...");
      loadProducts();
    }
  }, []); // Executa apenas uma vez ao montar

  // Filtrar produtos localmente apenas por termo de busca
  useEffect(() => {
    if (searchTerm) {
      const filtered = products.filter(
        (product) =>
          product.mlTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.mlItemId.includes(searchTerm) ||
          product.localProduct?.sku
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [products, searchTerm]);

  const loadAccounts = async () => {
    try {
      const response = await fetch("/api/mercadolivre/auth?action=accounts");
      if (!response.ok) throw new Error("Erro ao carregar contas");

      const accountsData = await response.json();

      // Fix: The API returns accounts directly, not wrapped in accounts property
      const accountsList = Array.isArray(accountsData)
        ? accountsData
        : accountsData.accounts || [];

      // Extract basic account info from the detailed response
      const formattedAccounts = accountsList.map(
        (acc: {
          id: string;
          nickname: string;
          siteId: string;
          isActive: boolean;
        }) => ({
          id: acc.id,
          nickname: acc.nickname,
          siteId: acc.siteId,
          isActive: acc.isActive,
        })
      );

      setAccounts(formattedAccounts);

      const activeAccount = formattedAccounts.find(
        (acc: MLAccount) => acc.isActive
      );
      if (activeAccount) {
        setSelectedAccount(activeAccount.id);
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar contas do Mercado Livre");
    }
  };

  const loadProducts = async (showToast = false) => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      if (showToast) {
        console.log("🔄 Atualizando produtos - Mais vendidos primeiro...");
      }

      const params = new URLSearchParams({
        accountId: selectedAccount,
        sortBy,
        sortOrder,
        status: statusFilter,
        stock: stockFilter,
      });

      const response = await fetch(
        `/api/mercadolivre/produtos?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) throw new Error("Erro ao carregar produtos");

      const data = await response.json();
      setProducts(data.products || []);

      if (showToast) {
        toast.success(
          `${
            data.products?.length || 0
          } produtos carregados! Ordenados por vendas.`
        );
      }

      console.log(
        `✅ ${data.products?.length || 0} produtos carregados. Ordenação: ${
          sortBy === "sales" ? "Mais Vendidos" : sortBy
        }`
      );
    } catch (error) {
      console.error("Erro:", error);
      if (showToast) {
        toast.error("Erro ao carregar produtos do Mercado Livre");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLocalProducts = async () => {
    try {
      const response = await fetch("/api/produtos");
      if (!response.ok) throw new Error("Erro ao carregar produtos locais");

      const data = await response.json();
      setLocalProducts(data);
    } catch (error) {
      console.error("Erro:", error);
    }
  };

  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      // Toggle sort order se é o mesmo campo
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("desc"); // Padrão descendente para novos campos
    }
  };

  const handleSync = async () => {
    if (!selectedAccount) return;

    setSyncing(true);
    try {
      const response = await fetch("/api/mercadolivre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          syncType: "products",
        }),
      });

      if (!response.ok) throw new Error("Erro na sincronização");

      const result = await response.json();
      toast.success(
        `Sincronização concluída! ${result.syncedCount} produtos atualizados`
      );
      loadProducts(true); // ✅ Com toast após sincronização
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkProduct = async () => {
    if (!selectedMLProduct || !selectedLocalProduct) return;

    setLinking(true);
    try {
      const response = await fetch("/api/mercadolivre/produtos/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ CORREÇÃO: Incluir cookies de autenticação
        body: JSON.stringify({
          accountId: selectedAccount,
          mlItemId: selectedMLProduct.mlItemId,
          localProductId: selectedLocalProduct,
        }),
      });

      if (!response.ok) throw new Error("Erro ao vincular produto");

      toast.success("Produto vinculado com sucesso!");
      setLinkDialogOpen(false);
      setSelectedMLProduct(null);
      setSelectedLocalProduct("");
      loadProducts(true); // ✅ Com toast após vinculação
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao vincular produto");
    } finally {
      setLinking(false);
    }
  };

  // ✅ Funções removidas - agora usamos componentes modulares

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto p-6">
        <Header
          title="Produtos Mercado Livre"
          subtitle="Gestão integrada de produtos"
        />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Header
          title="Produtos Mercado Livre"
          subtitle="Gestão integrada de produtos"
        />
        <Card>
          <CardContent className="p-8 text-center">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              Conecte sua conta do Mercado Livre
            </h3>
            <p className="text-muted-foreground mb-6">
              Para gerenciar seus produtos, primeiro conecte sua conta do
              Mercado Livre.
            </p>
            <Button onClick={() => (window.location.href = "/mercado-livre")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Header
        title="Produtos Mercado Livre"
        subtitle="Gestão integrada de produtos"
      >
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </Header>

      {/* Controles e Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos ({filteredProducts.length})
            </span>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* ✅ NOVO: Componente de Filtros Componentizado */}
          <MLProductsFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            onRefresh={() => loadProducts(true)}
            loading={loading}
            accountsCount={accounts.length}
            totalProducts={products.length}
            activeProducts={
              products.filter((p) => p.mlStatus === "active").length
            }
          />
        </CardContent>
      </Card>

      {/* ✅ NOVO: Tabela de Produtos Componentizada */}
      <MLProductsTable
        products={filteredProducts}
        loading={loading}
        onViewProduct={(product) => window.open(product.mlPermalink, "_blank")}
        onEditProduct={(product) => console.log("Editar produto:", product)}
        onLinkProduct={(product) => {
          setSelectedMLProduct(product);
          setLinkDialogOpen(true);
        }}
        onUnlinkProduct={(product) =>
          console.log("Desvincular produto:", product)
        }
      />

      {/* ✅ NOVO: Modal de Vinculação Componentizado */}
      <MLProductLinkModal
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        selectedProduct={selectedMLProduct}
        localProducts={localProducts}
        onLinkProduct={handleLinkProduct}
        loading={linking}
      />
    </div>
  );
}
