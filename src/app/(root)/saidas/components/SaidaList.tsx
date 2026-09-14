// Modificações para src/app/(root)/saidas/components/SaidaList.tsx
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Saida } from "../types";
import { SaidaDetalhesDialog } from "./SaidaDetalhesDialog";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  Calendar,
  Package,
  Warehouse,
  FileDown,
  Check,
} from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import {
  exportToExcel,
  formatSaidasForExport,
  formatSaidaDetalhesForExport,
} from "@/utils/excelExport";
import { toast } from "sonner";

interface SaidaListProps {
  saidas: Saida[];
}

export function SaidaList({ saidas }: SaidaListProps) {
  const [selectedSaida, setSelectedSaida] = useState<Saida | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Handle opening the details dialog
  const handleViewDetails = (saida: Saida) => {
    setSelectedSaida(saida);
    setIsDetailsOpen(true);
  };

  // Function to export all saidas
  const handleExportAllSaidas = () => {
    try {
      if (!saidas || saidas.length === 0) {
        toast.warning("Não há saídas para exportar");
        return;
      }

      // Gerar dados no mesmo formato que usamos para saídas individuais
      // mas colocando todas em um único arquivo com separadores
      const allDetails = [];
      let hasValidData = false;

      for (const saida of saidas) {
        // Verificar se a saída tem detalhes válidos
        if (
          !saida ||
          !saida.detalhes ||
          !Array.isArray(saida.detalhes) ||
          !saida.data ||
          !saida.armazem
        ) {
          continue; // Pular esta saída se não tiver dados válidos
        }

        // Adicionar cabeçalho com informações da saída
        allDetails.push({
          Produto: `===== SAÍDA - DATA: ${format(
            new Date(saida.data),
            "dd/MM/yyyy",
            { locale: ptBR }
          )} - ARMAZÉM: ${saida.armazem.nome || "Desconhecido"} =====`,
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });

        // Espaço em branco após o cabeçalho
        allDetails.push({
          Produto: "",
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });

        // Adicionar os itens desta saída
        let addedItems = false;
        if (saida.detalhes && Array.isArray(saida.detalhes)) {
          for (const detalhe of saida.detalhes) {
            if (detalhe && detalhe.produto) {
              allDetails.push({
                Produto: detalhe.produto.nome || "Nome não disponível",
                SKU: detalhe.produto.sku || "SKU não disponível",
                Quantidade: detalhe.quantidade || 0,
                Tipo: detalhe.isKit ? "Kit" : "Produto",
              });
              addedItems = true;
              hasValidData = true;
            }
          }
        }

        if (!addedItems) {
          allDetails.push({
            Produto: "Esta saída não possui itens",
            SKU: "",
            Quantidade: "",
            Tipo: "",
          });
        }

        // Adicionar linhas em branco entre saídas
        allDetails.push({
          Produto: "",
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });

        allDetails.push({
          Produto: "",
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });
      }

      if (!hasValidData) {
        toast.error("Nenhum dado válido encontrado para exportação");
        return;
      }

      // Limitar o nome da planilha a 31 caracteres (limite do Excel)
      const sheetName = "Detalhes Todas as Saídas";

      // Nome do arquivo que inclui a quantidade de saídas
      const fileName = `saidas_detalhes_completos_${saidas.length}`;

      exportToExcel(
        allDetails as unknown as Record<string, unknown>[],
        fileName,
        sheetName
      );
      toast.success("Exportação concluída com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar dados");
      console.error("Erro na função handleExportAllSaidas:", error);
    }
  };

  // Function to export selected saidas
  const handleExportSelectedSaidas = () => {
    if (selectedIds.length === 0) {
      toast.warning("Selecione pelo menos uma saída para exportar");
      return;
    }

    try {
      const selectedSaidas = saidas.filter((saida) =>
        selectedIds.includes(saida.id)
      );

      if (selectedSaidas.length === 0) {
        toast.error("Nenhuma saída válida encontrada para exportação");
        return;
      }

      // Se for apenas uma saída, use exatamente o mesmo comportamento da exportação individual
      if (selectedSaidas.length === 1) {
        handleExportSaidaDetails(selectedSaidas[0]);
        return;
      }

      // Para múltiplas saídas, usamos o mesmo formato que funciona para a exportação individual
      // mas colocando todas em um único arquivo com separadores
      const allDetails = [];
      let hasValidData = false;

      for (const saida of selectedSaidas) {
        // Verificar se a saída tem detalhes válidos
        if (!saida || !saida.detalhes || !Array.isArray(saida.detalhes)) {
          continue; // Pular esta saída se não tiver detalhes válidos
        }

        // Adicionar cabeçalho com informações da saída
        allDetails.push({
          Produto: `===== SAÍDA - DATA: ${format(
            new Date(saida.data),
            "dd/MM/yyyy",
            { locale: ptBR }
          )} - ARMAZÉM: ${saida.armazem?.nome || "Desconhecido"} =====`,
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });

        // Espaço em branco após o cabeçalho
        allDetails.push({
          Produto: "",
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });

        // Adicionar os itens desta saída
        let addedItems = false;
        for (const detalhe of saida.detalhes) {
          if (detalhe && detalhe.produto) {
            allDetails.push({
              Produto: detalhe.produto.nome || "Nome não disponível",
              SKU: detalhe.produto.sku || "SKU não disponível",
              Quantidade: detalhe.quantidade || 0,
              Tipo: detalhe.isKit ? "Kit" : "Produto",
            });
            addedItems = true;
            hasValidData = true;
          }
        }

        if (!addedItems) {
          allDetails.push({
            Produto: "Esta saída não possui itens",
            SKU: "",
            Quantidade: "",
            Tipo: "",
          });
        }

        // Adicionar linhas em branco entre saídas
        allDetails.push({
          Produto: "",
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });

        allDetails.push({
          Produto: "",
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });
      }

      if (!hasValidData) {
        toast.error("Nenhum dado válido encontrado para exportação");
        return;
      }

      // Limitar o nome da planilha a 31 caracteres (limite do Excel)
      const sheetName = `Detalhes Saídas Selecionadas`;

      exportToExcel(
        allDetails as unknown as Record<string, unknown>[],
        `saidas_selecionadas_${selectedIds.length}`,
        sheetName
      );

      toast.success(`${selectedIds.length} saída(s) exportada(s) com sucesso`);
    } catch (error) {
      toast.error("Erro ao exportar dados");
      console.error("Erro na função handleExportSelectedSaidas:", error);
    }
  };

  // Function to export a single saida with details
  const handleExportSaidaDetails = (saida: Saida) => {
    try {
      // Verificar se a saída tem dados válidos
      if (!saida || !saida.detalhes || !Array.isArray(saida.detalhes)) {
        toast.error("Dados de saída inválidos para exportação");
        return;
      }

      // Verificar se a saída tem data e armazém válidos
      if (!saida.data || !saida.armazem) {
        toast.error("Dados de saída incompletos para exportação");
        return;
      }

      // Preparar os dados para exportação
      const detalhes = [];

      // Adicionar um cabeçalho com informações da saída
      detalhes.push({
        Produto: `Saída - ${format(new Date(saida.data), "dd/MM/yyyy", {
          locale: ptBR,
        })} - ${saida.armazem.nome || "Armazém não identificado"}`,
        SKU: "",
        Quantidade: "",
        Tipo: "",
      });

      // Adicionar linha em branco
      detalhes.push({
        Produto: "",
        SKU: "",
        Quantidade: "",
        Tipo: "",
      });

      // Adicionar os itens
      let hasItems = false;
      for (const detalhe of saida.detalhes) {
        if (detalhe && detalhe.produto) {
          detalhes.push({
            Produto: detalhe.produto.nome || "Nome não disponível",
            SKU: detalhe.produto.sku || "SKU não disponível",
            Quantidade: detalhe.quantidade || 0,
            Tipo: detalhe.isKit ? "Kit" : "Produto",
          });
          hasItems = true;
        }
      }

      if (!hasItems) {
        detalhes.push({
          Produto: "Esta saída não possui itens",
          SKU: "",
          Quantidade: "",
          Tipo: "",
        });
      }

      // Limitar o nome da planilha a 31 caracteres (limite do Excel)
      const sheetName = "Detalhes da Saída";

      // Nome do arquivo que inclui a data formatada da saída
      const fileDate = format(new Date(saida.data), "dd-MM-yyyy");
      const fileName = `saida_detalhes_${fileDate}`;

      exportToExcel(
        detalhes as unknown as Record<string, unknown>[],
        fileName,
        sheetName
      );

      toast.success("Exportação concluída com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar dados");
      console.error("Erro ao exportar saída individual:", error);
    }
  };

  // Function to count total items in a saida
  const countTotalItems = (saida: Saida) => {
    return saida.detalhes.reduce((acc, detalhe) => acc + detalhe.quantidade, 0);
  };

  // Toggle selection of a saida
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  // Toggle selection of all saidas
  const toggleSelectAll = () => {
    if (selectedIds.length === saidas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(saidas.map((saida) => saida.id));
    }
  };

  // If there are no saidas, show a message
  if (!saidas || saidas.length === 0) {
    // Mantenha o código existente para quando não há saídas...
    return (
      <div className="text-center py-8 bg-background rounded-md border border-dashed border-input">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          Nenhuma saída registrada
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Não há registros de saída no período selecionado. Use o botão
          &quot;Nova Saída&quot; para registrar a movimentação de produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botões para exportação */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-muted-foreground">
          {selectedIds.length > 0 ? (
            <span className="font-medium text-primary">
              {selectedIds.length}{" "}
              {selectedIds.length === 1
                ? "saída selecionada"
                : "saídas selecionadas"}
            </span>
          ) : (
            <span>Selecione as saídas para exportar</span>
          )}
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <ExportButton
              onClick={handleExportSelectedSaidas}
              label={`Exportar ${selectedIds.length} Selecionadas`}
            />
          )}
          <ExportButton
            onClick={handleExportAllSaidas}
            label="Exportar Todas"
          />
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <DataTable>
          <DataTableHeader>
            <DataTableRow className="hover:bg-transparent">
              <DataTableHead className="w-12 pl-4">
                <Checkbox
                  checked={
                    selectedIds.length === saidas.length && saidas.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todas as saídas"
                />
              </DataTableHead>
              <DataTableHead>Data</DataTableHead>
              <DataTableHead>Armazém</DataTableHead>
              <DataTableHead>Itens</DataTableHead>
              <DataTableHead>Detalhes</DataTableHead>
              <DataTableHead className="pr-4 text-right">Ações</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {saidas.map((saida) => (
              <DataTableRow key={saida.id} className="group">
                <DataTableCell className="pl-4">
                  <Checkbox
                    checked={selectedIds.includes(saida.id)}
                    onCheckedChange={() => toggleSelection(saida.id)}
                    aria-label={`Selecionar saída ${saida.id}`}
                  />
                </DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(saida.data), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{saida.armazem.nome}</span>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <Badge className="bg-info/10 text-info">
                    {countTotalItems(saida)} itens
                  </Badge>
                </DataTableCell>
                <DataTableCell>
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {saida.detalhes.slice(0, 2).map((detalhe) => (
                      <Badge key={detalhe.id} variant="outline">
                        {detalhe.isKit && <Package className="h-3 w-3 mr-1" />}
                        {detalhe.produto.sku} ({detalhe.quantidade})
                      </Badge>
                    ))}
                    {saida.detalhes.length > 2 && (
                      <Badge variant="outline">
                        +{saida.detalhes.length - 2} itens
                      </Badge>
                    )}
                  </div>
                </DataTableCell>
                <DataTableCell className="pr-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(saida)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExportSaidaDetails(saida)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-muted-foreground hover:text-success hover:bg-success/10"
                      title="Exportar para Excel"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </div>

      {/* Details Dialog com opção de exportar */}
      {selectedSaida && (
        <SaidaDetalhesDialog
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          saida={selectedSaida}
          onExport={() => handleExportSaidaDetails(selectedSaida)}
        />
      )}
    </div>
  );
}
