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
  const getPageNumbers = (): Array<number | "ellipsis"> => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pageNumbers: Array<number | "ellipsis"> = [];

    pageNumbers.push(1);

    if (currentPage > 3) {
      pageNumbers.push("ellipsis");
    }

    if (currentPage > 2) {
      pageNumbers.push(currentPage - 1);
    }

    if (currentPage !== 1 && currentPage !== totalPages) {
      pageNumbers.push(currentPage);
    }

    if (currentPage < totalPages - 1) {
      pageNumbers.push(currentPage + 1);
    }

    if (currentPage < totalPages - 2) {
      pageNumbers.push("ellipsis");
    }

    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
      <div className="text-sm text-muted-foreground order-2 sm:order-1">
        Mostrando {currentFirstItem}-{currentLastItem} de {totalItems} pedido(s)
      </div>

      <div className="flex items-center space-x-1 order-1 sm:order-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 border-border"
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
                  className="px-2 text-muted-foreground"
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
                  currentPage === page ? "" : "border-border"
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
          className="h-8 w-8 p-0 border-border"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Próxima página</span>
        </Button>
      </div>
    </div>
  );
}
