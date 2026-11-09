"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CartaoTarefa, ColunaComTarefas, QuadroCompleto } from "@/modules/operacao/tipos";
import { chamarOperacao, parametros } from "./api";
import { CapturaRapida } from "./CapturaRapida";
import { CartaoTarefaView, type ColunaDestino } from "./CartaoTarefaView";
import { EVENTO_TAREFAS_MUDARAM, avisarTarefasMudaram } from "./eventos";
import type { ValorFiltros } from "./FiltrosTarefas";
import { useOperacao } from "./OperacaoContexto";

const INTERVALO_ATUALIZACAO_MS = 20_000;

interface RespostaMover {
  tarefa: CartaoTarefa;
  proxima: CartaoTarefa | null;
  aviso: string | null;
}

function CartaoArrastavel({
  tarefa,
  podeEditar,
  colunas,
  aoAbrir,
  aoMoverPara,
}: {
  tarefa: CartaoTarefa;
  podeEditar: boolean;
  colunas: ColunaDestino[];
  aoAbrir: (id: string) => void;
  aoMoverPara: (tarefa: CartaoTarefa, colunaId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
    data: { tipo: "tarefa" },
    disabled: !podeEditar,
  });
  return (
    <CartaoTarefaView
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="group"
      aria-roledescription="cartão arrastável"
      tarefa={tarefa}
      aoAbrir={aoAbrir}
      podeEditar={podeEditar}
      colunas={colunas}
      aoMoverPara={aoMoverPara}
      fantasma={isDragging}
      className="touch-manipulation"
    />
  );
}

function Coluna({
  coluna,
  podeEditar,
  colunasDestino,
  aoAbrir,
  aoMoverPara,
  aoCriar,
  registrar,
}: {
  coluna: ColunaComTarefas;
  podeEditar: boolean;
  colunasDestino: ColunaDestino[];
  aoAbrir: (id: string) => void;
  aoMoverPara: (tarefa: CartaoTarefa, colunaId: string) => void;
  aoCriar: (tarefa: CartaoTarefa) => void;
  registrar: (id: string, elemento: HTMLElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id, data: { tipo: "coluna" } });
  const [adicionando, setAdicionando] = useState(false);
  const acimaDoLimite = coluna.limite !== null && coluna.tarefas.length > coluna.limite;

  return (
    <section
      ref={(elemento) => registrar(coluna.id, elemento)}
      data-coluna-id={coluna.id}
      aria-label={`Coluna ${coluna.nome}`}
      className="flex w-[86vw] max-w-[340px] shrink-0 snap-start flex-col rounded-2xl bg-muted/50 sm:w-[300px]"
    >
      <header className="flex items-center gap-2 px-3 pb-1 pt-3">
        {coluna.papel === "CONCLUIDA" && <CheckCircle2 className="h-4 w-4 text-success-text" aria-hidden="true" />}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{coluna.nome}</h2>
        <span
          className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", acimaDoLimite ? "bg-warning/20 text-warning-text" : "bg-background text-fg2")}
          title={coluna.limite ? `Limite de ${coluna.limite}` : undefined}
        >
          {coluna.tarefas.length}
          {coluna.limite ? `/${coluna.limite}` : ""}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 pt-1 transition-colors",
          "max-h-[calc(100dvh-300px)] sm:max-h-[calc(100dvh-250px)]",
          isOver && "rounded-xl bg-primary/5"
        )}
      >
        <SortableContext items={coluna.tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {coluna.tarefas.map((tarefa) => (
            <CartaoArrastavel
              key={tarefa.id}
              tarefa={tarefa}
              podeEditar={podeEditar}
              colunas={colunasDestino}
              aoAbrir={aoAbrir}
              aoMoverPara={aoMoverPara}
            />
          ))}
        </SortableContext>
        {coluna.tarefas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {coluna.papel === "CONCLUIDA" ? "Arraste para cá o que ficou pronto." : "Nada por aqui."}
          </p>
        )}
        {coluna.ocultas > 0 && (
          <p className="px-1 text-center text-[11px] text-muted-foreground">
            +{coluna.ocultas} {coluna.ocultas === 1 ? "concluída há mais tempo" : "concluídas há mais tempo"} (veja na Lista)
          </p>
        )}
      </div>
      {podeEditar && coluna.papel !== "CONCLUIDA" && (
        <div className="px-2 pb-2">
          {adicionando ? (
            <div className="space-y-1">
              <CapturaRapida
                colunaId={coluna.id}
                compacta
                autoFocus
                placeholder="Título… (@pessoa #etiqueta amanhã)"
                aoCriar={(tarefa) => {
                  aoCriar(tarefa);
                }}
              />
              <button type="button" onClick={() => setAdicionando(false)} className="h-9 w-full rounded-lg text-xs text-muted-foreground hover:bg-background">
                Fechar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdicionando(true)}
              className="flex h-10 w-full items-center gap-1.5 rounded-lg px-2 text-sm text-fg2 hover:bg-background hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar tarefa
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function QuadroKanban({
  quadroId,
  filtros,
  mostrarConcluidas,
  aoAbrir,
}: {
  quadroId: string;
  filtros: ValorFiltros;
  mostrarConcluidas: boolean;
  aoAbrir: (id: string) => void;
}) {
  const { inicio } = useOperacao();
  const podeEditar = Boolean(inicio?.usuario.podeEditar);
  const [dados, setDados] = useState<QuadroCompleto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ativa, setAtiva] = useState<CartaoTarefa | null>(null);
  const [colunaVisivel, setColunaVisivel] = useState<string | null>(null);
  const arrastando = useRef(false);
  const instantaneo = useRef<ColunaComTarefas[] | null>(null);
  const elementos = useRef(new Map<string, HTMLElement>());
  const rolagem = useRef<HTMLDivElement>(null);

  const consulta = useMemo(
    () =>
      parametros({
        busca: filtros.busca.trim() || undefined,
        responsavelId: filtros.responsavelId || undefined,
        etiquetaId: filtros.etiquetaId || undefined,
        prioridade: filtros.prioridade || undefined,
        situacao: filtros.situacao || undefined,
        mostrarConcluidas,
      }),
    [filtros, mostrarConcluidas]
  );

  const carregar = useCallback(async () => {
    if (arrastando.current) return;
    try {
      const resposta = await chamarOperacao<QuadroCompleto>(`/quadros/${quadroId}${consulta}`);
      if (!arrastando.current) setDados(resposta);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o quadro.");
    }
  }, [quadroId, consulta]);

  useEffect(() => {
    const espera = setTimeout(carregar, filtros.busca ? 300 : 0);
    return () => clearTimeout(espera);
  }, [carregar, filtros.busca]);

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, INTERVALO_ATUALIZACAO_MS);
    const aoFocar = () => carregar();
    window.addEventListener("focus", aoFocar);
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, aoFocar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("focus", aoFocar);
      window.removeEventListener(EVENTO_TAREFAS_MUDARAM, aoFocar);
    };
  }, [carregar]);

  useEffect(() => {
    const raiz = rolagem.current;
    if (!raiz || !dados) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visivel?.target.getAttribute("data-coluna-id");
        if (id) setColunaVisivel(id);
      },
      { root: raiz, threshold: [0.55, 0.8] }
    );
    elementos.current.forEach((elemento) => observador.observe(elemento));
    return () => observador.disconnect();
  }, [dados]);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const colunas = useMemo(() => dados?.colunas ?? [], [dados]);
  const colunasDestino = useMemo<ColunaDestino[]>(() => colunas.map((c) => ({ id: c.id, nome: c.nome, papel: c.papel })), [colunas]);

  const colunaDe = (lista: ColunaComTarefas[], id: string) =>
    lista.find((c) => c.id === id) ?? lista.find((c) => c.tarefas.some((t) => t.id === id));

  const aplicarResposta = (resposta: RespostaMover) => {
    setDados((atual) => {
      if (!atual) return atual;
      return {
        ...atual,
        colunas: atual.colunas.map((coluna) => {
          let tarefas = coluna.tarefas.map((t) => (t.id === resposta.tarefa.id ? { ...resposta.tarefa, posicao: t.posicao } : t));
          if (resposta.proxima && coluna.id === resposta.proxima.colunaId && !tarefas.some((t) => t.id === resposta.proxima!.id)) {
            tarefas = [...tarefas, resposta.proxima];
          }
          return { ...coluna, tarefas };
        }),
      };
    });
    if (resposta.proxima) toast.success(`Rotina: a próxima (#${resposta.proxima.numero}) já está em ${colunasDestino.find((c) => c.id === resposta.proxima!.colunaId)?.nome ?? "a fazer"}.`);
    if (resposta.aviso) toast.warning(resposta.aviso);
  };

  const enviarMovimento = async (tarefaId: string, colunaId: string, lista: ColunaComTarefas[]) => {
    const coluna = lista.find((c) => c.id === colunaId);
    const indice = coluna?.tarefas.findIndex((t) => t.id === tarefaId) ?? -1;
    if (!coluna || indice < 0) return;
    try {
      const resposta = await chamarOperacao<RespostaMover>(`/tarefas/${tarefaId}/mover`, {
        corpo: { colunaId, anteriorId: coluna.tarefas[indice - 1]?.id ?? null, seguinteId: coluna.tarefas[indice + 1]?.id ?? null },
      });
      aplicarResposta(resposta);
      avisarTarefasMudaram();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mover a tarefa.");
      if (instantaneo.current) setDados((atual) => (atual ? { ...atual, colunas: instantaneo.current! } : atual));
      carregar();
    }
  };

  const moverPara = (tarefa: CartaoTarefa, colunaId: string) => {
    if (!dados) return;
    instantaneo.current = dados.colunas;
    const lista = dados.colunas.map((coluna) => {
      if (coluna.id === tarefa.colunaId) return { ...coluna, tarefas: coluna.tarefas.filter((t) => t.id !== tarefa.id) };
      if (coluna.id === colunaId) return { ...coluna, tarefas: [{ ...tarefa, colunaId }, ...coluna.tarefas] };
      return coluna;
    });
    setDados({ ...dados, colunas: lista });
    enviarMovimento(tarefa.id, colunaId, lista);
  };

  const aoIniciar = (evento: DragStartEvent) => {
    arrastando.current = true;
    instantaneo.current = dados?.colunas ?? null;
    const coluna = colunaDe(colunas, String(evento.active.id));
    setAtiva(coluna?.tarefas.find((t) => t.id === evento.active.id) ?? null);
  };

  const aoPassar = (evento: DragOverEvent) => {
    const { active, over } = evento;
    if (!over) return;
    setDados((atual) => {
      if (!atual) return atual;
      const de = colunaDe(atual.colunas, String(active.id));
      const para = colunaDe(atual.colunas, String(over.id));
      if (!de || !para || de.id === para.id) return atual;
      const tarefa = de.tarefas.find((t) => t.id === active.id);
      if (!tarefa) return atual;
      const indiceSobre = para.tarefas.findIndex((t) => t.id === over.id);
      const destino = indiceSobre >= 0 ? indiceSobre : para.tarefas.length;
      return {
        ...atual,
        colunas: atual.colunas.map((coluna) => {
          if (coluna.id === de.id) return { ...coluna, tarefas: coluna.tarefas.filter((t) => t.id !== active.id) };
          if (coluna.id === para.id) {
            const tarefas = [...coluna.tarefas];
            tarefas.splice(destino, 0, { ...tarefa, colunaId: para.id });
            return { ...coluna, tarefas };
          }
          return coluna;
        }),
      };
    });
  };

  const aoSoltar = (evento: DragEndEvent) => {
    const { active, over } = evento;
    const id = String(active.id);
    setAtiva(null);
    arrastando.current = false;
    if (!over || !dados) {
      if (instantaneo.current) setDados((atual) => (atual ? { ...atual, colunas: instantaneo.current! } : atual));
      return;
    }
    const coluna = colunaDe(dados.colunas, id);
    if (!coluna) return;
    const indiceAtual = coluna.tarefas.findIndex((t) => t.id === id);
    const indiceAlvo = over.id === coluna.id ? indiceAtual : coluna.tarefas.findIndex((t) => t.id === over.id);
    const tarefas = indiceAlvo >= 0 && indiceAlvo !== indiceAtual ? arrayMove(coluna.tarefas, indiceAtual, indiceAlvo) : coluna.tarefas;
    const lista = dados.colunas.map((c) => (c.id === coluna.id ? { ...c, tarefas } : c));
    const original = instantaneo.current?.find((c) => c.tarefas.some((t) => t.id === id));
    const mesmaPosicao = original?.id === coluna.id && original.tarefas.findIndex((t) => t.id === id) === tarefas.findIndex((t) => t.id === id);
    setDados({ ...dados, colunas: lista });
    if (!mesmaPosicao) enviarMovimento(id, coluna.id, lista);
  };

  const aoCriarNaColuna = (tarefa: CartaoTarefa) => {
    setDados((atual) =>
      atual
        ? {
            ...atual,
            colunas: atual.colunas.map((c) =>
              c.id === tarefa.colunaId && !c.tarefas.some((t) => t.id === tarefa.id) ? { ...c, tarefas: [...c.tarefas, tarefa] } : c
            ),
          }
        : atual
    );
  };

  const registrar = useCallback((id: string, elemento: HTMLElement | null) => {
    if (elemento) elementos.current.set(id, elemento);
    else elementos.current.delete(id);
  }, []);

  if (erro && !dados) return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive-text">{erro}</p>;
  if (!dados) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-80 w-[86vw] max-w-[340px] shrink-0 rounded-2xl sm:w-[300px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:hidden" aria-label="Colunas do quadro">
        {colunas.map((coluna) => (
          <button
            key={coluna.id}
            type="button"
            onClick={() => elementos.current.get(coluna.id)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })}
            aria-current={colunaVisivel === coluna.id ? "true" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
              colunaVisivel === coluna.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-fg2"
            )}
          >
            {coluna.nome}
            <span className="tabular-nums opacity-70">{coluna.tarefas.length}</span>
          </button>
        ))}
      </nav>
      <DndContext sensors={sensores} collisionDetection={closestCorners} onDragStart={aoIniciar} onDragOver={aoPassar} onDragEnd={aoSoltar} onDragCancel={() => {
        setAtiva(null);
        arrastando.current = false;
        if (instantaneo.current) setDados((atual) => (atual ? { ...atual, colunas: instantaneo.current! } : atual));
      }}>
        <div
          ref={rolagem}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:snap-none sm:px-0"
          style={{ scrollPaddingLeft: "1rem" }}
          data-testid="quadro-kanban"
        >
          {colunas.map((coluna) => (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              podeEditar={podeEditar}
              colunasDestino={colunasDestino}
              aoAbrir={aoAbrir}
              aoMoverPara={moverPara}
              aoCriar={aoCriarNaColuna}
              registrar={registrar}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {ativa ? <CartaoTarefaView tarefa={ativa} aoAbrir={() => undefined} arrastando className="w-[280px]" /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
