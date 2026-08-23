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
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />
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

export {
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableHead,
  DataTableCell,
};
