// app/produtos/types.ts
export interface Produto {
  id: number;
  nome: string;
  sku: string;
  ean?: string; // Opcional
  custoMedio?: number;
  isKit?: boolean;
  componentes?: Array<{ produto: Produto; quantidade: number }>;
}

export interface KitComponente {
  produtoId: number;
  quantidade: number;
}

export interface Kit {
  id: number;
  nome: string;
  sku: string;
  ean?: string;
  componentes: KitComponente[];
}
