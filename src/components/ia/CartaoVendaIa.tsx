"use client";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PacotesIa } from "./PacotesIa";
import type { AcessoIaCliente } from "./useAcessoIa";

const BENEFICIOS = [
  "Pergunte em português: “o que preciso comprar esta semana?”",
  "Respostas com os números reais da Reposição, do Financeiro e dos Anúncios",
  "“Por que essa sugestão?” e “Explicar variação” direto nas telas",
];

export function CartaoVendaIa({ acesso, className }: { acesso: AcessoIaCliente; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-card border border-border/80 bg-card shadow-card", className)} data-testid="sem-perguntas-ia">
      <div className="bg-hero px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <p className="text-sm font-semibold">Suas perguntas da Skubo IA acabaram</p>
        </div>
        <p className="mt-1 text-xs text-white/85">Compre um pacote para continuar. Sem mensalidade.</p>
      </div>
      <div className="space-y-4 p-5">
        <ul className="space-y-2">
          {BENEFICIOS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-fg2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
              {b}
            </li>
          ))}
        </ul>
        <PacotesIa pacotes={acesso.pacotes} emailVerificado={acesso.emailVerificado} />
      </div>
    </div>
  );
}
