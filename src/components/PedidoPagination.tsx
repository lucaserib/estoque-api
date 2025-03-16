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
  itemsPerPage,
  currentFirstItem,
  currentLastItem,
}: PedidoPaginationProps) {
  // Função para gerar o array de páginas a exibir
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pageNumbers: (number | "ellipsis")[] = [];

    // Sempre mostrar primeira e última página
    // E mostrar 1 página antes e depois da atual

    // Primeira página
    pageNumbers.push(1);

    // Ellipsis antes da página atual
    if (currentPage > 3) {
      pageNumbers.push("ellipsis");
    }

    // Página anterior (se não for a primeira)
    if (currentPage > 2) {
      pageNumbers.push(currentPage - 1);
    }

    // Página atual (se não for a primeira ou última)
    if (currentPage !== 1 && currentPage !== totalPages) {
      pageNumbers.push(currentPage);
    }

    // Próxima página (se não for a última)
    if (currentPage < totalPages - 1) {
      pageNumbers.push(currentPage + 1);
    }

    // Ellipsis depois da página atual
    if (currentPage < totalPages - 2) {
      pageNumbers.push("ellipsis");
    }

    // Última página (se não for a primeira)
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Mostrando {currentFirstItem}-{currentLastItem} de {totalItems} pedido(s)
      </div>
      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 border-gray-200 dark:border-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pageNumbers.map((page, index) => {
          if (page === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className="px-2">
                ...
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
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 border-gray-200 dark:border-gray-700"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
