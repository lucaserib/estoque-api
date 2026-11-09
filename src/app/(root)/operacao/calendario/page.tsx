"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, MouseSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { hojeEmTexto } from "@/modules/operacao/dominio/prazo";
import type { CartaoTarefa, PaginaTarefas } from "@/modules/operacao/tipos";
import { chamarOperacao, parametros } from "@/components/operacao/api";
import { EVENTO_TAREFAS_MUDARAM, abrirNovaTarefa, avisarTarefasMudaram } from "@/components/operacao/eventos";
import { ListaDeTarefas } from "@/components/operacao/ListaDeTarefas";
import { useOperacao } from "@/components/operacao/OperacaoContexto";
import { useAbrirTarefa } from "@/components/operacao/useAbrirTarefa";

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function dois(n: number) {
  return String(n).padStart(2, "0");
}

function diasDoMes(ano: number, mes: number): string[] {
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${ano}-${dois(mes)}-${dois(i + 1)}`);
}

function deslocamentoSegunda(ano: number, mes: number): number {
  const dia = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  return dia === 0 ? 6 : dia - 1;
}

const CLASSE_CHIP: Record<string, string> = {
  atrasada: "bg-destructive/10 text-destructive-text",
  hoje: "bg-warning/15 text-warning-text",
  concluida: "bg-success/10 text-success-text line-through",
};

function ChipCalendario({ tarefa, aoAbrir, arrastavel }: { tarefa: CartaoTarefa; aoAbrir: (id: string) => void; arrastavel: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id, disabled: !arrastavel });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => aoAbrir(tarefa.id)}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
        CLASSE_CHIP[tarefa.situacao] ?? "bg-primary/10 text-primary",
        isDragging && "relative z-10 shadow-lift"
      )}
      title={tarefa.titulo}
    >
      {tarefa.prazoHora ? `${tarefa.prazoHora} ` : ""}
      {tarefa.titulo}
    </button>
  );
}

function Dia({
  dia,
  tarefas,
  hoje,
  aoAbrir,
  podeEditar,
}: {
  dia: string;
  tarefas: CartaoTarefa[];
  hoje: boolean;
  aoAbrir: (id: string) => void;
  podeEditar: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dia });
  const visiveis = tarefas.slice(0, 4);
  return (
    <div ref={setNodeRef} className={cn("group flex min-h-[112px] flex-col gap-1 border-b border-r border-border p-1.5", isOver && "bg-primary/5")}>
      <div className="flex items-center justify-between">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums", hoje ? "bg-primary font-semibold text-primary-foreground" : "text-fg2")}>
          {Number(dia.slice(8))}
        </span>
        {podeEditar && (
          <button
            type="button"
            onClick={() => abrirNovaTarefa({ prazoData: dia })}
            aria-label={`Nova tarefa em ${dia.split("-").reverse().join("/")}`}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {visiveis.map((tarefa) => (
        <ChipCalendario key={tarefa.id} tarefa={tarefa} aoAbrir={aoAbrir} arrastavel={podeEditar && !tarefa.concluidaEm} />
      ))}
      {tarefas.length > visiveis.length && <span className="px-1 text-[11px] text-muted-foreground">+{tarefas.length - visiveis.length}</span>}
    </div>
  );
}

function Calendario() {
  const { inicio } = useOperacao();
  const { abrir } = useAbrirTarefa();
  const hoje = hojeEmTexto();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [somenteMinhas, setSomenteMinhas] = useState(false);
  const [tarefas, setTarefas] = useState<CartaoTarefa[] | null>(null);
  const [ano, numeroMes] = mes.split("-").map(Number);
  const dias = useMemo(() => diasDoMes(ano, numeroMes), [ano, numeroMes]);
  const podeEditar = Boolean(inicio?.usuario.podeEditar);

  const carregar = useCallback(async () => {
    try {
      const resposta = await chamarOperacao<PaginaTarefas>(
        `/tarefas${parametros({ situacao: "todas", de: dias[0], ate: dias[dias.length - 1], porPagina: 200, ordem: "prazo", escopo: somenteMinhas ? "minhas" : undefined })}`
      );
      setTarefas(resposta.itens);
    } catch {
      setTarefas((atual) => atual ?? []);
    }
  }, [dias, somenteMinhas]);

  useEffect(() => {
    carregar();
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
    return () => window.removeEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
  }, [carregar]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, CartaoTarefa[]>();
    for (const tarefa of tarefas ?? []) {
      if (!tarefa.prazoData) continue;
      mapa.set(tarefa.prazoData, [...(mapa.get(tarefa.prazoData) ?? []), tarefa]);
    }
    return mapa;
  }, [tarefas]);

  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));

  const aoSoltar = async (evento: DragEndEvent) => {
    const tarefa = tarefas?.find((t) => t.id === evento.active.id);
    const dia = evento.over?.id ? String(evento.over.id) : null;
    if (!tarefa || !dia || dia === tarefa.prazoData) return;
    setTarefas((atual) => atual?.map((t) => (t.id === tarefa.id ? { ...t, prazoData: dia } : t)) ?? null);
    try {
      await chamarOperacao(`/tarefas/${tarefa.id}`, { metodo: "PATCH", corpo: { prazo: { data: dia, hora: tarefa.prazoHora } } });
      toast.success(`Prazo de #${tarefa.numero} mudou para ${dia.split("-").reverse().slice(0, 2).join("/")}`);
      avisarTarefasMudaram();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mudar o prazo.");
      carregar();
    }
  };

  const mudarMes = (delta: number) => {
    const indice = ano * 12 + (numeroMes - 1) + delta;
    setMes(`${Math.floor(indice / 12)}-${dois((indice % 12) + 1)}`);
    setTarefas(null);
  };

  const diasDaAgenda = dias.filter((dia) => (porDia.get(dia)?.length ?? 0) > 0 && (mes !== hoje.slice(0, 7) || dia >= hoje));
  const atrasadasAntesDeHoje = mes === hoje.slice(0, 7) ? dias.filter((dia) => dia < hoje).flatMap((dia) => porDia.get(dia) ?? []).filter((t) => !t.concluidaEm) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9" onClick={() => mudarMes(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="min-w-[160px] text-base font-semibold capitalize">
          {MESES[numeroMes - 1]} de {ano}
        </h2>
        {mes !== hoje.slice(0, 7) && (
          <Button variant="ghost" className="h-10 sm:h-9" onClick={() => setMes(hoje.slice(0, 7))}>
            Hoje
          </Button>
        )}
        <label className="ml-auto flex h-10 items-center gap-2 text-sm text-fg2">
          <input type="checkbox" checked={somenteMinhas} onChange={(e) => setSomenteMinhas(e.target.checked)} className="h-4 w-4" />
          Só as minhas
        </label>
      </div>

      {tarefas === null ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card border-l border-t border-border bg-card md:block" data-testid="calendario-mes">
            <div className="grid grid-cols-7 border-b border-r border-border bg-muted/40">
              {SEMANA.map((nome) => (
                <div key={nome} className="px-2 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                  {nome}
                </div>
              ))}
            </div>
            <DndContext sensors={sensores} onDragEnd={aoSoltar}>
              <div className="grid grid-cols-7">
                {Array.from({ length: deslocamentoSegunda(ano, numeroMes) }, (_, i) => (
                  <div key={`vazio-${i}`} className="border-b border-r border-border bg-muted/20" />
                ))}
                {dias.map((dia) => (
                  <Dia key={dia} dia={dia} tarefas={porDia.get(dia) ?? []} hoje={dia === hoje} aoAbrir={abrir} podeEditar={podeEditar} />
                ))}
              </div>
            </DndContext>
          </div>

          <div className="space-y-5 md:hidden" data-testid="calendario-agenda">
            {atrasadasAntesDeHoje.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-destructive-text">Atrasadas deste mês</h3>
                <ListaDeTarefas tarefas={atrasadasAntesDeHoje} aoAbrir={abrir} aoMudar={carregar} />
              </section>
            )}
            {diasDaAgenda.length === 0 && atrasadasAntesDeHoje.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma tarefa com prazo neste mês.</p>
            )}
            {diasDaAgenda.map((dia) => {
              const data = new Date(`${dia}T12:00:00Z`);
              const rotulo = dia === hoje ? "Hoje" : new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long" }).format(data);
              return (
                <section key={dia} className="space-y-2">
                  <h3 className="flex items-baseline gap-2 text-sm font-semibold capitalize text-foreground">
                    {rotulo}
                    <span className="text-xs font-normal text-muted-foreground">{dia.split("-").reverse().slice(0, 2).join("/")}</span>
                  </h3>
                  <ListaDeTarefas tarefas={porDia.get(dia) ?? []} aoAbrir={abrir} aoMudar={carregar} />
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function CalendarioPage() {
  return (
    <Suspense fallback={null}>
      <Calendario />
    </Suspense>
  );
}
