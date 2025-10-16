import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface OptimizedSalesData {
  success: boolean;
  period: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalOrders: number;
    totalProducts: number;
    totalQuantity: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
  products: Array<{
    itemId: string;
    quantity: number;
    revenue: number;
    orders: number;
    lastSale: string;
    avgPrice: number;
  }>;
}

interface OptimizedPricesData {
  success: boolean;
  processed: number;
  updated: number;
  withPromotion: number;
  errors: string[];
  summary: {
    message: string;
    nextUpdate: string;
  };
}

/**
 * Hook otimizado para usar as novas APIs do Mercado Livre
 * Foca em performance e dados precisos
 */
export const useMercadoLivreOptimized = () => {
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<OptimizedSalesData | null>(null);
  const [pricesData, setPricesData] = useState<OptimizedPricesData | null>(null);

  /**
   * Buscar vendas otimizadas por período
   */
  const fetchOptimizedSales = useCallback(async (
    accountId: string, 
    period: number = 30
  ): Promise<OptimizedSalesData | null> => {
    if (!accountId) return null;

    setLoading(true);
    try {
      console.log(`[HOOK] Buscando vendas otimizadas para ${period} dias...`);

      const response = await fetch(
        `/api/mercadolivre/analytics/sales-optimized?accountId=${accountId}&period=${period}`
      );

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data: OptimizedSalesData = await response.json();
      
      setSalesData(data);
      
      console.log(`[HOOK] ✅ Vendas: ${data.summary.totalQuantity} itens, R$ ${(data.summary.totalRevenue/100).toFixed(2)}`);
      
      toast.success(
        `Vendas atualizadas: ${data.summary.totalQuantity} itens vendidos em ${period} dias`
      );

      return data;

    } catch (error) {
      console.error('[HOOK] Erro ao buscar vendas:', error);
      toast.error('Erro ao buscar dados de vendas otimizados');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Atualizar preços promocionais em lote
   */
  const updatePromotionalPrices = useCallback(async (
    accountId: string,
    forceUpdate: boolean = false
  ): Promise<OptimizedPricesData | null> => {
    if (!accountId) return null;

    setLoading(true);
    try {
      console.log(`[HOOK] Atualizando preços ${forceUpdate ? 'forçadamente' : 'inteligentemente'}...`);

      const response = await fetch('/api/mercadolivre/precos-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          forceUpdate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data: OptimizedPricesData = await response.json();
      
      setPricesData(data);
      
      console.log(`[HOOK] ✅ Preços: ${data.updated} atualizados, ${data.withPromotion} com promoção`);
      
      if (data.updated > 0) {
        toast.success(
          `${data.updated} preços atualizados, ${data.withPromotion} com promoção ativa`
        );
      } else {
        toast.success('Preços já estão atualizados');
      }

      return data;

    } catch (error) {
      console.error('[HOOK] Erro ao atualizar preços:', error);
      toast.error('Erro ao atualizar preços promocionais');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Atualização completa: preços + vendas
   */
  const fullUpdate = useCallback(async (
    accountId: string,
    period: number = 30,
    forceUpdatePrices: boolean = false
  ) => {
    if (!accountId) return;

    console.log('[HOOK] Iniciando atualização completa...');
    
    try {
      // Passo 1: Atualizar preços promocionais
      const pricesResult = await updatePromotionalPrices(accountId, forceUpdatePrices);
      
      // Passo 2: Buscar vendas otimizadas
      const salesResult = await fetchOptimizedSales(accountId, period);

      if (pricesResult && salesResult) {
        toast.success(
          `Atualização completa: ${pricesResult.withPromotion} promoções, ${salesResult.summary.totalQuantity} vendas`
        );
      }

      return {
        prices: pricesResult,
        sales: salesResult
      };

    } catch (error) {
      console.error('[HOOK] Erro na atualização completa:', error);
      toast.error('Erro na atualização completa');
    }
  }, [updatePromotionalPrices, fetchOptimizedSales]);

  /**
   * Verificar se dados estão desatualizados
   */
  const needsUpdate = useCallback((lastUpdate?: Date, maxAgeMinutes: number = 30): boolean => {
    if (!lastUpdate) return true;
    
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    return diffMinutes > maxAgeMinutes;
  }, []);

  return {
    // Estado
    loading,
    salesData,
    pricesData,

    // Ações
    fetchOptimizedSales,
    updatePromotionalPrices,
    fullUpdate,

    // Utilitários
    needsUpdate,

    // Dados derivados
    hasSalesData: !!salesData,
    hasPricesData: !!pricesData,
    totalSales: salesData?.summary.totalQuantity || 0,
    totalRevenue: salesData?.summary.totalRevenue || 0,
    productsWithPromotion: pricesData?.withPromotion || 0,
  };
};

export default useMercadoLivreOptimized;
