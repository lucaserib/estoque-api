import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/** Botão "+" flutuante, só no celular — ação principal da tela ao alcance do polegar. */
const FloatingActionButton = React.forwardRef<HTMLButtonElement, FloatingActionButtonProps>(
  ({ label, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform active:scale-95 md:hidden",
        className
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      {...props}
    >
      <Plus className="h-6 w-6" strokeWidth={2} />
    </button>
  )
);
FloatingActionButton.displayName = "FloatingActionButton";

export { FloatingActionButton };
