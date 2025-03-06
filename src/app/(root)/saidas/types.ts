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
  sku: string;
  isKit?: boolean;
  componentes?: KitComponente[];
}

export interface Saida {
  id: number;
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
