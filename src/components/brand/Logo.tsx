import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Tamanho do símbolo em px (o wordmark acompanha) */
  size?: "sm" | "md" | "lg";
  /** Exibir só o símbolo (sidebar colapsada, favicons) */
  iconOnly?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: "h-5 w-5", text: "text-lg" },
  md: { icon: "h-6 w-6", text: "text-xl" },
  lg: { icon: "h-8 w-8", text: "text-3xl" },
};

/**
 * Logo Estoca — wordmark tipográfico (Sora 700, minúsculas) + símbolo.
 * Placeholder oficial até existir o SVG final da marca.
 */
export function Logo({ size = "md", iconOnly = false, className }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Package className={cn(s.icon, "text-primary")} strokeWidth={2.25} />
      {!iconOnly && (
        <span
          className={cn(
            s.text,
            "font-display font-bold lowercase tracking-tight text-foreground"
          )}
        >
          estoca
        </span>
      )}
    </span>
  );
}

export default Logo;
