import { Fornecedor } from "@prisma/client";

export interface Produto {
  id: string;
  nome: string;
  sku: string;
  codigoEAN?: string;
  custoMedio?: number | null;
  isKit?: boolean;
  imagemUrl?: string | null;
  imagemThumbUrl?: string | null;
  descricao?: string | null;
  marca?: string | null;
  categoria?: string | null;
  pesoGramas?: number | null;
  alturaCm?: number | null;
  larguraCm?: number | null;
  comprimentoCm?: number | null;
  ativo?: boolean;
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
  fornecedorPrincipal?: {
    id: string;
    nome: string;
    prazoEntregaDias?: number | null;
    precoUnitario?: number | null;
  } | null;
  _mlTotalVendas?: number;
  _mlEstoqueFull?: number;
  _mlEstoqueTotal?: number;
  _estoqueLocalTotal?: number;
  _vinculadoML?: boolean;
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
  codigoEAN?: string;
  componentes: KitComponente[];
}

export interface ProdutoFornecedor {
  id: string;
  fornecedorId: string;
  produtoId: string;
  preco: number;
  multiplicador: number;
  codigoNF: string;
  prazoEntregaDias?: number | null;
  precoUnitario?: number | null;
  quantidadeMinima?: number | null;
  principal?: boolean;
  codigoNoFornecedor?: string | null;
  fornecedor?: {
    id: string;
    nome: string;
  };
}

export interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios?: string;
  status: string;
  dataPrevista?: string;
  armazemId?: string;
  dataConclusao?: string;
}

export interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador: number;
  produto?: Produto;
}
