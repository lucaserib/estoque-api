"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, KanbanSquare } from "lucide-react";
import type { CartaoTarefa, PaginaTarefas, ResumoOperacao } from "@/modules/operacao/tipos";
import { cn } from "@/lib/utils";
import { chamarOperacao, parametros } from "./api";
import { rotuloPrazo, classeSituacao } from "./formato";

export function CartaoMinhasTarefas({ className }: { className?: string }) {
  const [resumo, setResumo] = useState<ResumoOperacao | null>(null);
  const [proximas, setProximas] = useState<CartaoTarefa[]>([]);

  useEffect(() => {
    Promise.all([
      chamarOperacao<ResumoOperacao>("/resumo"),
      chamarOperacao<PaginaTarefas>(`/tarefas${parametros({ escopo: "minhas", situacao: "abertas", ordem: "prazo", porPagina: 3 })}`),
    ])
      .then(([dados, pagina]) => {
        setResumo(dados);
        setProximas(pagina.itens.filter((t) => t.prazo));
      })
      .catch(() => setResumo(null));
  }, []);

  if (!resumo) return null;
  const { atrasadas, hoje } = resumo.minhas;
  if (atrasadas + hoje === 0 && proximas.length === 0) return null;

  return (
    <section
      className={cn("rounded-card border border-border/80 bg-card p-4 shadow-card", className)}
      aria-label="Minhas tarefas"
      data-testid="cartao-minhas-tarefas"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KanbanSquare className="h-4 w-4 text-primary" />
          Minhas tarefas
        </h2>
        {atrasadas > 0 && (
          <span className="flex items-center gap-1 text-sm font-medium text-destructive-text">
            <AlertTriangle className="h-4 w-4" />
            {atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"}
          </span>
        )}
        {hoje > 0 && (
          <span className="flex items-center gap-1 text-sm font-medium text-warning-text">
            <CalendarClock className="h-4 w-4" />
            {hoje} para hoje
          </span>
        )}
        <Link href="/operacao" className="ml-auto inline-flex h-9 items-center gap-1 text-sm font-medium text-primary hover:underline">
          Abrir meu dia
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {proximas.length > 0 && (
        <ul className="mt-3 divide-y divide-divider">
          {proximas.map((tarefa) => (
            <li key={tarefa.id}>
              <Link href={`/operacao?tarefa=${tarefa.id}`} className="flex min-h-11 items-center gap-3 py-2 hover:text-primary">
                <span className="text-xs tabular-nums text-faint">#{tarefa.numero}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{tarefa.titulo}</span>
                <span className={cn("shrink-0 text-xs tabular-nums", classeSituacao(tarefa.situacao))}>
                  {rotuloPrazo(tarefa.prazoData, tarefa.prazoHora, tarefa.situacao)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
