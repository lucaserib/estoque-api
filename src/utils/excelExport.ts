export const exportToExcel = async <T extends Record<string, unknown>>(
  data: T[],
  fileName: string,
  sheetName: string = "Sheet1"
): Promise<void> => {
  try {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Erro ao exportar para Excel:", error);
    throw new Error("Falha ao gerar arquivo Excel");
  }
};

export interface SaidaExportData {
  ID: string;
  Data: string;
  Armazém: string;
  "Quantidade de Itens": number;
  "Itens Diferentes": number;
  "Possui Kits": string;
}

export interface EstoqueExportData {
  SKU: string;
  Produto: string;
  Quantidade: number;
  "Estoque de Segurança": number;
  Status: string;
  "É Kit": string;
  "Custo Médio (R$)": string;
  "Valor Total (R$)": string;
}

export interface FornecedorExportData {
  ID: string | number;
  Nome: string;
  CNPJ: string;
  "Inscrição Estadual": string;
  Contato: string;
  Endereço: string;
}

interface Produto {
  id: string;
  nome: string;
  sku: string;
  isKit?: boolean;
  custoMedio?: number;
}

interface SaidaDetalhe {
  id: number | string;
  produto: Produto;
  quantidade: number;
  isKit: boolean;
}

interface Armazem {
  id: string;
  nome: string;
}

interface Saida {
  id: string;
  data: string | Date;
  armazem: Armazem;
  detalhes: SaidaDetalhe[];
}

interface ItemEstoque {
  id?: string;
  produtoId?: string;
  produto: Produto;
  quantidade: number;
  estoqueSeguranca?: number;
}

interface Fornecedor {
  id: string | number;
  nome: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  contato?: string;
  endereco?: string;
}

export const formatSaidasForExport = (saidas: Saida[]): SaidaExportData[] => {
  return saidas.map((saida) => ({
    ID: saida.id,
    Data: new Date(saida.data).toLocaleDateString(),
    Armazém: saida.armazem.nome,
    "Quantidade de Itens": saida.detalhes.reduce(
      (acc: number, detalhe: SaidaDetalhe) => acc + detalhe.quantidade,
      0
    ),
    "Itens Diferentes": saida.detalhes.length,
    "Possui Kits": saida.detalhes.some((d: SaidaDetalhe) => d.isKit)
      ? "Sim"
      : "Não",
  }));
};

export const formatEstoqueForExport = (
  estoque: ItemEstoque[]
): EstoqueExportData[] => {
  let valorTotalEstoque = 0;

  const formattedData = estoque.map((item) => {
    const isLowStock = item.quantidade <= (item.estoqueSeguranca || 0);
    const isOutOfStock = item.quantidade === 0;

    let status = "Normal";
    if (isOutOfStock) status = "Esgotado";
    else if (isLowStock) status = "Baixo";

    const custoMedio = item.produto.custoMedio
      ? Number(item.produto.custoMedio) / 100
      : 0;

    const valorTotal = custoMedio * item.quantidade;

    valorTotalEstoque += valorTotal;

    return {
      SKU: item.produto.sku,
      Produto: item.produto.nome,
      Quantidade: item.quantidade,
      "Estoque de Segurança": item.estoqueSeguranca || 0,
      Status: status,
      "É Kit": item.produto.isKit ? "Sim" : "Não",
      "Custo Médio (R$)": custoMedio.toFixed(2),
      "Valor Total (R$)": valorTotal.toFixed(2),
    };
  });

  if (formattedData.length > 0) {
    const totalsRow: EstoqueExportData = {
      SKU: "",
      Produto: "VALOR TOTAL DO ESTOQUE",
      Quantidade: 0,
      "Estoque de Segurança": 0,
      Status: "",
      "É Kit": "",
      "Custo Médio (R$)": "",
      "Valor Total (R$)": valorTotalEstoque.toFixed(2),
    };

    formattedData.push(totalsRow);
  }

  return formattedData;
};

export const formatFornecedoresForExport = (
  fornecedores: Fornecedor[]
): FornecedorExportData[] => {
  return fornecedores.map((fornecedor) => ({
    ID: fornecedor.id,
    Nome: fornecedor.nome,
    CNPJ: fornecedor.cnpj || "Não informado",
    "Inscrição Estadual": fornecedor.inscricaoEstadual || "Não informado",
    Contato: fornecedor.contato || "Não informado",
    Endereço: fornecedor.endereco || "Não informado",
  }));
};

interface SaidaDetalheExport {
  Produto: string;
  SKU: string;
  Quantidade: number;
  Tipo: string;
}

export const formatSaidaDetalhesForExport = (
  saida: Saida
): SaidaDetalheExport[] => {
  return saida.detalhes.map((detalhe: SaidaDetalhe) => ({
    Produto: detalhe.produto.nome,
    SKU: detalhe.produto.sku,
    Quantidade: detalhe.quantidade,
    Tipo: detalhe.isKit ? "Kit" : "Produto",
  }));
};
