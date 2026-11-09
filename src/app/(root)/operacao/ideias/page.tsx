"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArchiveRestore, Lightbulb, ListTodo, Lock, MoreHorizontal, Pencil, Pin, PinOff, Search, StickyNote, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CORES_OPERACAO, type CorOperacao } from "@/modules/operacao/dominio/esquemas";
import type { NotaDto } from "@/modules/operacao/tipos";
import { chamarOperacao, parametros } from "@/components/operacao/api";
import { CLASSES_COR, NOMES_COR } from "@/components/operacao/cores";
import { EVENTO_TAREFAS_MUDARAM, abrirNovaTarefa } from "@/components/operacao/eventos";
import { quandoRelativo } from "@/components/operacao/formato";
import { Folha } from "@/components/operacao/Folha";
import { useOperacao } from "@/components/operacao/OperacaoContexto";
import { AvatarPessoa } from "@/components/operacao/Pecas";

type Filtro = "todas" | "ideias" | "notas" | "minhas" | "arquivadas";

const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: "todas", rotulo: "Tudo" },
  { valor: "ideias", rotulo: "Ideias" },
  { valor: "notas", rotulo: "Notas" },
  { valor: "minhas", rotulo: "Só minhas" },
  { valor: "arquivadas", rotulo: "Arquivadas" },
];

interface Rascunho {
  id?: string;
  tipo: "NOTA" | "IDEIA";
  titulo: string;
  conteudo: string;
  cor: CorOperacao;
  visibilidade: "EQUIPE" | "PRIVADA";
  fixada: boolean;
}

const RASCUNHO_VAZIO: Rascunho = { tipo: "IDEIA", titulo: "", conteudo: "", cor: "amarelo", visibilidade: "EQUIPE", fixada: false };

function EditorNota({ rascunho, aoFechar, aoSalvar }: { rascunho: Rascunho | null; aoFechar: () => void; aoSalvar: (nota: NotaDto) => void }) {
  const [valor, setValor] = useState<Rascunho>(rascunho ?? RASCUNHO_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (rascunho) setValor(rascunho);
  }, [rascunho]);

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!valor.conteudo.trim()) return;
    setSalvando(true);
    try {
      const corpo = { tipo: valor.tipo, titulo: valor.titulo.trim() || null, conteudo: valor.conteudo.trim(), cor: valor.cor, visibilidade: valor.visibilidade, fixada: valor.fixada };
      const { nota } = valor.id
        ? await chamarOperacao<{ nota: NotaDto }>(`/notas/${valor.id}`, { metodo: "PATCH", corpo })
        : await chamarOperacao<{ nota: NotaDto }>("/notas", { corpo });
      aoSalvar(nota);
      aoFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Folha
      aberta={rascunho !== null}
      aoMudar={(aberta) => !aberta && aoFechar()}
      titulo={valor.id ? "Editar" : valor.tipo === "IDEIA" ? "Nova ideia" : "Nova nota"}
      largura="media"
      rodape={
        <Button type="submit" form="form-nota" className="h-11 w-full" disabled={salvando || !valor.conteudo.trim()} data-testid="salvar-nota">
          Salvar
        </Button>
      }
    >
      <form id="form-nota" onSubmit={salvar} className={cn("space-y-4 p-4 sm:p-5")}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
          {(["IDEIA", "NOTA"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="radio"
              aria-checked={valor.tipo === tipo}
              onClick={() => setValor({ ...valor, tipo })}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium",
                valor.tipo === tipo ? "border-primary bg-primary/10 text-primary" : "border-border text-fg2"
              )}
            >
              {tipo === "IDEIA" ? <Lightbulb className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
              {tipo === "IDEIA" ? "Ideia" : "Nota"}
            </button>
          ))}
        </div>
        <input
          value={valor.titulo}
          onChange={(e) => setValor({ ...valor, titulo: e.target.value })}
          placeholder="Título (opcional)"
          maxLength={120}
          aria-label="Título"
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base sm:text-sm"
        />
        <textarea
          value={valor.conteudo}
          onChange={(e) => setValor({ ...valor, conteudo: e.target.value })}
          placeholder={valor.tipo === "IDEIA" ? "Qual é a ideia? Ex.: kit com 3 unidades do borrifador" : "Anote: contatos, combinados, horários, links…"}
          rows={7}
          maxLength={5000}
          autoFocus
          aria-label="Conteúdo"
          className={cn("w-full rounded-lg border border-input px-3 py-2 text-base sm:text-sm", CLASSES_COR[valor.cor].nota)}
        />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor">
          {CORES_OPERACAO.map((corDisponivel) => (
            <button
              key={corDisponivel}
              type="button"
              role="radio"
              aria-checked={valor.cor === corDisponivel}
              aria-label={NOMES_COR[corDisponivel]}
              onClick={() => setValor({ ...valor, cor: corDisponivel })}
              className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2", valor.cor === corDisponivel ? "border-foreground" : "border-transparent")}
            >
              <span className={cn("h-6 w-6 rounded-full", CLASSES_COR[corDisponivel].ponto)} />
            </button>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-sm">
          <input
            type="checkbox"
            checked={valor.visibilidade === "PRIVADA"}
            onChange={(e) => setValor({ ...valor, visibilidade: e.target.checked ? "PRIVADA" : "EQUIPE" })}
            className="h-[18px] w-[18px]"
          />
          <span>
            <span className="font-medium">Só eu vejo</span>
            <span className="block text-xs text-muted-foreground">Nota privada: ninguém da equipe vê, nem o administrador.</span>
          </span>
        </label>
      </form>
    </Folha>
  );
}

function CartaoNota({
  nota,
  aoEditar,
  aoAtualizar,
  aoRemover,
}: {
  nota: NotaDto;
  aoEditar: (nota: NotaDto) => void;
  aoAtualizar: (nota: NotaDto) => void;
  aoRemover: (id: string) => void;
}) {
  const { inicio } = useOperacao();
  const podeEditarTarefas = Boolean(inicio?.usuario.podeEditar);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: nota.id, disabled: !podeEditarTarefas || nota.arquivada });

  const alterar = async (dados: Record<string, unknown>, mensagem?: string) => {
    try {
      const { nota: atualizada } = await chamarOperacao<{ nota: NotaDto }>(`/notas/${nota.id}`, { metodo: "PATCH", corpo: dados });
      if (dados.arquivada !== undefined) aoRemover(nota.id);
      else aoAtualizar(atualizada);
      if (mensagem) toast.success(mensagem);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar.");
    }
  };

  const apoiar = async () => {
    try {
      const { nota: atualizada } = await chamarOperacao<{ nota: NotaDto }>(`/notas/${nota.id}/apoiar`, { corpo: {} });
      aoAtualizar(atualizada);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apoiar.");
    }
  };

  const apagar = async () => {
    if (!window.confirm("Apagar de vez esta nota?")) return;
    try {
      await chamarOperacao(`/notas/${nota.id}`, { metodo: "DELETE" });
      aoRemover(nota.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar.");
    }
  };

  const virarTarefa = () => {
    const primeiraLinha = nota.titulo || nota.conteudo.split("\n")[0];
    abrirNovaTarefa({
      titulo: primeiraLinha.slice(0, 200),
      descricao: nota.titulo ? nota.conteudo : nota.conteudo.split("\n").slice(1).join("\n") || null,
      notaId: nota.id,
    });
  };

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="group"
      aria-roledescription="nota arrastável"
      data-testid="nota"
      className={cn(
        "group flex touch-manipulation flex-col gap-2 rounded-2xl border p-3.5 shadow-card",
        CLASSES_COR[nota.cor].nota,
        CLASSES_COR[nota.cor].borda,
        isDragging && "opacity-50"
      )}
    >
      <header className="flex items-start gap-2">
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-muted-foreground">
          {nota.tipo === "IDEIA" ? <Lightbulb className="h-4 w-4 text-amber-500" aria-label="Ideia" /> : <StickyNote className="h-4 w-4" aria-label="Nota" />}
          {nota.visibilidade === "PRIVADA" && <Lock className="h-3.5 w-3.5" aria-label="Privada" />}
          {nota.fixada && <Pin className="h-3.5 w-3.5 text-primary" aria-label="Fixada" />}
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{nota.titulo}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="-m-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Ações da nota"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {podeEditarTarefas && !nota.tarefa && !nota.arquivada && (
              <DropdownMenuItem className="min-h-10 gap-2" onSelect={virarTarefa}>
                <ListTodo className="h-4 w-4" />
                Virar tarefa
              </DropdownMenuItem>
            )}
            {nota.podeEditar && !nota.arquivada && (
              <>
                <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => aoEditar(nota)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => alterar({ fixada: !nota.fixada })}>
                  {nota.fixada ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {nota.fixada ? "Desafixar" : "Fixar no topo"}
                </DropdownMenuItem>
              </>
            )}
            {nota.podeEditar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => alterar({ arquivada: !nota.arquivada }, nota.arquivada ? "Nota restaurada" : "Nota arquivada")}>
                  {nota.arquivada ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {nota.arquivada ? "Restaurar" : "Arquivar"}
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-10 gap-2 text-destructive-text" onSelect={apagar}>
                  <Trash2 className="h-4 w-4" />
                  Apagar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <p className="line-clamp-[10] whitespace-pre-wrap break-words text-sm text-foreground/90">{nota.conteudo}</p>
      {nota.tarefa && (
        <Link
          href={`/operacao?tarefa=${nota.tarefa.id}`}
          className="inline-flex items-center gap-1 self-start rounded-full bg-background/70 px-2 py-0.5 text-xs font-medium text-primary hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ListTodo className="h-3.5 w-3.5" />
          Virou a tarefa #{nota.tarefa.numero}
        </Link>
      )}
      <footer className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
        <AvatarPessoa pessoa={nota.autor} tamanho={20} />
        <span className="min-w-0 flex-1 truncate">
          {nota.autor?.nome ?? "Alguém"} · {quandoRelativo(nota.atualizadaEm)}
        </span>
        {nota.tipo === "IDEIA" && nota.visibilidade === "EQUIPE" && !nota.arquivada && (
          <button
            type="button"
            onClick={apoiar}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={!podeEditarTarefas}
            aria-pressed={nota.apoiadaPorMim}
            aria-label={nota.apoiadaPorMim ? "Tirar apoio" : "Apoiar ideia"}
            className={cn(
              "flex h-9 items-center gap-1 rounded-full px-2.5 font-medium",
              nota.apoiadaPorMim ? "bg-primary text-primary-foreground" : "bg-background/70 text-fg2 hover:text-foreground"
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {nota.apoios}
          </button>
        )}
      </footer>
    </article>
  );
}

function Mural() {
  const { inicio } = useOperacao();
  const parametrosUrl = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [notas, setNotas] = useState<NotaDto[] | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  useEffect(() => {
    if (parametrosUrl.get("nova") !== "1") return;
    setRascunho(RASCUNHO_VAZIO);
    router.replace(pathname, { scroll: false });
  }, [parametrosUrl, pathname, router]);

  const consulta = useMemo(
    () =>
      parametros({
        tipo: filtro === "ideias" ? "IDEIA" : filtro === "notas" ? "NOTA" : undefined,
        visibilidade: filtro === "minhas" ? "PRIVADA" : undefined,
        arquivadas: filtro === "arquivadas",
        busca: busca.trim() || undefined,
      }),
    [filtro, busca]
  );

  const carregar = useCallback(async () => {
    try {
      const resposta = await chamarOperacao<{ notas: NotaDto[] }>(`/notas${consulta}`);
      setNotas(resposta.notas);
    } catch {
      setNotas((atual) => atual ?? []);
    }
  }, [consulta]);

  useEffect(() => {
    const espera = setTimeout(carregar, busca ? 300 : 0);
    return () => clearTimeout(espera);
  }, [carregar, busca]);

  useEffect(() => {
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
    return () => window.removeEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
  }, [carregar]);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fixadas = (notas ?? []).filter((n) => n.fixada);
  const demais = (notas ?? []).filter((n) => !n.fixada);

  const aoSoltar = (grupo: NotaDto[]) => async (evento: DragEndEvent) => {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const de = grupo.findIndex((n) => n.id === active.id);
    const para = grupo.findIndex((n) => n.id === over.id);
    if (de < 0 || para < 0) return;
    const reordenado = arrayMove(grupo, de, para);
    setNotas((atual) => {
      if (!atual) return atual;
      const outros = atual.filter((n) => !grupo.some((g) => g.id === n.id));
      return grupo[0]?.fixada ? [...reordenado, ...outros] : [...outros, ...reordenado];
    });
    try {
      await chamarOperacao(`/notas/${active.id}/mover`, {
        corpo: { anteriorId: reordenado[para - 1]?.id ?? null, seguinteId: reordenado[para + 1]?.id ?? null },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reordenar.");
      carregar();
    }
  };

  const atualizar = (nota: NotaDto) => setNotas((atual) => atual?.map((n) => (n.id === nota.id ? nota : n)) ?? null);
  const remover = (id: string) => setNotas((atual) => atual?.filter((n) => n.id !== id) ?? null);
  const editar = (nota: NotaDto) =>
    setRascunho({ id: nota.id, tipo: nota.tipo, titulo: nota.titulo ?? "", conteudo: nota.conteudo, cor: nota.cor, visibilidade: nota.visibilidade, fixada: nota.fixada });

  const grade = (grupo: NotaDto[]) => (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar(grupo)}>
      <SortableContext items={grupo.map((n) => n.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grupo.map((nota) => (
            <CartaoNota key={nota.id} nota={nota} aoEditar={editar} aoAtualizar={atualizar} aoRemover={remover} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {inicio?.usuario.podeEditar && (
          <div className="hidden gap-2 md:flex">
            <Button className="h-9 gap-1.5" onClick={() => setRascunho({ ...RASCUNHO_VAZIO, tipo: "IDEIA" })} data-testid="nova-ideia">
              <Lightbulb className="h-4 w-4" />
              Nova ideia
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setRascunho({ ...RASCUNHO_VAZIO, tipo: "NOTA", cor: "azul" })}>
              <StickyNote className="h-4 w-4" />
              Nova nota
            </Button>
          </div>
        )}
        <div className="relative min-w-0 flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nas notas"
            aria-label="Buscar nas notas"
            className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm sm:h-9"
          />
        </div>
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filtrar notas">
        {FILTROS.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            role="tab"
            aria-selected={filtro === opcao.valor}
            onClick={() => {
              setFiltro(opcao.valor);
              setNotas(null);
            }}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm",
              filtro === opcao.valor ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-fg2"
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      {notas === null ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : notas.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-8 text-center">
          <Lightbulb className="mx-auto h-6 w-6 text-amber-500" />
          <p className="mt-2 font-semibold">Nenhuma nota aqui</p>
          <p className="mt-1 text-sm text-muted-foreground">Ideias de produto, combinados com fornecedor, horários da transportadora… tudo que a equipe precisa lembrar.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {fixadas.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Pin className="h-3.5 w-3.5" />
                Fixadas
              </h2>
              {grade(fixadas)}
            </section>
          )}
          {demais.length > 0 && grade(demais)}
        </div>
      )}

      {inicio?.usuario.podeEditar && (
        <FloatingActionButton label="Nova ideia ou nota" onClick={() => setRascunho({ ...RASCUNHO_VAZIO })} />
      )}
      <EditorNota
        rascunho={rascunho}
        aoFechar={() => setRascunho(null)}
        aoSalvar={(nota) => {
          setNotas((atual) => {
            if (!atual) return [nota];
            return atual.some((n) => n.id === nota.id) ? atual.map((n) => (n.id === nota.id ? nota : n)) : [nota, ...atual];
          });
          toast.success(rascunho?.id ? "Nota salva" : nota.tipo === "IDEIA" ? "Ideia anotada" : "Nota salva");
        }}
      />
    </div>
  );
}

export default function IdeiasPage() {
  return (
    <Suspense fallback={null}>
      <Mural />
    </Suspense>
  );
}
