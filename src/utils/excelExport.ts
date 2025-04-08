// src/utils/excelExport.ts
import * as XLSX from "xlsx";

// Função genérica para exportar dados para Excel
export const exportToExcel = <T extends Record<string, any>>(
  data: T[],
  fileName: string,
  sheetName: string = "Sheet1"
): void => {
  try {
    // Criar uma planilha
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Criar um livro
    const workbook = XLSX.utils.book_new();

    // Adicionar a planilha ao livro
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Gerar o arquivo e iniciar o download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Erro ao exportar para Excel:", error);
    throw new Error("Falha ao gerar arquivo Excel");
  }
};

// Tipos para dados de exportação
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

// Função para formatar os dados de saída para exportação
export const formatSaidasForExport = (saidas: any[]): SaidaExportData[] => {
  return saidas.map((saida) => ({
    ID: saida.id,
    Data: new Date(saida.data).toLocaleDateString(),
    Armazém: saida.armazem.nome,
    "Quantidade de Itens": saida.detalhes.reduce(
      (acc: number, detalhe: any) => acc + detalhe.quantidade,
      0
    ),
    "Itens Diferentes": saida.detalhes.length,
    "Possui Kits": saida.detalhes.some((d: any) => d.isKit) ? "Sim" : "Não",
  }));
};

// Função para formatar os dados de estoque para exportação
export const formatEstoqueForExport = (estoque: any[]): EstoqueExportData[] => {
  let valorTotalEstoque = 0;

  const formattedData = estoque.map((item) => {
    // Calcular status do estoque
    const isLowStock = item.quantidade <= (item.estoqueSeguranca || 0);
    const isOutOfStock = item.quantidade === 0;

    let status = "Normal";
    if (isOutOfStock) status = "Esgotado";
    else if (isLowStock) status = "Baixo";

    // Calcular o custo médio e o valor total
    const custoMedio = item.produto.custoMedio
      ? Number(item.produto.custoMedio) / 100
      : 0;

    const valorTotal = custoMedio * item.quantidade;

    // Somar ao valor total do estoque
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

  // Adicionar uma linha com o valor total do estoque
  if (formattedData.length > 0) {
    // Usando um objeto com o mesmo formato, mas convertido para o tipo requerido
    const totalsRow: EstoqueExportData = {
      SKU: "",
      Produto: "VALOR TOTAL DO ESTOQUE",
      Quantidade: 0, // Usamos 0 em vez de null para garantir o tipo correto
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

// Função para formatar os dados de fornecedores para exportação
export const formatFornecedoresForExport = (
  fornecedores: any[]
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

// Função para formatar os detalhes de uma saída específica
export const formatSaidaDetalhesForExport = (saida: any): any[] => {
  return saida.detalhes.map((detalhe: any) => ({
    Produto: detalhe.produto.nome,
    SKU: detalhe.produto.sku,
    Quantidade: detalhe.quantidade,
    Tipo: detalhe.isKit ? "Kit" : "Produto",
  }));
};
