export interface Fornecedor {
  id: number;
  nome: string;
}

export interface Produto {
  id: number;
  nome: string;
  sku: string;
  multiplicador?: number;
}

export interface FornecedorProduto {
  produtoId: number;
  fornecedorId: number;
  preco: number;
  multiplicador: number;
  codigoNF: string;
  produto: Produto;
}

export interface PedidoProduto {
  produtoId: number;
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
  armazemId?: number;
  dataConclusao: string;
}

export interface Armazem {
  id: number;
  nome: string;
}
