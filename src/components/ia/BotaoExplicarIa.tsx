"use client";

import { useState } from "react";
import { Loader2, MessageCircle, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import { abrirAssistente, abrirVendaIa } from "./eventos";
import { MarkdownSeguro } from "./MarkdownSeguro";
import { recarregarAcessoIa, useAcessoIa } from "./useAcessoIa";

export type PedidoExplicacao =
  | { tipo: "reposicao"; produtoId: string }
  | { tipo: "produto"; produtoId: string }
  | { tipo: "variacao"; periodo: PeriodoVariacaoIa }
  | { tipo: "anuncios" };

export type PeriodoVariacaoIa = "mes-atual" | "mes-anterior" | "7" | "30" | "90" | "hoje";

type Resultado =
  | { tipo: "reposicao" | "produto"; texto: string }
  | { tipo: "variacao"; resumo: string; motivos: Array<{ titulo: string; detalhe: string }> }
  | { tipo: "anuncios"; resumo: string; acoes: Array<{ titulo: string; detalhe: string; impacto: "alto" | "medio" | "baixo" }> };

const TOM_IMPACTO = { alto: "critical", medio: "warning", baixo: "neutral" } as const;

export function BotaoExplicarIa({
  pedido,
  rotulo,
  perguntaAssistente,
  className,
  tamanho = "sm",
  alinhamento = "end",
}: {
  pedido: PedidoExplicacao;
  rotulo: string;
  perguntaAssistente?: string;
  className?: string;
  tamanho?: "sm" | "xs";
  alinhamento?: "start" | "center" | "end";
}) {
  const { acesso, visivel, utilizavel } = useAcessoIa();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!visivel || !acesso) return null;

  const gerar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/ia/explicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        if (corpo?.codigo === "LIMITE" || corpo?.codigo === "NAO_CONTRATADA") recarregarAcessoIa();
        setErro(corpo?.error ?? "Não consegui explicar agora. Tente de novo em instantes.");
        return;
      }
      setResultado(corpo as Resultado);
    } finally {
      setCarregando(false);
    }
  };

  const aoAbrir = (abrir: boolean) => {
    if (abrir && !utilizavel) {
      abrirVendaIa();
      return;
    }
    setAberto(abrir);
    if (abrir && !resultado && !carregando) gerar();
  };

  return (
    <Popover open={aberto} onOpenChange={aoAbrir}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 text-primary hover:bg-primary/10 hover:text-primary",
            tamanho === "xs" && "h-7 px-2 text-xs",
            className
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {rotulo}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={alinhamento} className="w-[min(92vw,380px)] space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Skubo IA
        </p>
        {carregando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo os números…
          </p>
        ) : erro ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive-text">{erro}</p>
            <Button size="sm" variant="outline" onClick={gerar} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Tentar de novo
            </Button>
          </div>
        ) : resultado ? (
          <div className="space-y-3" data-testid="explicacao-ia">
            {"texto" in resultado && <MarkdownSeguro texto={resultado.texto} />}
            {resultado.tipo === "variacao" && (
              <>
                {resultado.resumo && <p className="text-sm text-foreground">{resultado.resumo}</p>}
                <ol className="space-y-2">
                  {resultado.motivos.map((m, i) => (
                    <li key={`${m.titulo}-${i}`} className="rounded-lg border border-border/70 p-2.5">
                      <p className="text-sm font-semibold text-foreground">
                        {i + 1}. {m.titulo}
                      </p>
                      <p className="mt-0.5 text-xs text-fg2">{m.detalhe}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {resultado.tipo === "anuncios" && (
              <>
                {resultado.resumo && <p className="text-sm text-foreground">{resultado.resumo}</p>}
                <ol className="space-y-2">
                  {resultado.acoes.map((a, i) => (
                    <li key={`${a.titulo}-${i}`} className="rounded-lg border border-border/70 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {i + 1}. {a.titulo}
                        </p>
                        <StatusPill tone={TOM_IMPACTO[a.impacto]}>{a.impacto}</StatusPill>
                      </div>
                      <p className="mt-0.5 text-xs text-fg2">{a.detalhe}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <p className="text-[11px] text-muted-foreground">A IA pode errar: confira os números na própria tela.</p>
          </div>
        ) : null}
        {perguntaAssistente && !carregando && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => {
              setAberto(false);
              abrirAssistente({ pergunta: perguntaAssistente, enviar: true });
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Continuar no assistente
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
