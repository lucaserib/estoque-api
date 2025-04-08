/**
 * Utilitário para facilitar o trabalho com jsPDF e jspdf-autotable
 * Este módulo é responsável por carregar os plugins necessários e garantir
 * que eles estejam disponíveis para uso.
 */

// Importação para tipagem
import { jsPDF } from "jspdf";

/**
 * Verifica se estamos em um ambiente onde o jsPDF pode ser carregado
 */
export const canUsePDF = (): boolean => {
  return typeof window !== "undefined";
};

/**
 * Carrega o jsPDF e o plugin jspdf-autotable
 * @returns Instância configurada de jsPDF
 */
export const loadPDF = async () => {
  if (!canUsePDF()) {
    throw new Error("Esta função só pode ser executada no navegador");
  }

  try {
    // Importa jsPDF
    const jsPDFModule = await import("jspdf");
    const jsPDF = jsPDFModule.default;

    // Importa o plugin autoTable
    await import("jspdf-autotable");

    // Cria uma nova instância
    const doc = new jsPDF();

    // Verifica se autoTable está disponível
    // @ts-expect-error - O método autoTable é adicionado pelo plugin em tempo de execução
    if (typeof doc.autoTable !== "function") {
      console.warn(
        "Aviso: autoTable não foi carregado corretamente. Usando fallback."
      );
    }

    return doc;
  } catch (error) {
    console.error("Erro ao carregar jsPDF:", error);
    throw error;
  }
};

/**
 * Tipo para a instância do jsPDF com o método autoTable
 */
export interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (options: TableOptions) => JsPDFWithAutoTable;
  lastAutoTable: {
    finalY: number;
  };
}

/**
 * Verifica se o método autoTable está disponível
 * @param doc Instância do jsPDF
 */
export const hasAutoTable = (doc: jsPDF): boolean => {
  // @ts-expect-error - Verificamos se autoTable existe, mesmo que o TypeScript não saiba
  return typeof doc.autoTable === "function";
};

/**
 * Interface para opções da tabela
 */
export interface TableOptions {
  head: string[][];
  body: string[][];
  foot?: string[][];
  startY: number;
  theme?: string;
  headStyles?: Record<string, unknown>;
  footStyles?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  columnStyles?: Record<string, Record<string, unknown>>;
}

/**
 * Adiciona uma tabela ao documento PDF, com fallback para o caso do plugin não estar disponível
 * @param doc Instância do jsPDF
 * @param options Opções da tabela
 * @returns Posição Y final da tabela
 */
export const addTableToPDF = (doc: jsPDF, options: TableOptions): number => {
  if (hasAutoTable(doc)) {
    try {
      // Usa o plugin autoTable
      // @ts-expect-error - autoTable é adicionado em runtime
      doc.autoTable(options);

      // Retorna a posição Y final
      // @ts-expect-error - lastAutoTable é adicionado em runtime
      return doc.lastAutoTable?.finalY || options.startY + 50;
    } catch (error) {
      console.error("Erro ao usar autoTable:", error);
      // Continua para o fallback
    }
  }

  // Fallback: cria uma tabela simples sem o plugin
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = options.startY + 5;

  // Cabeçalho
  if (options.head && options.head.length > 0) {
    const headers = options.head[0];
    doc.setFillColor(63, 81, 181);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);

    doc.rect(10, y - 5, pageWidth - 20, 10, "F");

    const headerWidth = (pageWidth - 20) / headers.length;
    headers.forEach((header, index) => {
      doc.text(header, 10 + headerWidth * index + headerWidth / 2, y, {
        align: "center",
      });
    });

    y += 10;
  }

  // Corpo
  if (options.body && options.body.length > 0) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);

    const rowHeight = 8;
    options.body.forEach((row, rowIndex) => {
      // Alterna cores de fundo
      if (rowIndex % 2 === 0) {
        doc.setFillColor(240, 240, 240);
        doc.rect(10, y - 5, pageWidth - 20, rowHeight, "F");
      }

      const cellWidth = (pageWidth - 20) / row.length;
      row.forEach((cell, cellIndex) => {
        let align: "left" | "center" | "right" | "justify" | undefined = "left";
        // Se for um valor numérico ou monetário, alinha à direita
        if (cell.startsWith("R$") || !isNaN(Number(cell))) {
          align = "right";
        }

        const xPos =
          10 + cellWidth * cellIndex + (align === "right" ? cellWidth - 2 : 2);
        doc.text(cell, xPos, y, { align });
      });

      y += rowHeight;
    });
  }

  // Rodapé
  if (options.foot && options.foot.length > 0) {
    const footer = options.foot[0];
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y - 5, pageWidth - 20, 10, "F");

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const footerWidth = (pageWidth - 20) / footer.length;
    footer.forEach((cell, index) => {
      const align: "left" | "center" | "right" | "justify" | undefined =
        index === footer.length - 1 ? "right" : "left";
      const xPos =
        10 + footerWidth * index + (align === "right" ? footerWidth - 2 : 2);
      doc.text(cell, xPos, y, { align });
    });

    y += 10;
  }

  return y;
};
