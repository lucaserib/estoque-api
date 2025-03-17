import { Fornecedor } from "@prisma/client";

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

export interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios?: string; // Deve ser opcional conforme o schema
  status: string;
  dataPrevista?: string;
  armazemId?: string;
  dataConclusao?: string; // Deve ser opcional conforme o schema
}

export interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number; // Garantir que seja sempre um número inteiro (centavos)
  multiplicador: number; // Não opcional conforme o schema do Prisma
  produto?: Produto;
}
