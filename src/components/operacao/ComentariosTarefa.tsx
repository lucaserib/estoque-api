"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizar } from "@/modules/operacao/dominio/capturaRapida";
import { marcarMencao, textoSemMarcacao, trechosDoComentario } from "@/modules/operacao/dominio/mencoes";
import type { ComentarioDto, MembroDto } from "@/modules/operacao/tipos";
import { chamarOperacao } from "./api";
import { quandoRelativo } from "./formato";
import { useOperacao } from "./OperacaoContexto";
import { AvatarPessoa } from "./Pecas";

function CorpoComentario({ corpo }: { corpo: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
      {trechosDoComentario(corpo).map((trecho, indice) =>
        trecho.tipo === "mencao" ? (
          <span key={indice} className="rounded bg-primary/10 px-0.5 font-medium text-primary">
            {trecho.texto}
          </span>
        ) : (
          <span key={indice}>{trecho.texto}</span>
        )
      )}
    </p>
  );
}

function aplicarMencoes(texto: string, escolhidas: Map<string, MembroDto>): string {
  let resultado = texto;
  for (const membro of escolhidas.values()) {
    const marca = `@${membro.nome}`;
    if (resultado.includes(marca)) resultado = resultado.replace(marca, marcarMencao(membro.nome, membro.id));
  }
  return resultado;
}

function EditorComentario({
  inicial = "",
  aoEnviar,
  rotulo,
  aoCancelar,
}: {
  inicial?: string;
  aoEnviar: (corpo: string) => Promise<void>;
  rotulo: string;
  aoCancelar?: () => void;
}) {
  const { inicio } = useOperacao();
  const [texto, setTexto] = useState(() => textoSemMarcacao(inicial));
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState<string | null>(null);
  const escolhidas = useRef(
    new Map<string, MembroDto>(
      trechosDoComentario(inicial)
        .filter((trecho) => trecho.tipo === "mencao" && trecho.userId)
        .flatMap((trecho) => {
          const membro = inicio?.membros.find((m) => m.id === trecho.userId);
          return membro ? [[membro.id, { ...membro, nome: trecho.texto.slice(1) }] as const] : [];
        })
    )
  );
  const campo = useRef<HTMLTextAreaElement>(null);

  const sugestoes = useMemo(() => {
    if (busca === null) return [];
    const alvo = normalizar(busca);
    return (inicio?.membros ?? []).filter((m) => normalizar(m.nome).includes(alvo)).slice(0, 5);
  }, [busca, inicio]);

  const aoDigitar = (valor: string, cursor: number) => {
    setTexto(valor);
    const antes = valor.slice(0, cursor);
    const encontrada = /(?:^|\s)@([^\s@]{0,30})$/.exec(antes);
    setBusca(encontrada ? encontrada[1] : null);
  };

  const escolher = (membro: MembroDto) => {
    const elemento = campo.current;
    const cursor = elemento?.selectionStart ?? texto.length;
    const antes = texto.slice(0, cursor).replace(/@([^\s@]{0,30})$/, `@${membro.nome} `);
    const depois = texto.slice(cursor);
    escolhidas.current.set(membro.id, membro);
    setTexto(antes + depois);
    setBusca(null);
    requestAnimationFrame(() => {
      elemento?.focus();
      elemento?.setSelectionRange(antes.length, antes.length);
    });
  };

  const enviar = async (evento?: React.FormEvent) => {
    evento?.preventDefault();
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      await aoEnviar(aplicarMencoes(texto.trim(), escolhidas.current));
      setTexto("");
      escolhidas.current.clear();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="relative">
      {sugestoes.length > 0 && (
        <ul className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lift" role="listbox">
          {sugestoes.map((membro) => (
            <li key={membro.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(membro)}
                className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted"
              >
                <AvatarPessoa pessoa={membro} tamanho={20} />
                {membro.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-1.5 focus-within:border-primary">
        <textarea
          ref={campo}
          value={texto}
          onChange={(e) => aoDigitar(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar();
            if (e.key === "Escape") setBusca(null);
          }}
          rows={2}
          maxLength={4000}
          placeholder="Escreva um comentário… use @ para chamar alguém"
          aria-label={rotulo}
          className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <div className="flex shrink-0 flex-col gap-1">
          {aoCancelar && (
            <button type="button" onClick={aoCancelar} className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label={rotulo}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </form>
  );
}

export function ComentariosTarefa({
  tarefaId,
  comentarios,
  podeEditar,
  aoMudar,
}: {
  tarefaId: string;
  comentarios: ComentarioDto[];
  podeEditar: boolean;
  aoMudar: (comentarios: ComentarioDto[]) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);

  const comentar = async (corpo: string) => {
    try {
      const { comentario } = await chamarOperacao<{ comentario: ComentarioDto }>(`/tarefas/${tarefaId}/comentarios`, { corpo: { corpo } });
      aoMudar([...comentarios, comentario]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível comentar.");
      throw e;
    }
  };

  const editar = async (id: string, corpo: string) => {
    try {
      const { comentario } = await chamarOperacao<{ comentario: ComentarioDto }>(`/comentarios/${id}`, { metodo: "PATCH", corpo: { corpo } });
      aoMudar(comentarios.map((c) => (c.id === id ? comentario : c)));
      setEditando(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível editar.");
      throw e;
    }
  };

  const apagar = async (id: string) => {
    if (!window.confirm("Apagar este comentário?")) return;
    try {
      await chamarOperacao(`/comentarios/${id}`, { metodo: "DELETE" });
      aoMudar(comentarios.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar.");
    }
  };

  return (
    <div className="space-y-3" data-testid="comentarios-tarefa">
      {comentarios.length === 0 && <p className="text-sm text-muted-foreground">Ninguém comentou ainda.</p>}
      <ul className="space-y-3">
        {comentarios.map((comentario) => (
          <li key={comentario.id} className="flex gap-2.5">
            <AvatarPessoa pessoa={comentario.autor} tamanho={28} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-foreground">{comentario.autor?.nome ?? "Pessoa removida"}</span>
                <span className="text-xs text-muted-foreground">
                  {quandoRelativo(comentario.criadoEm)}
                  {comentario.editadoEm ? " · editado" : ""}
                </span>
              </div>
              {editando === comentario.id ? (
                <EditorComentario
                  inicial={comentario.corpo}
                  rotulo="Salvar comentário"
                  aoEnviar={(corpo) => editar(comentario.id, corpo)}
                  aoCancelar={() => setEditando(null)}
                />
              ) : (
                <div className="mt-0.5 rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2">
                  <CorpoComentario corpo={comentario.corpo} />
                </div>
              )}
              {(comentario.podeEditar || comentario.podeApagar) && editando !== comentario.id && (
                <div className="mt-0.5 flex gap-1">
                  {comentario.podeEditar && (
                    <button type="button" onClick={() => setEditando(comentario.id)} className={cn("h-8 rounded px-2 text-xs text-muted-foreground hover:text-foreground")}>
                      Editar
                    </button>
                  )}
                  {comentario.podeApagar && (
                    <button type="button" onClick={() => apagar(comentario.id)} className="h-8 rounded px-2 text-xs text-muted-foreground hover:text-destructive-text">
                      Apagar
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {podeEditar && <EditorComentario rotulo="Enviar comentário" aoEnviar={comentar} />}
    </div>
  );
}
