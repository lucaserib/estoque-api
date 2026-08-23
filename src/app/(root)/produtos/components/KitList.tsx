"use client";
import { useState, useEffect } from "react";
import { Search, Loader2, Box, Package } from "lucide-react";
import { FaTrash, FaEdit, FaEye } from "react-icons/fa";
import { Produto } from "../types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import { KitDetalhesDialog } from "./dialogs/KitDetalhesDialog";
import { ProdutoPagination } from "./ProdutoPagination";
import EANDisplay from "@/components/EANDisplay";

interface KitListProps {
  kits: Produto[];
  onDelete: (id: string) => void;
  refreshTrigger?: number;
}

export const KitList = ({
  kits,
  onDelete,
  refreshTrigger = 0,
}: KitListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedKit, setSelectedKit] = useState<Produto | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isLoadingKits, setIsLoadingKits] = useState(false);
  const [kitsWithComponents, setKitsWithComponents] = useState<Produto[]>([]);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchKitComponents = async () => {
      if (kits.length === 0) return;

      setIsLoadingKits(true);
      try {
        const kitsWithComponentsPromises = kits.map(async (kit) => {
          try {
            const response = await fetch(`/api/kits?sku=${kit.sku}`);
            if (!response.ok) throw new Error("Erro ao buscar detalhes do kit");

            const kitsData = await response.json();
            if (kitsData && kitsData.length > 0) {
              return {
                ...kit,
                componentes: kitsData[0].componentes || [],
              };
            }
            return kit;
          } catch (error) {
            console.error(
              `Erro ao buscar componentes do kit ${kit.sku}:`,
              error
            );
            return kit;
          }
        });

        const updatedKits = await Promise.all(kitsWithComponentsPromises);
        setKitsWithComponents(updatedKits);
      } catch (error) {
        console.error("Erro ao buscar componentes dos kits:", error);
      } finally {
        setIsLoadingKits(false);
      }
    };

    fetchKitComponents();
  }, [kits, refreshTrigger]);

  const filteredKits = kitsWithComponents.filter(
    (kit) =>
      kit.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kit.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastKit = currentPage * itemsPerPage;
  const indexOfFirstKit = indexOfLastKit - itemsPerPage;
  const currentKits = filteredKits.slice(indexOfFirstKit, indexOfLastKit);
  const totalPages = Math.ceil(filteredKits.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este kit?")) {
      onDelete(id);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  if (isLoadingKits) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
          <p className="text-muted-foreground">Carregando kits...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-4 h-4 text-muted-foreground" />
        </div>
        <Input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full border-input"
        />
      </div>

      <SectionCard contentClassName="p-0">
        <DataTable>
          <DataTableHeader>
            <DataTableRow className="hover:bg-transparent">
              <DataTableHead className="pl-4">Kit</DataTableHead>
              <DataTableHead>EAN</DataTableHead>
              <DataTableHead>Componentes</DataTableHead>
              <DataTableHead className="pr-4 text-right">Ações</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {currentKits.length > 0 ? (
              currentKits.map((kit) => (
                <DataTableRow key={kit.id} className="group">
                  <DataTableCell emphasis className="pl-4">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate">{kit.nome}</p>
                        <p className="text-xs font-normal text-muted-foreground">
                          {kit.sku}
                        </p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <EANDisplay produto={kit} />
                  </DataTableCell>
                  <DataTableCell>
                    {kit.componentes ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Package className="h-3 w-3 mr-1" />
                        {kit.componentes.length} itens
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">
                        Sem componentes
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="pr-4 text-right">
                    <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedKit(kit);
                          setShowDetailsModal(true);
                        }}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Ver detalhes do kit"
                      >
                        <FaEye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(kit.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Excluir kit"
                      >
                        <FaTrash className="w-4 h-4" />
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            ) : (
              <DataTableRow className="hover:bg-transparent">
                <DataTableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm
                    ? "Nenhum kit encontrado com os critérios de busca."
                    : "Nenhum kit cadastrado. Adicione seu primeiro kit usando o botão 'Novo Produto/Kit'."}
                </DataTableCell>
              </DataTableRow>
            )}
          </DataTableBody>
        </DataTable>
      </SectionCard>

      {/* Paginação */}
      {filteredKits.length > itemsPerPage && (
        <ProdutoPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={filteredKits.length}
          currentFirstItem={indexOfFirstItem + 1}
          currentLastItem={Math.min(indexOfLastItem, filteredKits.length)}
        />
      )}

      {/* Modal de Detalhes do Kit */}
      {selectedKit && (
        <KitDetalhesDialog
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          kit={selectedKit}
        />
      )}
    </div>
  );
};
