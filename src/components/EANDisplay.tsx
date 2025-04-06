// src/components/EANDisplay.tsx
import React from "react";
import { Barcode } from "lucide-react";
import { getEANFromProduct } from "@/utils/ean";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EANDisplayProps {
  produto: any;

  emptyMessage?: string;

  showIcon?: boolean;

  size?: "sm" | "md" | "lg";

  className?: string;
}

const EANDisplay: React.FC<EANDisplayProps> = ({
  produto,
  emptyMessage = "Não informado",
  showIcon = true,
  size = "md",
  className = "",
}) => {
  const ean = getEANFromProduct(produto);

  if (!ean) {
    return (
      <span
        className={`text-gray-400 italic ${
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"
        } ${className}`}
      >
        {emptyMessage}
      </span>
    );
  }

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-1 font-mono ${sizeClasses[size]} ${className}`}
          >
            {showIcon && <Barcode className="h-3.5 w-3.5 text-gray-400" />}
            <span>{ean}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Código EAN: {ean}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EANDisplay;
