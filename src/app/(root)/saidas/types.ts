// src/app/(root)/saidas/types.ts
export interface Produto {
  id: string;
  nome: string;
  sku: string;
  isKit?: boolean;
}

export interface KitComponente {
  produtoId: string;
  quantidade: number;
  sku: string;
  produto: Produto;
}

export interface SaidaProduto {
  produtoId: string;
  quantidade: number;
  nome: string;
  sku: string;
  isKit: boolean;
  componentes?: KitComponente[];
}

export interface Saida {
  id: string; // Note: Mudado de number para string conforme migração
  data: string;
  armazem: { id: string; nome: string };
  detalhes: {
    id: number;
    produto: Produto;
    quantidade: number;
    isKit: boolean;
  }[];
}

export interface Armazem {
  id: string;
  nome: string;
}

// Tipos para vendas do Mercado Livre
export interface VendaMLItem {
  id: string;
  mlItemId: string;
  title: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  thumbnail?: string;
  nomeProdutoLocal?: string;
}

export interface VendaML {
  id: string;
  orderId: string;
  date_created: string;
  status: string;
  status_detail: string;
  total_amount: number;
  paid_amount: number;
  currency_id: string;
  buyer: {
    id: number;
    nickname: string;
    first_name?: string;
    last_name?: string;
  };
  items: VendaMLItem[];
  shipping?: {
    status?: string;
    tracking_number?: string;
  };
  payments?: Array<{
    payment_type?: string;
    status?: string;
  }>;
}

export interface VendasMLResponse {
  vendas: VendaML[];
  total: number;
  totalItems: number;
  totalRevenue: number;
}
