"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PacoteIaCliente } from "./useAcessoIa";
import { useComprarCreditos } from "./useComprarCreditos";

export function PacotesIa({
  pacotes,
  emailVerificado,
  className,
}: {
  pacotes: PacoteIaCliente[];
  emailVerificado: boolean;
  className?: string;
}) {
  const { comprar, comprando, acompanhando } = useComprarCreditos();

  if (pacotes.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Nenhum pacote disponível no momento.</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-2 sm:grid-cols-2">
        {pacotes.map((pacote) => (
          <div
            key={pacote.id}
            data-testid="pacote-ia"
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border p-3",
              pacote.destaque ? "border-primary/50 bg-primary/[0.04]" : "border-border"
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{pacote.nome}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatBRL(pacote.precoCentavos)} · {formatBRL(Math.round(pacote.precoCentavos / pacote.perguntas))} por pergunta
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => comprar(pacote.id)}
              disabled={!emailVerificado || comprando !== null || acompanhando !== null}
              className="shrink-0 gap-1.5"
            >
              {comprando === pacote.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Comprar
            </Button>
          </div>
        ))}
      </div>
      {!emailVerificado && (
        <p className="text-xs text-warning-text">Confirme seu e-mail (aviso no topo da tela) para comprar perguntas.</p>
      )}
      {acompanhando && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Esperando a confirmação do pagamento…
        </p>
      )}
      <p className="text-xs text-muted-foreground">Pix ou cartão pelo Mercado Pago. O pagamento abre em outra aba.</p>
    </div>
  );
}
