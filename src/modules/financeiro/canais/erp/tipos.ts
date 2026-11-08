export interface ContaAPagarParaExportar {
  idInterno: string;
  descricao: string;
  valor: number;
  vencimento: Date;
  categoriaNome: string;
  fornecedorNome: string | null;
}

export interface CategoriaParaExportar {
  idInterno: string;
  nome: string;
  tipo: "RECEITA" | "DESPESA";
}

export interface ResultadoExportacaoErp {
  idExterno: string;
  jaExistia: boolean;
}

export interface AdaptadorErpFinanceiro {
  erp: "BLING";
  exportarContaAPagar(contaId: string, dados: ContaAPagarParaExportar): Promise<ResultadoExportacaoErp>;
  exportarCategoria(contaId: string, dados: CategoriaParaExportar): Promise<ResultadoExportacaoErp>;
}
