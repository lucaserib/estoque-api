"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface PartialDataAlertProps {
  onRetry: () => void;
  retrying?: boolean;
}

export default function PartialDataAlert({
  onRetry,
  retrying = false,
}: PartialDataAlertProps) {
  return (
    <Alert variant="warning" className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <AlertDescription>
          Não foi possível carregar todos os pedidos do Mercado Livre. Os
          números abaixo podem estar incompletos — tente novamente.
        </AlertDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={onRetry}
        disabled={retrying}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
        Recarregar
      </Button>
    </Alert>
  );
}
