export interface Produto {
  id: number;
  nome: string;
  sku: string;
  isKit?: boolean;
}

export interface KitComponente {
  produtoId: number;
  quantidade: number;
  sku: string;
  produto?: Produto;
}

export interface SaidaProduto {
  produtoId: number;
  quantidade: number;
  sku: string;
  isKit?: boolean;
  componentes?: KitComponente[];
}

export interface Saida {
  id: number;
  data: string;
  armazem: { id: number; nome: string };
  detalhes: {
    id: number;
    produto: Produto;
    quantidade: number;
    isKit: boolean;
  }[];
}

export interface Armazem {
  id: number;
  nome: string;
}
