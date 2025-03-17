"use client";
import { useState, useEffect } from "react";
import { Search, Loader2, Box, Package } from "lucide-react";
import { FaTrash, FaEdit, FaEye } from "react-icons/fa";
import { Produto } from "../types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KitDetalhesDialog } from "./dialogs/KitDetalhesDialog";
import { ProdutoPagination } from "./ProdutoPagination";

interface KitListProps {
  kits: Produto[];
  onDelete: (id: string) => void;
  refreshTrigger?: number;
}

const KitList = ({ kits, onDelete, refreshTrigger = 0 }: KitListProps) => {
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
  const indexOfFirstKit = indexOfLastItem - itemsPerPage;
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
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-2" />
          <p className="text-gray-500 dark:text-gray-400">Carregando kits...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full border-gray-300 dark:border-gray-600"
        />
      </div>

      <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead className="font-medium">Nome</TableHead>
                  <TableHead className="font-medium">SKU</TableHead>
                  <TableHead className="font-medium">EAN</TableHead>
                  <TableHead className="font-medium">Componentes</TableHead>
                  <TableHead className="font-medium text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentKits.length > 0 ? (
                  currentKits.map((kit) => (
                    <TableRow
                      key={kit.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Box className="h-4 w-4 text-indigo-500 mr-2" />
                          {kit.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-300">
                        {kit.sku}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-300">
                        {kit.ean || "N/A"}
                      </TableCell>
                      <TableCell>
                        {kit.componentes ? (
                          <Badge
                            variant="outline"
                            className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                          >
                            <Package className="h-3 w-3 mr-1" />
                            {kit.componentes.length} itens
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm italic">
                            Sem componentes
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedKit(kit);
                              setShowDetailsModal(true);
                            }}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                          >
                            <FaEye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(kit.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <FaTrash className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-gray-500 dark:text-gray-400"
                    >
                      {searchTerm
                        ? "Nenhum kit encontrado com os critérios de busca."
                        : "Nenhum kit cadastrado. Adicione seu primeiro kit usando o botão 'Novo Produto/Kit'."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
