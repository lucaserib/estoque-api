"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CORES_OPERACAO, PAPEIS_COLUNA, ROTULOS_PAPEL_COLUNA, type CorOperacao } from "@/modules/operacao/dominio/esquemas";
import type { ColunaDto, EtiquetaDto, QuadroDto } from "@/modules/operacao/tipos";
import { ErroApiOperacao, chamarOperacao } from "./api";
import { CLASSES_COR, NOMES_COR } from "./cores";
import { avisarTarefasMudaram } from "./eventos";
import { Folha } from "./Folha";
import { useOperacao } from "./OperacaoContexto";

const campo = "h-10 rounded-lg border border-input bg-background px-2.5 text-sm";

function SeletorCor({ valor, aoMudar, rotulo }: { valor: CorOperacao; aoMudar: (cor: CorOperacao) => void; rotulo: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={rotulo}>
      {CORES_OPERACAO.map((cor) => (
        <button
          key={cor}
          type="button"
          role="radio"
          aria-checked={valor === cor}
          aria-label={NOMES_COR[cor]}
          onClick={() => aoMudar(cor)}
          className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2", valor === cor ? "border-foreground" : "border-transparent")}
        >
          <span className={cn("h-6 w-6 rounded-full", CLASSES_COR[cor].ponto)} />
        </button>
      ))}
    </div>
  );
}

function LinhaColuna({
  coluna,
  outras,
  primeira,
  ultima,
  aoMudar,
}: {
  coluna: ColunaDto;
  outras: ColunaDto[];
  primeira: boolean;
  ultima: boolean;
  aoMudar: () => Promise<void>;
}) {
  const [nome, setNome] = useState(coluna.nome);
  const [destino, setDestino] = useState<string | null>(null);
  const [pedindoDestino, setPedindoDestino] = useState(false);

  const atualizar = async (dados: Partial<{ nome: string; papel: string; limite: number | null }>) => {
    try {
      await chamarOperacao(`/colunas/${coluna.id}`, { metodo: "PATCH", corpo: dados });
      await aoMudar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a coluna.");
      setNome(coluna.nome);
    }
  };

  const mover = async (direcao: -1 | 1) => {
    const lista = [coluna, ...outras].sort((a, b) => a.posicao - b.posicao);
    const novoIndice = lista.findIndex((c) => c.id === coluna.id) + direcao;
    const semEla = lista.filter((c) => c.id !== coluna.id);
    const anterior = semEla[novoIndice - 1];
    const seguinte = semEla[novoIndice];
    try {
      await chamarOperacao(`/colunas/${coluna.id}/mover`, { corpo: { anteriorId: anterior?.id ?? null, seguinteId: seguinte?.id ?? null } });
      await aoMudar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mover a coluna.");
    }
  };

  const apagar = async () => {
    if (!pedindoDestino && !window.confirm(`Apagar a coluna “${coluna.nome}”?`)) return;
    try {
      await chamarOperacao(`/colunas/${coluna.id}${destino ? `?destino=${destino}` : ""}`, { metodo: "DELETE" });
      await aoMudar();
      avisarTarefasMudaram();
    } catch (e) {
      if (e instanceof ErroApiOperacao && /Escolha/.test(e.message)) {
        setPedindoDestino(true);
        setDestino(outras[0]?.id ?? null);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar a coluna.");
    }
  };

  return (
    <li className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => nome.trim() && nome.trim() !== coluna.nome && atualizar({ nome: nome.trim() })}
          maxLength={40}
          aria-label="Nome da coluna"
          className={cn(campo, "min-w-0 flex-1")}
        />
        <button type="button" onClick={() => mover(-1)} disabled={primeira} aria-label={`Mover ${coluna.nome} para antes`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border disabled:opacity-40">
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => mover(1)} disabled={ultima} aria-label={`Mover ${coluna.nome} para depois`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border disabled:opacity-40">
          <ArrowDown className="h-4 w-4" />
        </button>
        <button type="button" onClick={apagar} aria-label={`Apagar a coluna ${coluna.nome}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive-text">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={coluna.papel} onChange={(e) => atualizar({ papel: e.target.value })} aria-label="Tipo da coluna" className={campo}>
          {PAPEIS_COLUNA.map((papel) => (
            <option key={papel} value={papel}>
              {ROTULOS_PAPEL_COLUNA[papel]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Limite
          <input
            type="number"
            min={1}
            max={999}
            defaultValue={coluna.limite ?? ""}
            onBlur={(e) => {
              const valor = e.target.value ? Number(e.target.value) : null;
              if (valor !== coluna.limite) atualizar({ limite: valor });
            }}
            aria-label="Limite de tarefas"
            placeholder="—"
            className={cn(campo, "w-20")}
          />
        </label>
      </div>
      {pedindoDestino && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-warning/10 p-2 text-sm">
          <span>Para onde vão as tarefas desta coluna?</span>
          <select value={destino ?? ""} onChange={(e) => setDestino(e.target.value)} aria-label="Coluna de destino" className={campo}>
            {outras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <Button size="sm" variant="destructive" onClick={apagar} className="h-10">
            Mover e apagar
          </Button>
        </div>
      )}
    </li>
  );
}

function LinhaEtiqueta({ etiqueta, aoMudar }: { etiqueta: EtiquetaDto; aoMudar: () => Promise<void> }) {
  const [nome, setNome] = useState(etiqueta.nome);
  const salvar = async (dados: Partial<{ nome: string; cor: CorOperacao }>) => {
    try {
      await chamarOperacao(`/etiquetas/${etiqueta.id}`, { metodo: "PATCH", corpo: dados });
      await aoMudar();
      avisarTarefasMudaram();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a etiqueta.");
      setNome(etiqueta.nome);
    }
  };
  const apagar = async () => {
    if (!window.confirm(`Apagar a etiqueta “${etiqueta.nome}”? Ela sai de todas as tarefas.`)) return;
    try {
      await chamarOperacao(`/etiquetas/${etiqueta.id}`, { metodo: "DELETE" });
      await aoMudar();
      avisarTarefasMudaram();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar a etiqueta.");
    }
  };
  return (
    <li className="flex items-center gap-2">
      <select
        value={etiqueta.cor}
        onChange={(e) => salvar({ cor: e.target.value as CorOperacao })}
        aria-label={`Cor da etiqueta ${etiqueta.nome}`}
        className={cn(campo, "w-28", CLASSES_COR[etiqueta.cor].chip)}
      >
        {CORES_OPERACAO.map((cor) => (
          <option key={cor} value={cor}>
            {NOMES_COR[cor]}
          </option>
        ))}
      </select>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => nome.trim() && nome.trim() !== etiqueta.nome && salvar({ nome: nome.trim() })}
        maxLength={30}
        aria-label="Nome da etiqueta"
        className={cn(campo, "min-w-0 flex-1")}
      />
      <button type="button" onClick={apagar} aria-label={`Apagar a etiqueta ${etiqueta.nome}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive-text">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export function GerenciarQuadro({ quadro, aberto, aoMudar }: { quadro: QuadroDto; aberto: boolean; aoMudar: (aberto: boolean) => void }) {
  const { inicio, recarregar } = useOperacao();
  const [nome, setNome] = useState(quadro.nome);
  const [novaColuna, setNovaColuna] = useState("");
  const [novaEtiqueta, setNovaEtiqueta] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const atualizado = async () => {
    await recarregar();
    avisarTarefasMudaram();
  };

  const salvarQuadro = async (dados: Partial<{ nome: string; cor: CorOperacao; arquivado: boolean }>) => {
    try {
      await chamarOperacao(`/quadros/${quadro.id}`, { metodo: "PATCH", corpo: dados });
      await atualizado();
      if (dados.arquivado) {
        toast.success("Quadro arquivado");
        aoMudar(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o quadro.");
    }
  };

  const criarColuna = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!novaColuna.trim()) return;
    setOcupado(true);
    try {
      await chamarOperacao(`/quadros/${quadro.id}/colunas`, { corpo: { nome: novaColuna.trim(), papel: "EM_ANDAMENTO" } });
      setNovaColuna("");
      await atualizado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a coluna.");
    } finally {
      setOcupado(false);
    }
  };

  const criarEtiqueta = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!novaEtiqueta.trim()) return;
    try {
      await chamarOperacao("/etiquetas", { corpo: { nome: novaEtiqueta.trim(), cor: "azul" } });
      setNovaEtiqueta("");
      await atualizado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a etiqueta.");
    }
  };

  const colunas = [...quadro.colunas].sort((a, b) => a.posicao - b.posicao);

  return (
    <Folha aberta={aberto} aoMudar={aoMudar} titulo="Configurar quadro" descricao={quadro.nome} largura="media">
      <div className="space-y-6 p-4 sm:p-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Quadro</h3>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => nome.trim() && nome.trim() !== quadro.nome && salvarQuadro({ nome: nome.trim() })}
            maxLength={60}
            aria-label="Nome do quadro"
            className={cn(campo, "w-full")}
          />
          <SeletorCor valor={quadro.cor} aoMudar={(cor) => salvarQuadro({ cor })} rotulo="Cor do quadro" />
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Colunas</h3>
            <p className="text-xs text-muted-foreground">Tarefa que entra numa coluna “Concluída” é dada como feita. Todo quadro tem pelo menos uma “A fazer” e uma “Concluída”.</p>
          </div>
          <ul className="space-y-2">
            {colunas.map((coluna, indice) => (
              <LinhaColuna
                key={`${coluna.id}-${coluna.posicao}-${coluna.papel}`}
                coluna={coluna}
                outras={colunas.filter((c) => c.id !== coluna.id)}
                primeira={indice === 0}
                ultima={indice === colunas.length - 1}
                aoMudar={atualizado}
              />
            ))}
          </ul>
          <form onSubmit={criarColuna} className="flex gap-2">
            <input value={novaColuna} onChange={(e) => setNovaColuna(e.target.value)} placeholder="Nova coluna" maxLength={40} aria-label="Nova coluna" className={cn(campo, "min-w-0 flex-1")} />
            <Button type="submit" variant="outline" className="h-10 gap-1.5" disabled={ocupado || !novaColuna.trim()}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </form>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Etiquetas da loja</h3>
          <ul className="space-y-2">
            {(inicio?.etiquetas ?? []).map((etiqueta) => (
              <LinhaEtiqueta key={`${etiqueta.id}-${etiqueta.nome}-${etiqueta.cor}`} etiqueta={etiqueta} aoMudar={atualizado} />
            ))}
          </ul>
          <form onSubmit={criarEtiqueta} className="flex gap-2">
            <input value={novaEtiqueta} onChange={(e) => setNovaEtiqueta(e.target.value)} placeholder="Nova etiqueta" maxLength={30} aria-label="Nova etiqueta" className={cn(campo, "min-w-0 flex-1")} />
            <Button type="submit" variant="outline" className="h-10 gap-1.5" disabled={!novaEtiqueta.trim()}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </form>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <Button variant="outline" className="h-10 text-destructive-text" onClick={() => window.confirm("Arquivar este quadro? As tarefas continuam na Lista.") && salvarQuadro({ arquivado: true })}>
            Arquivar quadro
          </Button>
        </section>
      </div>
    </Folha>
  );
}

export function NovoQuadro({ aberto, aoMudar, aoCriar }: { aberto: boolean; aoMudar: (aberto: boolean) => void; aoCriar: (quadro: QuadroDto) => void }) {
  const { recarregar } = useOperacao();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorOperacao>("verde");
  const [salvando, setSalvando] = useState(false);

  const criar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const { quadro } = await chamarOperacao<{ quadro: QuadroDto }>("/quadros", { corpo: { nome: nome.trim(), cor } });
      await recarregar();
      setNome("");
      aoMudar(false);
      aoCriar(quadro);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o quadro.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Folha
      aberta={aberto}
      aoMudar={aoMudar}
      titulo="Novo quadro"
      largura="media"
      rodape={
        <Button type="submit" form="form-novo-quadro" className="h-11 w-full" disabled={salvando || !nome.trim()}>
          Criar quadro
        </Button>
      }
    >
      <form id="form-novo-quadro" onSubmit={criar} className="space-y-4 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">Ex.: Lançamentos, Marketing, Compras da China. O quadro nasce com “A fazer”, “Fazendo” e “Feito”.</p>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do quadro" maxLength={60} autoFocus aria-label="Nome do quadro" className={cn(campo, "w-full")} />
        <SeletorCor valor={cor} aoMudar={setCor} rotulo="Cor do quadro" />
      </form>
    </Folha>
  );
}
