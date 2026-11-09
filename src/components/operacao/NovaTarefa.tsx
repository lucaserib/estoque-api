"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { interpretarCaptura } from "@/modules/operacao/dominio/capturaRapida";
import { PRIORIDADES, ROTULOS_PRIORIDADE } from "@/modules/operacao/dominio/esquemas";
import type { CartaoTarefa } from "@/modules/operacao/tipos";
import { chamarOperacao } from "./api";
import { CLASSES_COR } from "./cores";
import { avisarTarefasMudaram, ouvirNovaTarefa, type DetalheNovaTarefa } from "./eventos";
import { Folha } from "./Folha";
import { OperacaoProvider, useOperacao } from "./OperacaoContexto";

const campo = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm sm:h-10";

function Formulario({
  inicial,
  aoFechar,
  aoPronto,
}: {
  inicial: DetalheNovaTarefa;
  aoFechar: () => void;
  aoPronto: (pronto: boolean) => void;
}) {
  const router = useRouter();
  const { inicio, quadroPadrao, responsaveis } = useOperacao();
  const [titulo, setTitulo] = useState(inicial.titulo ?? "");
  const [descricao, setDescricao] = useState(inicial.descricao ?? "");
  const [quadroId, setQuadroId] = useState(inicial.quadroId ?? "");
  const [responsavelEscolhido, setResponsavelEscolhido] = useState<string | null>(inicial.responsavelId ?? null);
  const [data, setData] = useState(inicial.prazoData ?? "");
  const [hora, setHora] = useState("");
  const [prioridade, setPrioridade] = useState<string>(inicial.prioridade ?? "MEDIA");
  const [etiquetaIds, setEtiquetaIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!quadroId && quadroPadrao) setQuadroId(quadroPadrao.id);
  }, [quadroId, quadroPadrao]);

  useEffect(() => {
    aoPronto(Boolean(inicio?.usuario.podeEditar));
  }, [inicio, aoPronto]);

  const leitura = useMemo(
    () =>
      interpretarCaptura(titulo, {
        pessoas: responsaveis.map((m) => ({ id: m.id, nome: m.nome, email: m.email })),
        etiquetas: inicio?.etiquetas ?? [],
      }),
    [titulo, responsaveis, inicio]
  );

  const responsavelId = responsavelEscolhido ?? leitura.responsavelId ?? (inicio?.usuario.podeEditar ? inicio.usuario.id : "");

  if (!inicio) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!inicio.usuario.podeEditar) {
    return <p className="p-5 text-sm text-muted-foreground">Seu acesso é só de leitura: você vê as tarefas, mas não cria.</p>;
  }

  const criar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const tituloFinal = leitura.titulo || titulo.trim();
    if (!tituloFinal) return;
    setSalvando(true);
    try {
      const prazo = data ? { data, hora: hora || null } : leitura.prazo;
      const resposta = await chamarOperacao<{ tarefa: CartaoTarefa; existente: boolean }>("/tarefas", {
        corpo: {
          titulo: tituloFinal,
          descricao: descricao.trim() || null,
          quadroId: quadroId || undefined,
          colunaId: inicial.colunaId,
          responsavelId: responsavelId || null,
          prazo: prazo ?? undefined,
          prioridade: prioridade !== "MEDIA" ? prioridade : leitura.prioridade ?? "MEDIA",
          etiquetaIds: [...new Set([...etiquetaIds, ...leitura.etiquetaIds])],
          origem: inicial.origem ?? "MANUAL",
          chaveOrigem: inicial.chaveOrigem,
          vinculo: inicial.vinculo ?? undefined,
          notaId: inicial.notaId,
        },
      });
      avisarTarefasMudaram();
      const abrir = () => router.push(`/operacao?tarefa=${resposta.tarefa.id}`);
      if (resposta.existente) {
        toast.info(`Já existe uma tarefa aberta para isso: #${resposta.tarefa.numero}`, { action: { label: "Abrir", onClick: abrir } });
      } else {
        toast.success(`Tarefa #${resposta.tarefa.numero} criada`, { action: { label: "Abrir", onClick: abrir } });
      }
      aoFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a tarefa.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form id="form-nova-tarefa" onSubmit={criar} className="space-y-4 p-4 sm:p-5" data-testid="nova-tarefa">
      {inicial.vinculo && (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-fg2">
          <Link2 className="h-4 w-4 shrink-0" />
          Ligada a <strong className="truncate text-foreground">{inicial.vinculo.rotulo}</strong>
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">O que precisa ser feito</span>
        <textarea
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          autoFocus
          rows={2}
          maxLength={300}
          placeholder="Ex.: Cobrar fornecedor amanhã @ana #compras !alta"
          aria-label="Título da tarefa"
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm"
        />
      </label>
      {leitura.avisos.length > 0 && <p className="text-xs text-warning-text">{leitura.avisos.join(" ")}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Quadro</span>
          <select value={quadroId} onChange={(e) => setQuadroId(e.target.value)} className={campo} aria-label="Quadro" disabled={Boolean(inicial.colunaId)}>
            {inicio.quadros.map((quadro) => (
              <option key={quadro.id} value={quadro.id}>
                {quadro.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Responsável</span>
          <select value={responsavelId} onChange={(e) => setResponsavelEscolhido(e.target.value)} className={campo} aria-label="Responsável">
            <option value="">Ninguém</option>
            {responsaveis.map((membro) => (
              <option key={membro.id} value={membro.id}>
                {membro.nome}
                {membro.id === inicio.usuario.id ? " (eu)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Prazo</span>
          <div className="flex gap-2">
            <input type="date" value={data || leitura.prazo?.data || ""} onChange={(e) => setData(e.target.value)} className={cn(campo, "flex-1")} aria-label="Data do prazo" />
            <input type="time" value={hora || leitura.prazo?.hora || ""} onChange={(e) => setHora(e.target.value)} className={cn(campo, "w-[110px]")} aria-label="Hora do prazo" />
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Prioridade</span>
          <select value={prioridade !== "MEDIA" ? prioridade : leitura.prioridade ?? "MEDIA"} onChange={(e) => setPrioridade(e.target.value)} className={campo} aria-label="Prioridade">
            {[...PRIORIDADES].reverse().map((p) => (
              <option key={p} value={p}>
                {ROTULOS_PRIORIDADE[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Etiquetas</span>
        <div className="flex flex-wrap gap-1.5">
          {inicio.etiquetas.map((etiqueta) => {
            const marcada = etiquetaIds.includes(etiqueta.id) || leitura.etiquetaIds.includes(etiqueta.id);
            return (
              <button
                key={etiqueta.id}
                type="button"
                aria-pressed={marcada}
                onClick={() => setEtiquetaIds((atual) => (atual.includes(etiqueta.id) ? atual.filter((e) => e !== etiqueta.id) : [...atual, etiqueta.id]))}
                className={cn(
                  "h-9 rounded-full border px-3 text-xs font-medium",
                  marcada ? cn(CLASSES_COR[etiqueta.cor].chip, "border-transparent") : "border-border text-muted-foreground"
                )}
              >
                {etiqueta.nome}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Descrição (opcional)</span>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          maxLength={10000}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm"
          aria-label="Descrição"
        />
      </label>
      <button type="submit" className="sr-only" disabled={salvando}>
        Criar tarefa
      </button>
    </form>
  );
}

export function NovaTarefaGlobal() {
  const [aberta, setAberta] = useState(false);
  const [inicial, setInicial] = useState<DetalheNovaTarefa>({});
  const [chave, setChave] = useState(0);
  const [pronto, setPronto] = useState(false);

  useEffect(
    () =>
      ouvirNovaTarefa((detalhe) => {
        setInicial(detalhe);
        setChave((c) => c + 1);
        setPronto(false);
        setAberta(true);
      }),
    []
  );

  return (
    <Folha
      aberta={aberta}
      aoMudar={setAberta}
      titulo="Nova tarefa"
      largura="media"
      rodape={
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => setAberta(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nova-tarefa" className="h-11 flex-1" disabled={!pronto} data-testid="criar-tarefa">
            Criar tarefa
          </Button>
        </div>
      }
    >
      {aberta && (
        <OperacaoProvider>
          <Formulario key={chave} inicial={inicial} aoFechar={() => setAberta(false)} aoPronto={setPronto} />
        </OperacaoProvider>
      )}
    </Folha>
  );
}
