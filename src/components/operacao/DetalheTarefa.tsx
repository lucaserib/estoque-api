"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Check, Copy, ExternalLink, Loader2, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PRIORIDADES, ROTULOS_PRIORIDADE } from "@/modules/operacao/dominio/esquemas";
import type { Recorrencia } from "@/modules/operacao/dominio/recorrencia";
import type { AtividadeDto, CartaoTarefa, DetalheTarefa as Detalhe, QuadroCompleto } from "@/modules/operacao/tipos";
import { ErroApiOperacao, chamarOperacao } from "./api";
import { ChecklistTarefa } from "./ChecklistTarefa";
import { ComentariosTarefa } from "./ComentariosTarefa";
import { EditorRecorrencia } from "./EditorRecorrencia";
import { avisarTarefasMudaram } from "./eventos";
import { CLASSES_COR } from "./cores";
import { classeSituacao, quandoRelativo, rotuloPrazo } from "./formato";
import { Folha } from "./Folha";
import { useOperacao } from "./OperacaoContexto";
import { AvatarPessoa } from "./Pecas";

type Edicao = {
  titulo?: string;
  descricao?: string | null;
  prioridade?: string;
  responsavelId?: string | null;
  prazo?: { data: string; hora?: string | null } | null;
  etiquetaIds?: string[];
  recorrencia?: Recorrencia | null;
};

const campo = "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-60";

function prazoLegivel(valor: unknown): string {
  const [data, hora] = String(valor).split(" ");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}${hora ? ` ${hora}` : ""}`;
}

function textoAtividade(atividade: AtividadeDto): string {
  const d = atividade.dados ?? {};
  switch (atividade.tipo) {
    case "CRIADA":
      return d.origem === "RECORRENCIA" ? `criou pela rotina (depois da #${d.anterior})` : d.origem === "DUPLICADA" ? "criou duplicando outra tarefa" : "criou a tarefa";
    case "EDITADA":
      return d.campo === "titulo" ? `mudou o título para “${d.para}”` : "editou a descrição";
    case "MOVIDA":
      return `moveu de ${d.de} para ${d.para}`;
    case "ATRIBUIDA":
      return d.para ? `passou para ${d.para}` : "tirou o responsável";
    case "PRAZO":
      return d.para ? `mudou o prazo para ${prazoLegivel(d.para)}` : "tirou o prazo";
    case "PRIORIDADE":
      return `mudou a prioridade para ${ROTULOS_PRIORIDADE[d.para as keyof typeof ROTULOS_PRIORIDADE] ?? d.para}`;
    case "ETIQUETAS": {
      const partes: string[] = [];
      if (Array.isArray(d.adicionadas) && d.adicionadas.length) partes.push(`pôs ${d.adicionadas.join(", ")}`);
      if (Array.isArray(d.removidas) && d.removidas.length) partes.push(`tirou ${d.removidas.join(", ")}`);
      return `etiquetas: ${partes.join(" e ")}`;
    }
    case "CONCLUIDA":
      return "concluiu";
    case "REABERTA":
      return "reabriu";
    case "ARQUIVADA":
      return "arquivou";
    case "RESTAURADA":
      return "restaurou";
    case "COMENTARIO":
      return "comentou";
    case "CHECKLIST":
      return `${d.acao} “${d.texto}” no checklist`;
    case "RECORRENCIA":
      return d.texto ? `definiu a rotina: ${d.texto}` : "tirou a repetição";
  }
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[108px_1fr] items-center gap-2 sm:grid-cols-[120px_1fr]">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DetalheTarefa({ tarefaId, aoFechar }: { tarefaId: string | null; aoFechar: () => void }) {
  const { inicio } = useOperacao();
  const podeEditar = Boolean(inicio?.usuario.podeEditar);
  const podeAdministrar = Boolean(inicio?.usuario.podeAdministrar);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [colunas, setColunas] = useState<QuadroCompleto["quadro"]["colunas"]>([]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!tarefaId) return;
    try {
      const { tarefa } = await chamarOperacao<{ tarefa: Detalhe }>(`/tarefas/${tarefaId}`);
      setDetalhe(tarefa);
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao ?? "");
      setErro(null);
      const quadro = inicio?.quadros.find((q) => q.id === tarefa.quadro.id);
      setColunas(quadro?.colunas ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a tarefa.");
    }
  }, [tarefaId, inicio]);

  useEffect(() => {
    setDetalhe(null);
    setErro(null);
    carregar();
  }, [carregar]);

  const salvar = async (edicao: Edicao) => {
    if (!detalhe) return;
    try {
      const protegerTexto = edicao.titulo !== undefined || edicao.descricao !== undefined;
      await chamarOperacao<{ tarefa: CartaoTarefa }>(`/tarefas/${detalhe.id}`, {
        metodo: "PATCH",
        corpo: protegerTexto ? { ...edicao, versao: detalhe.versao } : edicao,
      });
      await carregar();
      avisarTarefasMudaram();
    } catch (e) {
      if (e instanceof ErroApiOperacao && e.status === 409) {
        toast.warning(e.message);
        await carregar();
        return;
      }
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  const acao = async (nome: "concluir" | "reabrir" | "arquivar" | "restaurar" | "duplicar") => {
    if (!detalhe) return;
    setOcupado(true);
    try {
      const resposta = await chamarOperacao<{ tarefa: CartaoTarefa; proxima: CartaoTarefa | null }>(`/tarefas/${detalhe.id}/acoes`, { corpo: { acao: nome } });
      avisarTarefasMudaram();
      if (nome === "duplicar") {
        toast.success(`Cópia criada: #${resposta.tarefa.numero}`);
      } else if (nome === "concluir") {
        toast.success(resposta.proxima ? `Concluída. A próxima da rotina (#${resposta.proxima.numero}) já está na fila.` : "Tarefa concluída");
      }
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    } finally {
      setOcupado(false);
    }
  };

  const mover = async (colunaId: string) => {
    if (!detalhe) return;
    try {
      await chamarOperacao(`/tarefas/${detalhe.id}/mover`, { corpo: { colunaId } });
      avisarTarefasMudaram();
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mover.");
    }
  };

  const excluir = async () => {
    if (!detalhe || !window.confirm(`Excluir de vez a tarefa #${detalhe.numero}? Não dá para desfazer.`)) return;
    try {
      await chamarOperacao(`/tarefas/${detalhe.id}`, { metodo: "DELETE" });
      avisarTarefasMudaram();
      toast.success("Tarefa excluída");
      aoFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  };

  const copiarLink = async () => {
    if (!detalhe) return;
    await navigator.clipboard.writeText(`${window.location.origin}/operacao?tarefa=${detalhe.id}`);
    toast.success("Link copiado");
  };

  const concluida = Boolean(detalhe?.concluidaEm);
  const arquivada = Boolean(detalhe?.arquivadaEm);
  const editavel = podeEditar && !arquivada;

  const menu = detalhe && podeEditar && (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 w-10 items-center justify-center rounded-lg text-fg2 hover:bg-muted sm:h-9 sm:w-9" aria-label="Mais ações">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem className="min-h-10 gap-2" onSelect={copiarLink}>
          <Copy className="h-4 w-4" />
          Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => acao("duplicar")}>
          <Copy className="h-4 w-4" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {arquivada ? (
          <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => acao("restaurar")}>
            <ArchiveRestore className="h-4 w-4" />
            Restaurar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => acao("arquivar")}>
            <Archive className="h-4 w-4" />
            Arquivar
          </DropdownMenuItem>
        )}
        {arquivada && podeAdministrar && (
          <DropdownMenuItem className="min-h-10 gap-2 text-destructive-text" onSelect={excluir}>
            <Trash2 className="h-4 w-4" />
            Excluir de vez
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const rodape =
    detalhe && podeEditar ? (
      arquivada ? (
        <Button className="h-11 w-full gap-2" variant="outline" onClick={() => acao("restaurar")} disabled={ocupado}>
          <ArchiveRestore className="h-4 w-4" />
          Restaurar tarefa
        </Button>
      ) : (
        <Button
          className={cn("h-11 w-full gap-2", concluida && "bg-muted text-foreground hover:bg-muted/80")}
          onClick={() => acao(concluida ? "reabrir" : "concluir")}
          disabled={ocupado}
          data-testid="botao-concluir"
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : concluida ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {concluida ? "Reabrir" : "Concluir"}
        </Button>
      )
    ) : undefined;

  return (
    <Folha
      aberta={Boolean(tarefaId)}
      aoMudar={(aberta) => !aberta && aoFechar()}
      titulo={detalhe ? `#${detalhe.numero} · ${detalhe.quadro.nome}` : "Tarefa"}
      descricao={detalhe ? `Criada ${quandoRelativo(detalhe.criadaEm)}${detalhe.criadoPor ? ` por ${detalhe.criadoPor.nome}` : ""}` : undefined}
      cabecalho={menu}
      rodape={rodape}
    >
      {erro && <p className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive-text">{erro}</p>}
      {!detalhe && !erro && (
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {detalhe && (
        <div className="space-y-6 p-4 sm:p-5" data-testid="detalhe-tarefa">
          {arquivada && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-fg2">Esta tarefa está arquivada. Restaure para voltar a mexer nela.</p>
          )}
          <textarea
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => titulo.trim() && titulo.trim() !== detalhe.titulo && salvar({ titulo: titulo.trim() })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            disabled={!editavel}
            rows={2}
            maxLength={200}
            aria-label="Título da tarefa"
            className={cn(
              "w-full resize-none rounded-lg bg-transparent px-1 text-lg font-semibold leading-snug text-foreground outline-none focus:bg-muted/50 disabled:opacity-100",
              concluida && "text-muted-foreground line-through"
            )}
          />

          <div className="space-y-2.5">
            <Campo rotulo="Coluna">
              <select
                aria-label="Coluna"
                value={detalhe.coluna.id}
                onChange={(e) => mover(e.target.value)}
                disabled={!editavel}
                className={campo}
              >
                {(colunas.length ? colunas : [detalhe.coluna]).map((coluna) => (
                  <option key={coluna.id} value={coluna.id}>
                    {coluna.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Responsável">
              <div className="flex items-center gap-2">
                <AvatarPessoa pessoa={detalhe.responsavel} tamanho={26} />
                <select
                  aria-label="Responsável"
                  value={detalhe.responsavel?.id ?? ""}
                  onChange={(e) => salvar({ responsavelId: e.target.value || null })}
                  disabled={!editavel}
                  className={campo}
                >
                  <option value="">Ninguém</option>
                  {(inicio?.membros ?? [])
                    .filter((m) => m.podeEditar || m.id === detalhe.responsavel?.id)
                    .map((membro) => (
                      <option key={membro.id} value={membro.id}>
                        {membro.nome}
                        {membro.id === inicio?.usuario.id ? " (eu)" : ""}
                      </option>
                    ))}
                </select>
              </div>
            </Campo>
            <Campo rotulo="Prazo">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  aria-label="Data do prazo"
                  value={detalhe.prazoData ?? ""}
                  onChange={(e) => salvar({ prazo: e.target.value ? { data: e.target.value, hora: detalhe.prazoHora } : null, ...(e.target.value ? {} : { recorrencia: null }) })}
                  disabled={!editavel}
                  className={cn(campo, "w-auto flex-1")}
                />
                <input
                  type="time"
                  aria-label="Hora do prazo"
                  value={detalhe.prazoHora ?? ""}
                  onChange={(e) => detalhe.prazoData && salvar({ prazo: { data: detalhe.prazoData, hora: e.target.value || null } })}
                  disabled={!editavel || !detalhe.prazoData}
                  className={cn(campo, "w-[110px]")}
                />
              </div>
              {detalhe.prazoData && (
                <p className={cn("mt-1 text-xs", classeSituacao(detalhe.situacao))}>{rotuloPrazo(detalhe.prazoData, detalhe.prazoHora, detalhe.situacao)}</p>
              )}
            </Campo>
            <Campo rotulo="Prioridade">
              <select
                aria-label="Prioridade"
                value={detalhe.prioridade}
                onChange={(e) => salvar({ prioridade: e.target.value })}
                disabled={!editavel}
                className={campo}
              >
                {[...PRIORIDADES].reverse().map((prioridade) => (
                  <option key={prioridade} value={prioridade}>
                    {ROTULOS_PRIORIDADE[prioridade]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Etiquetas">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Etiquetas">
                {(inicio?.etiquetas ?? []).map((etiqueta) => {
                  const marcada = detalhe.etiquetas.some((e) => e.id === etiqueta.id);
                  return (
                    <button
                      key={etiqueta.id}
                      type="button"
                      aria-pressed={marcada}
                      disabled={!editavel}
                      onClick={() =>
                        salvar({
                          etiquetaIds: marcada ? detalhe.etiquetas.filter((e) => e.id !== etiqueta.id).map((e) => e.id) : [...detalhe.etiquetas.map((e) => e.id), etiqueta.id],
                        })
                      }
                      className={cn(
                        "h-8 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
                        marcada ? cn(CLASSES_COR[etiqueta.cor].chip, "border-transparent") : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {etiqueta.nome}
                    </button>
                  );
                })}
              </div>
            </Campo>
            <Campo rotulo="Repetir">
              <EditorRecorrencia
                valor={detalhe.recorrencia}
                aoMudar={(recorrencia) => salvar({ recorrencia })}
                diaDoPrazo={detalhe.prazoData}
                desabilitado={!editavel}
              />
            </Campo>
            {detalhe.vinculo && (
              <Campo rotulo="Ligada a">
                <Link href={detalhe.vinculo.href} className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <span className="truncate">{detalhe.vinculo.rotulo}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </Link>
              </Campo>
            )}
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Descrição</h3>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={() => (descricao.trim() || null) !== detalhe.descricao && salvar({ descricao: descricao.trim() || null })}
              disabled={!editavel}
              rows={4}
              maxLength={10000}
              placeholder={editavel ? "Detalhes, links, combinados…" : "Sem descrição"}
              aria-label="Descrição"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-80"
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
            <ChecklistTarefa
              tarefaId={detalhe.id}
              itens={detalhe.itensChecklist}
              podeEditar={editavel}
              aoMudar={(itens) => {
                setDetalhe((atual) => (atual ? { ...atual, itensChecklist: itens } : atual));
                avisarTarefasMudaram();
              }}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Comentários</h3>
            <ComentariosTarefa
              tarefaId={detalhe.id}
              comentarios={detalhe.listaComentarios}
              podeEditar={podeEditar}
              aoMudar={(comentarios) => {
                setDetalhe((atual) => (atual ? { ...atual, listaComentarios: comentarios } : atual));
                avisarTarefasMudaram();
              }}
            />
          </section>

          <details className="group rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-foreground">Histórico</summary>
            <ol className="space-y-2 px-3 pb-3">
              {detalhe.atividades.map((atividade) => (
                <li key={atividade.id} className="flex gap-2 text-xs text-fg2">
                  <span className="font-medium text-foreground">{atividade.autor?.nome ?? "Sistema"}</span>
                  <span className="min-w-0 flex-1">{textoAtividade(atividade)}</span>
                  <span className="shrink-0 text-muted-foreground">{quandoRelativo(atividade.criadoEm)}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </Folha>
  );
}
