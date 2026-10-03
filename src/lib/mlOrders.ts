import { MercadoLivreService } from "@/services/mercadoLivreService";
import type { MLOrder } from "@/types/mercadolivre";

export class PartialOrdersError extends Error {
  readonly code = "ML_DADOS_PARCIAIS";

  constructor(message: string, readonly failedOffsets: number[] = []) {
    super(message);
    this.name = "PartialOrdersError";
  }
}

export interface FetchAllOrdersOptions {
  accessToken: string;
  sellerId: string;
  maxOrders?: number;
  pageSize?: number;
  maxRetriesPerPage?: number;
  dateFrom?: Date | string;
  dateTo?: Date | string;
}

export interface FetchAllOrdersResult {
  orders: MLOrder[];
  complete: boolean;
  truncated: boolean;
  failedOffsets: number[];
}

const DEFAULT_MAX_ORDERS = 5000;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 600;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchAllOrders({
  accessToken,
  sellerId,
  maxOrders = DEFAULT_MAX_ORDERS,
  pageSize = DEFAULT_PAGE_SIZE,
  maxRetriesPerPage = DEFAULT_MAX_RETRIES,
  dateFrom,
  dateTo,
}: FetchAllOrdersOptions): Promise<FetchAllOrdersResult> {
  const orders: MLOrder[] = [];
  const failedOffsets: number[] = [];
  let offset = 0;
  let hasMore = true;
  let truncated = false;

  while (hasMore) {
    if (offset >= maxOrders) {
      truncated = true;
      break;
    }

    let results: MLOrder[] | null = null;

    for (let attempt = 0; attempt <= maxRetriesPerPage; attempt += 1) {
      try {
        const page = await MercadoLivreService.getUserOrders(accessToken, {
          seller: sellerId,
          offset,
          limit: pageSize,
          sort: "date_desc",
          dateFrom,
          dateTo,
        });
        results = page.results ?? [];
        break;
      } catch {
        if (attempt === maxRetriesPerPage) {
          failedOffsets.push(offset);
          break;
        }
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }

    if (results === null) {
      break;
    }

    if (results.length === 0) {
      hasMore = false;
      break;
    }

    orders.push(...results);
    offset += pageSize;
    hasMore = results.length === pageSize;
  }

  return {
    orders,
    complete: failedOffsets.length === 0 && !truncated,
    truncated,
    failedOffsets,
  };
}

export async function fetchAllOrdersOrThrow(
  options: FetchAllOrdersOptions
): Promise<MLOrder[]> {
  const result = await fetchAllOrders(options);

  if (!result.complete) {
    throw new PartialOrdersError(
      "Não foi possível carregar todos os pedidos do Mercado Livre",
      result.failedOffsets
    );
  }

  return result.orders;
}

export interface FetchOrdersWithFallbackResult {
  orders: MLOrder[];
  parcial: boolean;
  pedidosFaltantes: number;
}

export async function fetchOrdersWithFallback(
  options: FetchAllOrdersOptions
): Promise<FetchOrdersWithFallbackResult> {
  const result = await fetchAllOrders(options);

  if (result.orders.length === 0 && !result.complete) {
    throw new PartialOrdersError(
      "Não foi possível carregar os pedidos do Mercado Livre",
      result.failedOffsets
    );
  }

  return {
    orders: result.orders,
    parcial: !result.complete,
    pedidosFaltantes: result.failedOffsets.length * DEFAULT_PAGE_SIZE,
  };
}
