import Image from "next/image";
import { cn } from "@/lib/utils";

interface MercadoLivreIconProps {
  className?: string;
  width?: number;
  height?: number;
}

export function MercadoLivreIcon({ className = "w-6 h-6", width = 24, height = 24 }: MercadoLivreIconProps) {
  return (
    <Image
      src="/ML.png"
      alt="Mercado Livre"
      width={width}
      height={height}
      unoptimized
      className={cn("object-contain", className)}
    />
  );
}
