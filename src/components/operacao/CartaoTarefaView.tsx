"use client";

import { forwardRef } from "react";
import { CheckSquare, Link2, MessageSquare, MoreHorizontal } from "lucide-react";
import type { PapelColunaTarefa } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CartaoTarefa } from "@/modules/operacao/tipos";
import { AvatarPessoa, ChipEtiqueta, IconePrioridade, PrazoTarefa } from "./Pecas";

export interface ColunaDestino {
  id: string;
  nome: string;
  papel: PapelColunaTarefa;
}

interface CartaoTarefaViewProps extends React.HTMLAttributes<HTMLDivElement> {
  tarefa: CartaoTarefa;
  aoAbrir: (id: string) => void;
  aoConcluir?: (tarefa: CartaoTarefa, concluir: boolean) => void;
  colunas?: ColunaDestino[];
  aoMoverPara?: (tarefa: CartaoTarefa, colunaId: string) => void;
  podeEditar?: boolean;
  mostrarQuadro?: string | null;
  arrastando?: boolean;
  fantasma?: boolean;
}

const BORDA_PRIORIDADE = {
  URGENTE: "border-l-destructive",
  ALTA: "border-l-warning",
  MEDIA: "border-l-border",
  BAIXA: "border-l-border",
} as const;

export const CartaoTarefaView = forwardRef<HTMLDivElement, CartaoTarefaViewProps>(function CartaoTarefaView(
  { tarefa, aoAbrir, aoConcluir, colunas, aoMoverPara, podeEditar = false, mostrarQuadro, arrastando, fantasma, className, ...resto },
  ref
) {
  const concluida = Boolean(tarefa.concluidaEm);
  const etiquetasVisiveis = tarefa.etiquetas.slice(0, 3);
  const extras = tarefa.etiquetas.length - etiquetasVisiveis.length;

  return (
    <div
      ref={ref}
      {...resto}
      data-testid="cartao-tarefa"
      data-tarefa-id={tarefa.id}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-l-[3px] border-border/80 bg-card p-3 text-left shadow-card transition-shadow",
        BORDA_PRIORIDADE[tarefa.prioridade],
        arrastando && "rotate-[1.5deg] shadow-lift ring-2 ring-primary/40",
        fantasma && "opacity-40",
        concluida && "bg-card/70",
        className
      )}
    >
      <div className="flex items-start gap-2">
        {aoConcluir && (
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              aoConcluir(tarefa, !concluida);
            }}
            disabled={!podeEditar}
            aria-label={concluida ? `Reabrir ${tarefa.titulo}` : `Concluir ${tarefa.titulo}`}
            className={cn(
              "-m-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-50",
              "hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex h-[18px] w-[18px] items-center justify-center rounded-full border-2",
                concluida ? "border-success bg-success text-white" : "border-border"
              )}
            >
              {concluida && (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
                  <path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => aoAbrir(tarefa.id)}
          className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          <span className="mb-1 flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-medium tabular-nums text-faint">#{tarefa.numero}</span>
            {mostrarQuadro && <span className="truncate text-[11px] text-faint">· {mostrarQuadro}</span>}
            {etiquetasVisiveis.map((etiqueta) => (
              <ChipEtiqueta key={etiqueta.id} etiqueta={etiqueta} />
            ))}
            {extras > 0 && <span className="text-[11px] text-muted-foreground">+{extras}</span>}
          </span>
          <span className={cn("line-clamp-3 block text-sm font-medium leading-snug text-foreground", concluida && "text-muted-foreground line-through")}>
            {tarefa.titulo}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <PrazoTarefa data={tarefa.prazoData} hora={tarefa.prazoHora} situacao={tarefa.situacao} recorrente={tarefa.recorrente} />
            {tarefa.checklist.total > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs tabular-nums",
                  tarefa.checklist.feitos === tarefa.checklist.total ? "text-success-text" : "text-muted-foreground"
                )}
              >
                <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                {tarefa.checklist.feitos}/{tarefa.checklist.total}
              </span>
            )}
            {tarefa.comentarios > 0 && (
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                {tarefa.comentarios}
              </span>
            )}
            {tarefa.vinculo && (
              <span className="inline-flex max-w-[140px] items-center gap-1 truncate text-xs text-muted-foreground" title={tarefa.vinculo.rotulo}>
                <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{tarefa.vinculo.rotulo}</span>
              </span>
            )}
            <IconePrioridade prioridade={tarefa.prioridade} />
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <AvatarPessoa pessoa={tarefa.responsavel} />
          {podeEditar && colunas && aoMoverPara && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-[state=open]:opacity-100"
                aria-label={`Mover ${tarefa.titulo}`}
                onPointerDown={(evento) => evento.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Mover para</DropdownMenuLabel>
                {colunas.map((coluna) => (
                  <DropdownMenuItem
                    key={coluna.id}
                    disabled={coluna.id === tarefa.colunaId}
                    onSelect={() => aoMoverPara(tarefa, coluna.id)}
                    className="min-h-10"
                  >
                    {coluna.nome}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => aoAbrir(tarefa.id)} className="min-h-10">
                  Abrir detalhes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
});
