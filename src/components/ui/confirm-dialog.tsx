"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [confirmando, setConfirmando] = useState(false);

  const handleConfirm = async () => {
    setConfirmando(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(valor) => !confirmando && onOpenChange(valor)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className={`flex items-center gap-2 ${destructive ? "text-destructive-text" : "text-foreground"}`}>
            {destructive && <AlertTriangle className="h-5 w-5" />}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          {description && <AlertDialogDescription className="pt-3">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirmando}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            asChild
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            <Button variant={destructive ? "destructive" : "default"} disabled={confirmando} className="gap-2">
              {confirmando && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
