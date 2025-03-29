export interface Fornecedor {
  id: string;
  nome: string;
}

export interface Produto {
  id: string;
  nome: string;
  sku: string;
  multiplicador?: number;
  codigoEAN?: string;
}

export interface FornecedorProduto {
  produtoId: string;
  fornecedorId: string;
  preco: number;
  multiplicador: number;
  codigoNF: string;
  produto: Produto;
}

export interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador?: number;
  produto?: Produto;
}

export interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios: string;
  status: string;
  dataPrevista?: string;
  armazemId?: string;
  dataConclusao: string;
}

export interface Armazem {
  id: string;
  nome: string;
}
