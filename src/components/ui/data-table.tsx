import * as React from "react";
import { cn } from "@/lib/utils";

const DataTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
));
DataTable.displayName = "DataTable";

const DataTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-border [&_tr]:bg-accent [&_tr]:hover:bg-accent", className)}
    {...props}
  />
));
DataTableHeader.displayName = "DataTableHeader";

const DataTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
DataTableBody.displayName = "DataTableBody";

const DataTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "group h-11 border-b border-border transition-colors hover:bg-accent",
      className
    )}
    {...props}
  />
));
DataTableRow.displayName = "DataTableRow";

interface DataTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
}

const DataTableHead = React.forwardRef<HTMLTableCellElement, DataTableHeadProps>(
  ({ className, sticky, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "text-eyebrow px-3 text-left align-middle",
        sticky && "sticky left-0 z-10 border-r border-border bg-card",
        className
      )}
      {...props}
    />
  )
);
DataTableHead.displayName = "DataTableHead";

interface DataTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  emphasis?: boolean;
  sticky?: boolean;
}

const DataTableCell = React.forwardRef<HTMLTableCellElement, DataTableCellProps>(
  ({ className, numeric, emphasis, sticky, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-3 align-middle",
        numeric && "text-right tabular-nums",
        emphasis && "font-medium text-foreground",
        sticky &&
          "sticky left-0 z-10 border-r border-border bg-card group-hover:bg-accent",
        className
      )}
      {...props}
    />
  )
);
DataTableCell.displayName = "DataTableCell";

export interface ColunaResponsiva<T> {
  chave: string;
  cabecalho: string;
  renderizar: (linha: T) => React.ReactNode;
  numeric?: boolean;
  papelMobile?: "titulo" | "subtitulo" | "valor" | "oculto";
}

interface DataTableResponsiveProps<T> {
  colunas: ColunaResponsiva<T>[];
  linhas: T[];
  chaveLinha: (linha: T) => string;
  onRowClick?: (linha: T) => void;
  className?: string;
}

function DataTableResponsive<T>({
  colunas,
  linhas,
  chaveLinha,
  onRowClick,
  className,
}: DataTableResponsiveProps<T>) {
  const colunasCartao = colunas.filter((c) => c.papelMobile !== "oculto");
  const colunaTitulo = colunasCartao.find((c) => c.papelMobile === "titulo");
  const colunaSubtitulo = colunasCartao.find((c) => c.papelMobile === "subtitulo");
  const colunasValor = colunasCartao.filter((c) => c.papelMobile === "valor");

  return (
    <>
      <div className={cn("hidden md:block", className)}>
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              {colunas.map((c) => (
                <DataTableHead key={c.chave} className={c.numeric ? "text-right" : undefined}>
                  {c.cabecalho}
                </DataTableHead>
              ))}
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {linhas.map((linha) => (
              <DataTableRow
                key={chaveLinha(linha)}
                onClick={onRowClick ? () => onRowClick(linha) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {colunas.map((c) => (
                  <DataTableCell key={c.chave} numeric={c.numeric}>
                    {c.renderizar(linha)}
                  </DataTableCell>
                ))}
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </div>

      <div className="space-y-2 md:hidden">
        {linhas.map((linha) => (
          <div
            key={chaveLinha(linha)}
            onClick={onRowClick ? () => onRowClick(linha) : undefined}
            className={cn(
              "rounded-card border border-border bg-card p-4 shadow-card",
              onRowClick && "cursor-pointer"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {colunaTitulo && (
                  <p className="truncate font-medium text-foreground">
                    {colunaTitulo.renderizar(linha)}
                  </p>
                )}
                {colunaSubtitulo && (
                  <p className="truncate text-sm text-muted-foreground">
                    {colunaSubtitulo.renderizar(linha)}
                  </p>
                )}
              </div>
              {colunasValor.length > 0 && (
                <div className="shrink-0 text-right">
                  {colunasValor.map((c) => (
                    <p key={c.chave} className="tabular-nums text-foreground">
                      {c.renderizar(linha)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export {
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableHead,
  DataTableCell,
  DataTableResponsive,
};
