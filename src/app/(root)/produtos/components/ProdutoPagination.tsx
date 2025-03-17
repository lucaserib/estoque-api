"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProdutoPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (pageNumber: number) => void;
  totalItems: number;
  currentFirstItem: number;
  currentLastItem: number;
}

export function ProdutoPagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  currentFirstItem,
  currentLastItem,
}: ProdutoPaginationProps) {
  // Function to generate the array of page numbers to display efficiently
  const getPageNumbers = (): Array<number | "ellipsis"> => {
    // For a low number of pages, show all
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pageNumbers: Array<number | "ellipsis"> = [];

    // Always show first page
    pageNumbers.push(1);

    // If current page is after first 3 pages, add ellipsis
    if (currentPage > 3) {
      pageNumbers.push("ellipsis");
    }

    // Show one page before current (if not first)
    if (currentPage > 2) {
      pageNumbers.push(currentPage - 1);
    }

    // Current page (if not first or last)
    if (currentPage !== 1 && currentPage !== totalPages) {
      pageNumbers.push(currentPage);
    }

    // Show one page after current (if not last)
    if (currentPage < totalPages - 1) {
      pageNumbers.push(currentPage + 1);
    }

    // If current page is before last 3 pages, add ellipsis
    if (currentPage < totalPages - 2) {
      pageNumbers.push("ellipsis");
    }

    // Always show last page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 mt-2">
      <div className="text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
        Mostrando {currentFirstItem}-{currentLastItem} de {totalItems} itens
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
