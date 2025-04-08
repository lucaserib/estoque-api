import { Pedido } from "@/app/(root)/gestao-pedidos/types";
import { formatBRL } from "./currency";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { loadPDF, addTableToPDF, TableOptions, canUsePDF } from "./pdfHelper";

// Função para gerar PDF para um único pedido
export const generatePedidoPDF = async (pedido: Pedido): Promise<void> => {
  try {
    // Verifica se estamos no browser
    if (!canUsePDF()) {
      console.error("Esta função só pode ser executada no browser");
      return;
    }

    // Carrega o jsPDF com o plugin
    const doc = await loadPDF();

    // Adiciona o cabeçalho
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(20);
    doc.setTextColor(52, 52, 52);
    doc.text(`Pedido #${pedido.id}`, pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);

    doc.text(`Fornecedor: ${pedido.fornecedor.nome}`, 14, 35);
    doc.text(
      `Status: ${pedido.status === "confirmado" ? "Concluído" : "Pendente"}`,
      14,
      42
    );

    if (pedido.dataConclusao) {
      const dataFormatada = format(
        new Date(pedido.dataConclusao),
        "dd/MM/yyyy",
        { locale: ptBR }
      );
      doc.text(`Data de Conclusão: ${dataFormatada}`, 14, 49);
    } else if (pedido.dataPrevista) {
      const dataFormatada = format(
        new Date(pedido.dataPrevista),
        "dd/MM/yyyy",
        { locale: ptBR }
      );
      doc.text(`Data Prevista: ${dataFormatada}`, 14, 49);
    }

    if (pedido.comentarios) {
      doc.text("Comentários:", 14, 56);
      const comentariosWrapped = doc.splitTextToSize(
        pedido.comentarios,
        pageWidth - 30
      );
      doc.text(comentariosWrapped, 14, 63);
    }

    // Prepara os dados da tabela
    const tableHeaders = [
      ["SKU", "Produto", "Qtd", "Preço Unit.", "Mult.", "Subtotal"],
    ];

    const tableData = pedido.produtos.map((produto) => {
      const multiplicador =
        produto.multiplicador || produto.produto?.multiplicador || 1;
      const subtotal = produto.quantidade * produto.custo * multiplicador;

      return [
        produto.produto?.sku || "N/A",
        produto.produto?.nome || "Produto não encontrado",
        produto.quantidade.toString(),
        formatBRL(produto.custo),
        `${multiplicador}x`,
        formatBRL(subtotal),
      ];
    });

    const valorTotal = pedido.produtos.reduce((total, produto) => {
      const multiplicador =
        produto.multiplicador || produto.produto?.multiplicador || 1;
      return total + produto.quantidade * produto.custo * multiplicador;
    }, 0);

    // Posição inicial da tabela
    const startY = pedido.comentarios ? 75 : 60;

    // Configurar opções da tabela
    const tableOptions: TableOptions = {
      head: tableHeaders,
      body: tableData,
      foot: [["", "", "", "", "TOTAL", formatBRL(valorTotal)]],
      startY,
      theme: "grid",
      headStyles: {
        fillColor: [63, 81, 181],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 30 }, // SKU
        1: { cellWidth: "auto" }, // Nome do produto
        2: { cellWidth: 20, halign: "center" }, // Quantidade
        3: { cellWidth: 30, halign: "right" }, // Preço unitário
        4: { cellWidth: 20, halign: "center" }, // Multiplicador
        5: { cellWidth: 30, halign: "right" }, // Subtotal
      },
    };

    // Adiciona a tabela usando nossa função auxiliar
    addTableToPDF(doc, tableOptions);

    // Adiciona rodapé
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    const dataAtual = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    doc.text(
      `Documento gerado em ${dataAtual}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    // Salva o PDF
    doc.save(`pedido-${pedido.id}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    throw error;
  }
};

// Função para gerar PDF para múltiplos pedidos
export const generateMultiplePedidosPDF = async (
  pedidos: Pedido[]
): Promise<void> => {
  if (pedidos.length === 0) return;

  try {
    // Se houver apenas um pedido, usar o método de pedido único
    if (pedidos.length === 1) {
      await generatePedidoPDF(pedidos[0]);
      return;
    }

    // Verifica se estamos no browser
    if (!canUsePDF()) {
      console.error("Esta função só pode ser executada no browser");
      return;
    }

    // Carrega o jsPDF com o plugin
    const doc = await loadPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Adiciona o cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(52, 52, 52);
    doc.text(`Relatório de Pedidos (${pedidos.length})`, pageWidth / 2, 20, {
      align: "center",
    });

    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    const dataAtual = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    doc.text(`Gerado em: ${dataAtual}`, pageWidth / 2, 30, { align: "center" });

    let startY = 40;

    for (let index = 0; index < pedidos.length; index++) {
      const pedido = pedidos[index];
      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(52, 52, 52);
      doc.text(`Pedido #${pedido.id} - ${pedido.fornecedor.nome}`, 14, startY);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);

      let statusText = `Status: ${
        pedido.status === "confirmado" ? "Concluído" : "Pendente"
      }`;
      if (pedido.dataConclusao) {
        const dataFormatada = format(
          new Date(pedido.dataConclusao),
          "dd/MM/yyyy",
          { locale: ptBR }
        );
        statusText += ` | Data de Conclusão: ${dataFormatada}`;
      } else if (pedido.dataPrevista) {
        const dataFormatada = format(
          new Date(pedido.dataPrevista),
          "dd/MM/yyyy",
          { locale: ptBR }
        );
        statusText += ` | Data Prevista: ${dataFormatada}`;
      }

      doc.text(statusText, 14, startY + 7);

      const tableHeaders = [
        ["SKU", "Produto", "Qtd", "Unit.", "Mult.", "Subtotal"],
      ];

      const tableData = pedido.produtos.map((produto) => {
        const multiplicador =
          produto.multiplicador || produto.produto?.multiplicador || 1;
        const subtotal = produto.quantidade * produto.custo * multiplicador;

        return [
          produto.produto?.sku || "N/A",
          produto.produto?.nome || "Produto não encontrado",
          produto.quantidade.toString(),
          formatBRL(produto.custo),
          `${multiplicador}x`,
          formatBRL(subtotal),
        ];
      });

      const valorTotal = pedido.produtos.reduce((total, produto) => {
        const multiplicador =
          produto.multiplicador || produto.produto?.multiplicador || 1;
        return total + produto.quantidade * produto.custo * multiplicador;
      }, 0);

      // Configurar opções da tabela
      const tableOptions: TableOptions = {
        head: tableHeaders,
        body: tableData,
        foot: [["", "", "", "", "TOTAL", formatBRL(valorTotal)]],
        startY: startY + 10,
        theme: "grid",
        headStyles: {
          fillColor: [63, 81, 181],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        footStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 25 }, // SKU
          1: { cellWidth: "auto" }, // Nome do produto
          2: { cellWidth: 15, halign: "center" }, // Quantidade
          3: { cellWidth: 25, halign: "right" }, // Preço unitário
          4: { cellWidth: 15, halign: "center" }, // Multiplicador
          5: { cellWidth: 25, halign: "right" }, // Subtotal
        },
      };

      // Adiciona a tabela usando nossa função auxiliar
      const finalY = addTableToPDF(doc, tableOptions);
      startY = finalY + 20;

      if (index < pedidos.length - 1) {
        doc.setDrawColor(200, 200, 200);
        doc.line(14, startY - 10, pageWidth - 14, startY - 10);
      }
    }

    // Adiciona rodapé
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${pedidos.length} pedido(s) incluído(s) neste relatório`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    // Salva o PDF
    doc.save(
      `pedidos-relatorio-${format(new Date(), "yyyy-MM-dd", {
        locale: ptBR,
      })}.pdf`
    );
  } catch (error) {
    console.error("Erro ao gerar PDF múltiplo:", error);
    throw error;
  }
};
