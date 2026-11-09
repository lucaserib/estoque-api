"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolhaProps {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  titulo: string;
  descricao?: string;
  cabecalho?: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: "media" | "larga";
  children: React.ReactNode;
}

export function Folha({ aberta, aoMudar, titulo, descricao, cabecalho, rodape, largura = "larga", children }: FolhaProps) {
  return (
    <DialogPrimitive.Root open={aberta} onOpenChange={aoMudar}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex h-[100dvh] w-full flex-col bg-background shadow-lift outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:border-l sm:border-border data-[state=open]:sm:slide-in-from-right-8",
            largura === "larga" ? "sm:max-w-[720px]" : "sm:max-w-[480px]"
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 sm:px-5">
            <DialogPrimitive.Close
              className="flex h-10 w-10 items-center justify-center rounded-lg text-fg2 hover:bg-muted sm:hidden"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </DialogPrimitive.Close>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-sm font-semibold text-foreground">{titulo}</DialogPrimitive.Title>
              {descricao ? (
                <DialogPrimitive.Description className="truncate text-xs text-muted-foreground">{descricao}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{titulo}</DialogPrimitive.Description>
              )}
            </div>
            {cabecalho}
            <DialogPrimitive.Close
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-fg2 hover:bg-muted sm:flex"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {rodape && (
            <div
              className="shrink-0 border-t border-border bg-card px-3 py-2.5 sm:px-5"
              style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
            >
              {rodape}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
