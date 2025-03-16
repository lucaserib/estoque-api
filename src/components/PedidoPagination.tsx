"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PedidoPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (pageNumber: number) => void;
  totalItems: number;
  itemsPerPage: number;
  currentFirstItem: number;
  currentLastItem: number;
}

export function PedidoPagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  currentFirstItem,
  currentLastItem,
}: PedidoPaginationProps) {
  // Função para gerar o array de páginas a exibir de forma eficiente
  const getPageNumbers = (): Array<number | "ellipsis"> => {
    // Para um número baixo de páginas, mostramos todas
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pageNumbers: Array<number | "ellipsis"> = [];

    // Sempre mostrar a primeira página
    pageNumbers.push(1);

    // Se a página atual estiver depois das primeiras 3 páginas, adicionar reticências
    if (currentPage > 3) {
      pageNumbers.push("ellipsis");
    }

    // Mostrar uma página antes da atual (se não for a primeira)
    if (currentPage > 2) {
      pageNumbers.push(currentPage - 1);
    }

    // Página atual (se não for a primeira ou última)
    if (currentPage !== 1 && currentPage !== totalPages) {
      pageNumbers.push(currentPage);
    }

    // Mostrar uma página depois da atual (se não for a última)
    if (currentPage < totalPages - 1) {
      pageNumbers.push(currentPage + 1);
    }

    // Se a página atual estiver antes das últimas 3 páginas, adicionar reticências
    if (currentPage < totalPages - 2) {
      pageNumbers.push("ellipsis");
    }

    // Sempre mostrar a última página
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
      <div className="text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
        Mostrando {currentFirstItem}-{currentLastItem} de {totalItems} pedido(s)
      </div>

      <div className="flex items-center space-x-1 order-1 sm:order-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 border-gray-200 dark:border-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Página anterior</span>
        </Button>

        <div className="flex items-center space-x-1">
          {pageNumbers.map((page, index) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-gray-500 dark:text-gray-400"
                >
                  …
                </span>
              );
            }

            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={`h-8 w-8 p-0 ${
                  currentPage === page
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {page}
                <span className="sr-only">Página {page}</span>
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 border-gray-200 dark:border-gray-700"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Próxima página</span>
        </Button>
      </div>
    </div>
  );
}
