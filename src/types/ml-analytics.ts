// Tipos TypeScript para as APIs do Mercado Livre

export interface MLAccount {
  id: string;
  userId: string;
  mlUserId: string;
  nickname: string;
  siteId: string;
  isActive: boolean;
}

export interface MLProduct {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlAvailableQuantity: number;
  mlSoldQuantity: number;
  mlStatus: "active" | "paused" | "closed" | "under_review";
  mlThumbnail?: string;
  mlPermalink?: string;
  lastSyncAt?: Date;
  syncStatus: "synced" | "pending" | "error" | "ignored";
  produto?: {
    id: string;
    nome: string;
    sku: string;
    estoques: Array<{
      quantidade: number;
      armazem?: {
        nome: string;
      };
    }>;
  };
}

export interface MLOrder {
  id: string;
  status: string;
  date_created: string;
  total_amount: number;
  order_items: Array<{
    item: {
      id: string;
      title: string;
      price?: number;
    };
    quantity: number;
    unit_price: number;
  }>;
}

export interface DashboardMetrics {
  totalProducts: number;
  activeProducts: number;
  pausedProducts: number;
  lowStockProducts: number;
  needsRestockProducts: number;
  todaySales: number;
  weekSales: number;
  totalRevenue: number;
  totalRevenueProducts?: number; // ✅ NOVO: Receita só de produtos
  shippingRevenue?: number; // ✅ NOVO: Receita de frete
  averageTicket: number;
  averageTicketProducts?: number; // ✅ NOVO: Ticket médio só produtos
  averageTicketWithShipping?: number; // ✅ NOVO: Ticket médio com frete
  shippingPercentage?: number; // ✅ NOVO: Percentual do frete
  pendingOrders: number;
  needsSync: boolean;
  lastSync: string | null;
  salesGrowth: "positive" | "negative" | "neutral";
  productHealth: {
    total: number;
    healthy: number;
    needsAttention: number;
    healthPercentage: number;
  };
  dataStatus?: {
    salesDataFresh: boolean;
    lastSalesUpdate: string;
    mlConnectionStatus: "connected" | "disconnected" | "limited";
  };
  warning?: string;
}

export interface SalesAnalytics {
  period: {
    from: string;
    to: string;
    days: number;
  };
  summary: {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    revenueGrowth: number;
    totalOrders: number;
  };
  topSellingProducts: Array<{
    itemId: string;
    title: string;
    quantity: number;
    revenue: number;
    orders: number;
    averagePrice: number;
    originalPrice?: number;
    discountPercentage?: number;
  }>;
  salesChart: Array<{
    date: string;
    sales: number;
    revenue: number;
    orders: number;
  }>;
  categoryBreakdown: Array<{
    categoryId: string;
    revenue: number;
    quantity: number;
  }>;
  recentOrders: Array<{
    id: string;
    date: string;
    total: number;
    status: string;
    itemsCount: number;
  }>;
}

export interface RestockSuggestion {
  priority: "critical" | "high" | "medium" | "low";
  productId: string;
  mlItemId: string;
  productName: string;
  sku: string;
  currentMLStock: number;
  currentLocalStock: number;
  suggestedRestock: number;
  salesVelocity: number;
  daysUntilStockout: number;
  totalSold: number;
  lastSaleDate?: string;
  revenue: number;
  mlPrice: number;
  reasons: string[];
  actions: string[];
}

export interface RestockAnalytics {
  summary: {
    totalProducts: number;
    needsAttention: number;
    critical: number;
    high: number;
    medium: number;
    totalPotentialRevenue: number;
    avgSalesVelocity: number;
    recommendations: string[];
  };
  suggestions: RestockSuggestion[];
  period: {
    days: number;
    from: string;
    to: string;
  };
}

export interface ProductFilters {
  sortBy:
    | "smart"
    | "lastSync"
    | "sales"
    | "revenue"
    | "name"
    | "price"
    | "stock";
  sortOrder: "asc" | "desc";
  status: "all" | "active" | "paused" | "closed";
  stock: "all" | "ok" | "low" | "out" | "unlinked";
}

export interface ProductWithSales extends MLProduct {
  localStock: number;
  stockStatus: "ok" | "low" | "out" | "unlinked";
  salesData: {
    quantity30d: number;
    revenue30d: number;
    salesVelocity: number;
  };
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  updatedItems: number;
  totalProcessed: number;
  errors: string[];
  summary: string;
}

export interface APIError {
  error: string;
  details?: string;
  offline?: boolean;
}
