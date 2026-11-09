"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PacotesIa } from "./PacotesIa";
import type { PacoteIaCliente } from "./useAcessoIa";

interface Movimento {
  id: string;
  tipo: "ENTRADA" | "CONSUMO" | "ESTORNO" | "EXPIRACAO" | "AJUSTE";
  quantidade: number;
  saldoApos: number;
  descricao: string;
  createdAt: string;
}

interface Creditos {
  saldo: number;
  ilimitada: boolean;
  proximoVencimento: { quantidade: number; validoAte: string } | null;
  extrato: { total: number; pagina: number; porPagina: number; itens: Movimento[] };
  pacotes: PacoteIaCliente[];
  emailVerificado: boolean;
}

export function CartaoCreditosIa({ className }: { className?: string }) {
  const [creditos, setCreditos] = useState<Creditos | null>(null);
  const [extratoAberto, setExtratoAberto] = useState(false);

  const carregar = useCallback(() => {
    fetch("/api/ia/creditos")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => dados && setCreditos(dados))
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [carregar]);

  return (
    <Card className={cn("overflow-hidden border-primary/30", className)} data-testid="cartao-creditos-ia">
      <div className="bg-hero px-6 py-5 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <p className="text-lg font-semibold">Skubo IA</p>
          {creditos && (
            <span className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/25 tabular-nums">
              {creditos.ilimitada ? "Liberada pela equipe Skubo" : `${creditos.saldo} ${creditos.saldo === 1 ? "pergunta" : "perguntas"}`}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/85">Um analista de e-commerce que conversa com os dados da sua loja. Pague só pelo que usar.</p>
      </div>
      <CardContent className="space-y-5 pt-6">
        {!creditos ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {creditos.proximoVencimento && !creditos.ilimitada && (
              <p className="text-sm text-fg2">
                {creditos.proximoVencimento.quantidade} {creditos.proximoVencimento.quantidade === 1 ? "pergunta vence" : "perguntas vencem"} em{" "}
                {formatDateBR(creditos.proximoVencimento.validoAte)}.
              </p>
            )}
            {!creditos.ilimitada && <PacotesIa pacotes={creditos.pacotes} emailVerificado={creditos.emailVerificado} />}

            {creditos.extrato.itens.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setExtratoAberto((v) => !v)}
                  aria-expanded={extratoAberto}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Extrato de perguntas
                  <ChevronDown className={cn("h-4 w-4 transition-transform", extratoAberto && "rotate-180")} />
                </button>
                {extratoAberto && (
                  <ul className="mt-3 divide-y divide-divider rounded-lg border border-border text-sm">
                    {creditos.extrato.itens.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{m.descricao}</p>
                          <p className="text-xs text-muted-foreground">{formatDateBR(m.createdAt)}</p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className={cn("font-medium", m.quantidade > 0 ? "text-success-text" : "text-foreground")}>
                            {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                          </p>
                          <p className="text-xs text-muted-foreground">saldo {m.saldoApos}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
