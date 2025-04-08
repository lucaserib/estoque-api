// Modificações para src/app/(root)/saidas/components/SaidaList.tsx
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Saida } from "../types";
import { SaidaDetalhesDialog } from "./SaidaDetalhesDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

      exportToExcel(allDetails, fileName, sheetName);
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
        allDetails,
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

      exportToExcel(detalhes, fileName, sheetName);

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
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-dashed border-gray-300 dark:border-gray-700">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
          Nenhuma saída registrada
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
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
        <div className="text-sm text-gray-500">
          {selectedIds.length > 0 ? (
            <span className="font-medium text-indigo-600">
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
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            />
          )}
          <ExportButton
            onClick={handleExportAllSaidas}
            label="Exportar Todas"
          />
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selectedIds.length === saidas.length && saidas.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todas as saídas"
                />
              </TableHead>
              <TableHead className="font-medium">Data</TableHead>
              <TableHead className="font-medium">Armazém</TableHead>
              <TableHead className="font-medium">Itens</TableHead>
              <TableHead className="font-medium">Detalhes</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saidas.map((saida) => (
              <TableRow
                key={saida.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(saida.id)}
                    onCheckedChange={() => toggleSelection(saida.id)}
                    aria-label={`Selecionar saída ${saida.id}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>
                      {format(new Date(saida.data), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{saida.armazem.nome}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {countTotalItems(saida)} itens
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {saida.detalhes.slice(0, 2).map((detalhe) => (
                      <Badge
                        key={detalhe.id}
                        variant="outline"
                        className="bg-gray-50 dark:bg-gray-800"
                      >
                        {detalhe.isKit && <Package className="h-3 w-3 mr-1" />}
                        {detalhe.produto.sku} ({detalhe.quantidade})
                      </Badge>
                    ))}
                    {saida.detalhes.length > 2 && (
                      <Badge
                        variant="outline"
                        className="bg-gray-50 dark:bg-gray-800"
                      >
                        +{saida.detalhes.length - 2} itens
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(saida)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExportSaidaDetails(saida)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-green-600 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/20"
                      title="Exportar para Excel"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
