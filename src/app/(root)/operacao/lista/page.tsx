"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { CartaoTarefa, PaginaTarefas } from "@/modules/operacao/tipos";
import { chamarOperacao, parametros } from "@/components/operacao/api";
import { EVENTO_TAREFAS_MUDARAM } from "@/components/operacao/eventos";
import { FILTROS_VAZIOS, FiltrosTarefas, type OpcaoSituacao, type ValorFiltros } from "@/components/operacao/FiltrosTarefas";
import { ListaDeTarefas } from "@/components/operacao/ListaDeTarefas";
import { useOperacao } from "@/components/operacao/OperacaoContexto";
import { useAbrirTarefa } from "@/components/operacao/useAbrirTarefa";

const SITUACOES: OpcaoSituacao[] = [
  { valor: "abertas", rotulo: "Abertas" },
  { valor: "atrasadas", rotulo: "Atrasadas" },
  { valor: "hoje", rotulo: "Vencem hoje" },
  { valor: "semana", rotulo: "Próximos 7 dias" },
  { valor: "sem-prazo", rotulo: "Sem prazo" },
  { valor: "concluidas", rotulo: "Concluídas" },
  { valor: "arquivadas", rotulo: "Arquivadas" },
  { valor: "todas", rotulo: "Todas (menos arquivadas)" },
];

const ORDENS = [
  { valor: "prazo", rotulo: "Prazo" },
  { valor: "prioridade", rotulo: "Prioridade" },
  { valor: "criacao", rotulo: "Mais novas" },
  { valor: "atualizacao", rotulo: "Mexidas por último" },
  { valor: "conclusao", rotulo: "Concluídas por último" },
];

const POR_PAGINA = 40;

function Lista() {
  const parametrosUrl = useSearchParams();
  const { inicio } = useOperacao();
  const { abrir } = useAbrirTarefa();
  const [filtros, setFiltros] = useState<ValorFiltros>(() => ({
    ...FILTROS_VAZIOS,
    responsavelId: parametrosUrl.get("responsavel") ?? "",
    situacao: parametrosUrl.get("situacao") ?? "abertas",
  }));
  const [ordem, setOrdem] = useState("prazo");
  const [quadroId, setQuadroId] = useState("");
  const [itens, setItens] = useState<CartaoTarefa[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const consulta = useMemo(
    () => ({
      busca: filtros.busca.trim() || undefined,
      responsavelId: filtros.responsavelId || undefined,
      etiquetaId: filtros.etiquetaId || undefined,
      prioridade: filtros.prioridade || undefined,
      situacao: filtros.situacao || "abertas",
      quadroId: quadroId || undefined,
      ordem: filtros.situacao === "concluidas" && ordem === "prazo" ? "conclusao" : ordem,
      porPagina: POR_PAGINA,
    }),
    [filtros, ordem, quadroId]
  );

  const carregar = useCallback(async () => {
    try {
      const resposta = await chamarOperacao<PaginaTarefas>(`/tarefas${parametros({ ...consulta, pagina: 1, porPagina: Math.min(200, POR_PAGINA * pagina) })}`);
      setItens(resposta.itens);
      setTotal(resposta.total);
    } catch {
      setItens((atual) => atual ?? []);
    }
  }, [consulta, pagina]);

  useEffect(() => {
    const espera = setTimeout(carregar, filtros.busca ? 300 : 0);
    return () => clearTimeout(espera);
  }, [carregar, filtros.busca]);

  useEffect(() => {
    setPagina(1);
  }, [consulta]);

  useEffect(() => {
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
    return () => window.removeEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
  }, [carregar]);

  useEffect(() => {
    setCarregandoMais(false);
  }, [itens]);

  const carregarMais = () => {
    setCarregandoMais(true);
    setPagina((p) => p + 1);
  };

  const campo = "h-10 rounded-lg border border-input bg-background px-2.5 text-sm sm:h-9";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FiltrosTarefas valor={filtros} aoMudar={setFiltros} situacoes={SITUACOES} />
        <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar por" className={campo}>
          {ORDENS.map((o) => (
            <option key={o.valor} value={o.valor}>
              Ordem: {o.rotulo}
            </option>
          ))}
        </select>
        {(inicio?.quadros.length ?? 0) > 1 && (
          <select value={quadroId} onChange={(e) => setQuadroId(e.target.value)} aria-label="Quadro" className={campo}>
            <option value="">Todos os quadros</option>
            {inicio?.quadros.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome}
              </option>
            ))}
          </select>
        )}
      </div>
      {itens === null ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "tarefa" : "tarefas"}
          </p>
          <div className="max-w-3xl">
            <ListaDeTarefas
              tarefas={itens}
              aoAbrir={abrir}
              aoMudar={carregar}
              mostrarQuadro
              vazio={<EmptyState icon={ListChecks} title="Nenhuma tarefa aqui" description="Mude os filtros ou anote uma nova tarefa." />}
            />
            {itens.length < total && itens.length < 200 && (
              <Button variant="outline" className="mt-3 h-11 w-full gap-2" onClick={carregarMais} disabled={carregandoMais}>
                {carregandoMais && <Loader2 className="h-4 w-4 animate-spin" />}
                Carregar mais ({total - itens.length})
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ListaPage() {
  return (
    <Suspense fallback={null}>
      <Lista />
    </Suspense>
  );
}
