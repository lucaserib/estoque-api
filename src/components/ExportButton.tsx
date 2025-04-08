// src/components/ExportButton.tsx
import React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface ExportButtonProps extends Omit<ButtonProps, "onClick"> {
  onClick: () => void;
  label?: string;
}

export function ExportButton({
  onClick,
  label = "Exportar Excel",
  className,
  variant = "outline",
  size = "sm",
  ...props
}: ExportButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={`gap-1.5 ${className || ""}`}
      {...props}
    >
      <FileDown className="h-4 w-4" />
      {label}
    </Button>
  );
}
