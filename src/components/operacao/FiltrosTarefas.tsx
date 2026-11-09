"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRIORIDADES, ROTULOS_PRIORIDADE } from "@/modules/operacao/dominio/esquemas";
import { Folha } from "./Folha";
import { useOperacao } from "./OperacaoContexto";

export interface ValorFiltros {
  busca: string;
  responsavelId: string;
  etiquetaId: string;
  prioridade: string;
  situacao: string;
}

export const FILTROS_VAZIOS: ValorFiltros = { busca: "", responsavelId: "", etiquetaId: "", prioridade: "", situacao: "" };

export type OpcaoSituacao = { valor: string; rotulo: string };

export const SITUACOES_QUADRO: OpcaoSituacao[] = [
  { valor: "", rotulo: "Qualquer prazo" },
  { valor: "atrasadas", rotulo: "Atrasadas" },
  { valor: "hoje", rotulo: "Vencem hoje" },
  { valor: "semana", rotulo: "Próximos 7 dias" },
  { valor: "sem-prazo", rotulo: "Sem prazo" },
];

const campo = "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground lg:h-9 lg:w-auto";

export function contarFiltros(valor: ValorFiltros, situacaoPadrao = ""): number {
  return [valor.responsavelId, valor.etiquetaId, valor.prioridade, valor.situacao !== situacaoPadrao ? valor.situacao : ""].filter(Boolean).length;
}

function Controles({
  valor,
  aoMudar,
  situacoes,
  empilhado,
}: {
  valor: ValorFiltros;
  aoMudar: (valor: ValorFiltros) => void;
  situacoes: OpcaoSituacao[];
  empilhado?: boolean;
}) {
  const { inicio } = useOperacao();
  const rotulo = (texto: string) => (empilhado ? <span className="mb-1 block text-xs font-medium text-muted-foreground">{texto}</span> : null);
  return (
    <>
      <label className={cn(empilhado && "block")}>
        {rotulo("Responsável")}
        <select
          aria-label="Filtrar por responsável"
          value={valor.responsavelId}
          onChange={(e) => aoMudar({ ...valor, responsavelId: e.target.value })}
          className={campo}
        >
          <option value="">Todas as pessoas</option>
          <option value="eu">Minhas</option>
          <option value="ninguem">Sem responsável</option>
          {(inicio?.membros ?? [])
            .filter((m) => m.podeEditar)
            .map((membro) => (
              <option key={membro.id} value={membro.id}>
                {membro.nome}
              </option>
            ))}
        </select>
      </label>
      <label className={cn(empilhado && "block")}>
        {rotulo("Etiqueta")}
        <select aria-label="Filtrar por etiqueta" value={valor.etiquetaId} onChange={(e) => aoMudar({ ...valor, etiquetaId: e.target.value })} className={campo}>
          <option value="">Todas as etiquetas</option>
          {(inicio?.etiquetas ?? []).map((etiqueta) => (
            <option key={etiqueta.id} value={etiqueta.id}>
              {etiqueta.nome}
            </option>
          ))}
        </select>
      </label>
      <label className={cn(empilhado && "block")}>
        {rotulo("Prioridade")}
        <select aria-label="Filtrar por prioridade" value={valor.prioridade} onChange={(e) => aoMudar({ ...valor, prioridade: e.target.value })} className={campo}>
          <option value="">Qualquer prioridade</option>
          {[...PRIORIDADES].reverse().map((prioridade) => (
            <option key={prioridade} value={prioridade}>
              {ROTULOS_PRIORIDADE[prioridade]}
            </option>
          ))}
        </select>
      </label>
      {situacoes.length > 0 && (
        <label className={cn(empilhado && "block")}>
          {rotulo("Prazo")}
          <select aria-label="Filtrar por prazo" value={valor.situacao} onChange={(e) => aoMudar({ ...valor, situacao: e.target.value })} className={campo}>
            {situacoes.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

export function FiltrosTarefas({
  valor,
  aoMudar,
  situacoes = SITUACOES_QUADRO,
  extras,
}: {
  valor: ValorFiltros;
  aoMudar: (valor: ValorFiltros) => void;
  situacoes?: OpcaoSituacao[];
  extras?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const situacaoPadrao = situacoes[0]?.valor ?? "";
  const ativos = contarFiltros(valor, situacaoPadrao);
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-[260px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={valor.busca}
          onChange={(e) => aoMudar({ ...valor, busca: e.target.value })}
          placeholder="Buscar tarefa ou #número"
          aria-label="Buscar tarefa"
          className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm sm:h-9"
        />
      </div>
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        <Controles valor={valor} aoMudar={aoMudar} situacoes={situacoes} />
        {extras}
        {ativos > 0 && (
          <Button variant="ghost" size="sm" onClick={() => aoMudar({ ...FILTROS_VAZIOS, situacao: situacaoPadrao, busca: valor.busca })} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>
      <Button variant="outline" onClick={() => setAberto(true)} className="h-10 gap-2 lg:hidden" aria-label={`Filtros${ativos ? ` (${ativos} ativos)` : ""}`}>
        <SlidersHorizontal className="h-4 w-4" />
        Filtros
        {ativos > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{ativos}</span>}
      </Button>
      <Folha
        aberta={aberto}
        aoMudar={setAberto}
        titulo="Filtros"
        largura="media"
        rodape={
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => aoMudar({ ...FILTROS_VAZIOS, situacao: situacaoPadrao, busca: valor.busca })}>
              Limpar
            </Button>
            <Button className="h-11 flex-1" onClick={() => setAberto(false)}>
              Ver tarefas
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <Controles valor={valor} aoMudar={aoMudar} situacoes={situacoes} empilhado />
          {extras}
        </div>
      </Folha>
    </div>
  );
}
