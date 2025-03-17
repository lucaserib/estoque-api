// app/produtos/types.ts
export interface Produto {
  id: string;
  nome: string;
  sku: string;
  ean?: string; // Opcional
  custoMedio?: number;
  isKit?: boolean;
  componentes?: Array<{
    produto?: Produto;
    quantidade: number;
    produtoId?: string;
  }>;
  estoques?: Array<{
    quantidade: number;
    armazemId: string;
    estoqueSeguranca?: number;
    armazem?: {
      id: string;
      nome: string;
    };
  }>;
}

export interface KitComponente {
  produtoId: string;
  quantidade: number;
  produto?: Produto;
}

export interface Kit {
  id: number;
  nome: string;
  sku: string;
  ean?: string;
  componentes: KitComponente[];
}

export interface ProdutoFornecedor {
  id: string;
  fornecedorId: string;
  produtoId: string;
  preco: number;
  multiplicador: number;
  codigoNF: string;
  fornecedor?: {
    id: string;
    nome: string;
  };
}
