"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  History,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  RotateCcw,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBR, formatRelativeTime } from "@/lib/format";
import { lerEventosSse } from "@/lib/sse";
import { cn } from "@/lib/utils";
import { CartaoVendaIa } from "./CartaoVendaIa";
import { MarkdownSeguro } from "./MarkdownSeguro";
import { type AcessoIaCliente, type ConsumoIaCliente, atualizarConsumoIa, useAcessoIa } from "./useAcessoIa";

interface ChipFerramenta {
  id: string;
  nome: string;
  rotulo: string;
  estado: "inicio" | "fim" | "erro";
}

interface MensagemTela {
  chave: string;
  id?: string;
  papel: "usuario" | "assistente";
  conteudo: string;
  ferramentas: ChipFerramenta[];
  util?: boolean | null;
  emAndamento?: boolean;
  erro?: { codigo: string; mensagem: string } | null;
}

interface ResumoConversa {
  id: string;
  titulo: string | null;
  updatedAt: string;
}

export interface PerguntaInicial {
  texto: string;
  enviar?: boolean;
  chave: number;
}

const URL_SUPORTE = process.env.NEXT_PUBLIC_SUPORTE_URL || "/ajuda/manual";

let contadorChave = 0;
function novaChave() {
  contadorChave += 1;
  return `m${Date.now()}-${contadorChave}`;
}

function textoConsumo(acesso: AcessoIaCliente) {
  const { consumo } = acesso;
  if (acesso.origem === "TESTE" && acesso.testeAteEm) {
    return `${consumo.percentual}% do teste grátis · até ${formatDateBR(acesso.testeAteEm)}`;
  }
  return `${consumo.percentual}% do uso do mês`;
}

function BarraConsumo({ acesso }: { acesso: AcessoIaCliente }) {
  const percentual = Math.min(100, acesso.consumo.percentual);
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground" aria-label="Consumo de IA">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", percentual >= 90 ? "bg-destructive" : percentual >= 70 ? "bg-warning" : "bg-primary")}
          style={{ width: `${percentual}%` }}
        />
      </div>
      <span>{textoConsumo(acesso)}</span>
    </div>
  );
}

function Chip({ chip }: { chip: ChipFerramenta }) {
  return (
    <span
      data-testid="chip-ferramenta"
      data-estado={chip.estado}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        chip.estado === "erro"
          ? "border-destructive/30 bg-destructive/5 text-destructive-text"
          : chip.estado === "fim"
          ? "border-border bg-muted/50 text-fg2"
          : "border-primary/30 bg-primary/5 text-primary"
      )}
    >
      {chip.estado === "inicio" && <Loader2 className="h-3 w-3 animate-spin" />}
      {chip.estado === "fim" && <CheckCircle2 className="h-3 w-3" />}
      {chip.estado === "erro" && <AlertTriangle className="h-3 w-3" />}
      {chip.estado === "inicio" ? `${chip.rotulo}…` : chip.rotulo}
    </span>
  );
}

function EstadoIndisponivel({ acesso }: { acesso: AcessoIaCliente }) {
  if (!acesso.configurada) {
    return (
      <div className="m-4 rounded-card border border-border bg-muted/40 p-4 text-sm text-fg2">
        {acesso.adminPlataforma
          ? "A IA não está configurada no servidor. Defina ANTHROPIC_API_KEY (ou IA_PROVEDOR_FALSO=1 em teste) e faça um novo deploy."
          : "O assistente está indisponível no momento."}
      </div>
    );
  }
  return (
    <div className="m-4 rounded-card border border-border bg-muted/40 p-4 text-sm text-fg2">
      O Skubo IA está temporariamente desligado. Tente de novo mais tarde.
    </div>
  );
}

function EstadoLimite({ acesso }: { acesso: AcessoIaCliente }) {
  return (
    <div className="m-4 space-y-3 rounded-card border border-warning/30 bg-warning/5 p-4">
      <p className="text-sm font-semibold text-foreground">Limite de IA do período atingido</p>
      <p className="text-sm text-fg2">
        Você usou todo o limite do Skubo IA {acesso.origem === "TESTE" ? "do teste grátis" : "deste mês"}. Ele renova em{" "}
        {formatDateBR(acesso.consumo.renovaEm)}.
      </p>
      <Button asChild variant="outline" size="sm">
        <a href={URL_SUPORTE} target={URL_SUPORTE.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
          Falar com o suporte
        </a>
      </Button>
    </div>
  );
}

export function PainelAssistente({
  modo,
  perguntaInicial,
  aoFechar,
  aoNavegar,
}: {
  modo: "lateral" | "pagina";
  perguntaInicial?: PerguntaInicial | null;
  aoFechar?: () => void;
  aoNavegar?: () => void;
}) {
  const pathname = usePathname();
  const { acesso, utilizavel } = useAcessoIa();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemTela[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[] | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [conversas, setConversas] = useState<ResumoConversa[] | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
  const cancelamento = useRef<AbortController | null>(null);
  const areaMensagens = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLTextAreaElement | null>(null);
  const ultimaPerguntaInicial = useRef<number | null>(null);

  const paginaContexto = pathname === "/ia" ? null : pathname;

  useEffect(() => {
    if (!utilizavel) return;
    const parametros = paginaContexto ? `?pagina=${encodeURIComponent(paginaContexto)}` : "";
    fetch(`/api/ia/sugestoes${parametros}`)
      .then((r) => (r.ok ? r.json() : { sugestoes: [] }))
      .then((d) => setSugestoes(d.sugestoes ?? []))
      .catch(() => setSugestoes([]));
  }, [utilizavel, paginaContexto]);

  const carregarConversas = useCallback(async () => {
    const resposta = await fetch("/api/ia/conversas");
    if (resposta.ok) setConversas((await resposta.json()).conversas);
  }, []);

  useEffect(() => {
    if (historicoAberto) carregarConversas();
  }, [historicoAberto, carregarConversas]);

  useEffect(() => {
    const area = areaMensagens.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [mensagens]);

  const atualizarAssistente = useCallback((chave: string, mudar: (m: MensagemTela) => MensagemTela) => {
    setMensagens((atuais) => atuais.map((m) => (m.chave === chave ? mudar(m) : m)));
  }, []);

  const enviar = useCallback(
    async (pergunta: string) => {
      const limpa = pergunta.trim();
      if (!limpa || enviando) return;
      setTexto("");
      setEnviando(true);
      const chaveAssistente = novaChave();
      setMensagens((atuais) => [
        ...atuais,
        { chave: novaChave(), papel: "usuario", conteudo: limpa, ferramentas: [] },
        { chave: chaveAssistente, papel: "assistente", conteudo: "", ferramentas: [], emAndamento: true },
      ]);

      const controlador = new AbortController();
      cancelamento.current = controlador;
      let conversaAtual = conversaId;

      try {
        const resposta = await fetch("/api/ia/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversaId: conversaAtual, mensagem: limpa, paginaAtual: paginaContexto }),
          signal: controlador.signal,
        });

        if (!resposta.ok || !resposta.headers.get("content-type")?.includes("text/event-stream")) {
          const corpo = await resposta.json().catch(() => null);
          atualizarAssistente(chaveAssistente, (m) => ({
            ...m,
            emAndamento: false,
            erro: {
              codigo: resposta.status === 429 ? "RATE_LIMIT" : "ERRO",
              mensagem: corpo?.error ?? "Não consegui responder agora. Tente de novo em instantes.",
            },
          }));
          return;
        }

        await lerEventosSse(
          resposta,
          ({ evento, dados }) => {
            const d = dados as Record<string, unknown>;
            if (evento === "conversa") {
              conversaAtual = String(d.id);
              setConversaId(conversaAtual);
              if (d.nova) setConversas(null);
            } else if (evento === "texto") {
              atualizarAssistente(chaveAssistente, (m) => ({ ...m, conteudo: m.conteudo + String(d.delta ?? "") }));
            } else if (evento === "ferramenta") {
              const chip = d as unknown as ChipFerramenta;
              atualizarAssistente(chaveAssistente, (m) => ({
                ...m,
                ferramentas: m.ferramentas.some((f) => f.id === chip.id)
                  ? m.ferramentas.map((f) => (f.id === chip.id ? chip : f))
                  : [...m.ferramentas, chip],
              }));
            } else if (evento === "fim") {
              atualizarAssistente(chaveAssistente, (m) => ({ ...m, id: String(d.mensagemId), emAndamento: false }));
              if (d.consumo) atualizarConsumoIa(d.consumo as ConsumoIaCliente);
            } else if (evento === "titulo") {
              setConversas((lista) =>
                lista?.map((c) => (c.id === d.conversaId ? { ...c, titulo: String(d.titulo) } : c)) ?? lista
              );
            } else if (evento === "erro") {
              if (d.conversaDescartada) {
                conversaAtual = null;
                setConversaId(null);
              }
              atualizarAssistente(chaveAssistente, (m) => ({
                ...m,
                emAndamento: false,
                erro: { codigo: String(d.codigo), mensagem: String(d.mensagem) },
              }));
            }
          },
          controlador.signal
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          atualizarAssistente(chaveAssistente, (m) => ({
            ...m,
            erro: { codigo: "REDE", mensagem: "A conexão caiu. Tente de novo." },
          }));
        }
      } finally {
        atualizarAssistente(chaveAssistente, (m) => ({
          ...m,
          emAndamento: false,
          conteudo: m.conteudo || (controlador.signal.aborted && !m.erro ? "_(resposta interrompida)_" : m.conteudo),
        }));
        cancelamento.current = null;
        setEnviando(false);
        campo.current?.focus();
      }
    },
    [atualizarAssistente, conversaId, enviando, paginaContexto]
  );

  useEffect(() => {
    if (!perguntaInicial || !utilizavel || ultimaPerguntaInicial.current === perguntaInicial.chave) return;
    ultimaPerguntaInicial.current = perguntaInicial.chave;
    if (perguntaInicial.enviar) enviar(perguntaInicial.texto);
    else {
      setTexto(perguntaInicial.texto);
      setTimeout(() => campo.current?.focus(), 50);
    }
  }, [perguntaInicial, utilizavel, enviar]);

  const parar = () => {
    cancelamento.current?.abort();
  };

  const novaConversa = () => {
    parar();
    setConversaId(null);
    setMensagens([]);
    setTexto("");
    setHistoricoAberto(false);
    campo.current?.focus();
  };

  const abrirConversa = async (id: string) => {
    parar();
    setCarregandoConversa(true);
    try {
      const resposta = await fetch(`/api/ia/conversas/${id}`);
      if (!resposta.ok) {
        toast.error("Não foi possível abrir essa conversa.");
        return;
      }
      const dados = await resposta.json();
      setConversaId(id);
      setMensagens(
        (dados.mensagens as Array<{ id: string; papel: string; conteudo: string; util: boolean | null; ferramentas: string[] }>).map(
          (m) => ({
            chave: m.id,
            id: m.id,
            papel: m.papel === "USUARIO" ? "usuario" : "assistente",
            conteudo: m.conteudo,
            util: m.util,
            ferramentas: [],
          })
        )
      );
      setHistoricoAberto(false);
    } finally {
      setCarregandoConversa(false);
    }
  };

  const apagarConversa = async (id: string) => {
    if (apagando !== id) {
      setApagando(id);
      return;
    }
    const resposta = await fetch(`/api/ia/conversas/${id}`, { method: "DELETE" });
    setApagando(null);
    if (!resposta.ok) {
      toast.error("Não foi possível apagar a conversa.");
      return;
    }
    setConversas((lista) => lista?.filter((c) => c.id !== id) ?? null);
    if (conversaId === id) {
      setConversaId(null);
      setMensagens([]);
    }
    toast.success("Conversa apagada.");
  };

  const avaliar = async (mensagem: MensagemTela, util: boolean) => {
    if (!mensagem.id) return;
    atualizarAssistente(mensagem.chave, (m) => ({ ...m, util }));
    const resposta = await fetch(`/api/ia/mensagens/${mensagem.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ util }),
    });
    if (resposta.ok) toast.success(util ? "Obrigado! Isso ajuda o Skubo IA." : "Obrigado pelo aviso. Vamos melhorar essa resposta.");
  };

  const copiar = async (conteudo: string) => {
    try {
      await navigator.clipboard.writeText(conteudo);
      toast.success("Resposta copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const tentarDeNovo = (indice: number) => {
    const pergunta = mensagens[indice - 1];
    if (!pergunta || pergunta.papel !== "usuario") return;
    setMensagens((atuais) => atuais.slice(0, indice - 1));
    enviar(pergunta.conteudo);
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar(texto);
    }
  };

  const conteudoPrincipal = () => {
    if (!acesso) {
      return (
        <div className="space-y-3 p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }
    if (!acesso.configurada || acesso.desligada) return <EstadoIndisponivel acesso={acesso} />;
    if (!acesso.liberada) {
      return (
        <div className="p-4">
          <CartaoVendaIa acesso={acesso} />
        </div>
      );
    }
    if (mensagens.length === 0) {
      return (
        <div className="space-y-4 p-4">
          {acesso.consumo.esgotado && <EstadoLimite acesso={acesso} />}
          <div className="rounded-card border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Pergunte ao Skubo
            </div>
            <p className="mt-1 text-sm text-fg2">
              Respondo com os números da sua loja e digo em qual tela conferir. Tente uma destas:
            </p>
          </div>
          <div className="grid gap-2" role="group" aria-label="Sugestões de pergunta">
            {sugestoes === null
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)
              : sugestoes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    disabled={enviando || acesso.consumo.esgotado}
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
          </div>
        </div>
      );
    }
    return (
      <ol className="space-y-4 p-4" aria-live="polite">
        {mensagens.map((m, indice) =>
          m.papel === "usuario" ? (
            <li key={m.chave} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {m.conteudo}
              </p>
            </li>
          ) : (
            <li key={m.chave} className="space-y-2" data-testid="mensagem-assistente">
              {m.ferramentas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.ferramentas.map((f) => (
                    <Chip key={f.id} chip={f} />
                  ))}
                </div>
              )}
              {m.conteudo ? (
                <MarkdownSeguro texto={m.conteudo} aoNavegar={aoNavegar} />
              ) : m.emAndamento ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
                </p>
              ) : null}
              {m.erro &&
                (m.erro.codigo === "LIMITE" ? (
                  <EstadoLimite acesso={acesso} />
                ) : (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive-text">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{m.erro.mensagem}</span>
                    <Button size="sm" variant="outline" onClick={() => tentarDeNovo(indice)} disabled={enviando} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> Tentar de novo
                    </Button>
                  </div>
                ))}
              {m.id && !m.emAndamento && m.conteudo && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copiar(m.conteudo)} aria-label="Copiar resposta">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", m.util === true && "text-success-text")}
                    onClick={() => avaliar(m, true)}
                    aria-label="Resposta útil"
                    aria-pressed={m.util === true}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", m.util === false && "text-destructive-text")}
                    onClick={() => avaliar(m, false)}
                    aria-label="Resposta não ajudou"
                    aria-pressed={m.util === false}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          )
        )}
      </ol>
    );
  };

  const podeEscrever = Boolean(acesso && utilizavel && !acesso.consumo.esgotado);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-1 border-b border-border/70 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Skubo IA</p>
            {acesso?.liberada && acesso.configurada && <BarraConsumo acesso={acesso} />}
          </div>
        </div>
        {utilizavel && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoricoAberto((v) => !v)}
              aria-label="Histórico de conversas"
              aria-expanded={historicoAberto}
            >
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={novaConversa} aria-label="Nova conversa">
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </>
        )}
        {modo === "lateral" && (
          <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex">
            <Link href="/ia" onClick={aoFechar} aria-label="Abrir em tela cheia">
              <Maximize2 className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {aoFechar && (
          <Button variant="ghost" size="icon" onClick={aoFechar} aria-label="Fechar assistente">
            <X className="h-4 w-4" />
          </Button>
        )}
      </header>

      {historicoAberto && (
        <section className="max-h-[45%] overflow-y-auto border-b border-border/70 bg-muted/30" aria-label="Conversas anteriores">
          {conversas === null ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : conversas.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          ) : (
            <ul className="divide-y divide-divider">
              {conversas.map((c) => (
                <li key={c.id} className={cn("flex items-center gap-2 px-3 py-2", c.id === conversaId && "bg-primary/5")}>
                  <button type="button" onClick={() => abrirConversa(c.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-foreground">{c.titulo || "Conversa"}</p>
                    <p className="text-[11px] text-muted-foreground">{formatRelativeTime(c.updatedAt)}</p>
                  </button>
                  <Button
                    variant={apagando === c.id ? "destructive" : "ghost"}
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    onClick={() => apagarConversa(c.id)}
                    onBlur={() => setApagando((atual) => (atual === c.id ? null : atual))}
                    aria-label={apagando === c.id ? "Confirmar: apagar conversa" : "Apagar conversa"}
                  >
                    {apagando === c.id ? "Apagar" : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div ref={areaMensagens} className="min-h-0 flex-1 overflow-y-auto">
        {carregandoConversa ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-2/3 justify-self-end" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          conteudoPrincipal()
        )}
      </div>

      {podeEscrever && (
        <footer className="border-t border-border/70 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 focus-within:ring-1 focus-within:ring-ring">
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 2000))}
              onKeyDown={aoTeclar}
              rows={1}
              placeholder="Pergunte sobre estoque, vendas, anúncios…"
              aria-label="Pergunta para o Skubo IA"
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {enviando ? (
              <Button size="icon" variant="outline" onClick={parar} aria-label="Parar resposta" className="h-9 w-9 shrink-0 rounded-xl">
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => enviar(texto)}
                disabled={!texto.trim()}
                aria-label="Enviar pergunta"
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
            <Check className="h-3 w-3" /> Enter envia · Shift+Enter quebra linha · a IA pode errar, confira na tela indicada
          </p>
        </footer>
      )}
    </div>
  );
}
