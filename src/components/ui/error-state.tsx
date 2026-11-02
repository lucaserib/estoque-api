import * as React from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** O que houve — direto, sem "Erro ao..." sozinho. */
  title: string;
  /** O que fazer a respeito. */
  description?: string;
  onRetry?: () => void;
  actionLabel?: string;
  actionHref?: string;
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ title, description, onRetry, actionLabel, actionHref, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-destructive/20 bg-destructive/5 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      <div className="rounded-full bg-destructive/10 p-3 text-destructive-text">
        <AlertCircle className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="max-w-[44ch] space-y-1">
        <p className="font-display text-base font-semibold text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar de novo
        </Button>
      )}
      {actionHref && (
        <Button asChild variant="outline" size="sm">
          <Link href={actionHref}>{actionLabel ?? "Ver como →"}</Link>
        </Button>
      )}
    </div>
  )
);
ErrorState.displayName = "ErrorState";

export { ErrorState };
