"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { abrirVendaIa } from "@/components/ia/eventos";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Prioridade {
  titulo: string;
  porque: string;
  acao: string;
  impacto: "alto" | "medio" | "baixo";
}

interface Conteudo {
  resumo: string;
  prioridades: Prioridade[];
  riscos: string[];
  oportunidades: string[];
}

interface Analise {
  id: string;
  createdAt: string;
  tipo: "CONTROLE" | "SEMANAL";
  notaDiagnostico: number;
  conteudo: Conteudo;
}

interface Estado {
  acesso: {
    configurada: boolean;
    desligada: boolean;
    liberada: boolean;
    consumo: { percentual: number; esgotado: boolean };
  };
  historico: Analise[];
}

const TOM_IMPACTO = { alto: "critical", medio: "warning", baixo: "neutral" } as const;
const BENEFICIOS = [
  "Prioridades do mês ordenadas pelo impacto em dinheiro",
  "Leitura de margem, frete, tarifa e ads vs mês anterior",
  "Riscos de ruptura e capital parado explicados",
  "Plano de ação apontando a tela certa do Skubo",
];

export function AnaliseIaCard() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    const resposta = await fetch("/api/controle/ia");
    if (resposta.status === 403) {
      setIndisponivel(true);
      return;
    }
    if (resposta.ok) setEstado(await resposta.json());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const gerar = async () => {
    setGerando(true);
    try {
      const resposta = await fetch("/api/controle/ia", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(corpo?.error ?? "Não foi possível gerar a análise agora.");
        return;
      }
      await carregar();
      toast.success("Análise pronta.");
    } finally {
      setGerando(false);
    }
  };

  if (indisponivel) return null;

  const ultima = estado?.historico[0];

  return (
    <aside className="h-fit overflow-hidden rounded-card border border-border/80 bg-card shadow-card">
      <div className="bg-hero px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <p className="text-sm font-semibold">Análise com IA</p>
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">Plano com IA</span>
        </div>
        <p className="mt-1 text-xs text-white/80">Um analista que lê seus números e diz o que fazer primeiro.</p>
      </div>

      {!estado ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : !estado.acesso.liberada ? (
        <div className="space-y-4 p-5">
          <ul className="space-y-2">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-fg2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
                {b}
              </li>
            ))}
          </ul>
          <Button onClick={abrirVendaIa} className="w-full gap-2">
            <Lock className="h-4 w-4" />
            Ativar o Skubo IA
          </Button>
        </div>
      ) : !estado.acesso.configurada || estado.acesso.desligada ? (
        <p className="p-5 text-sm text-muted-foreground">
          A IA está indisponível no momento. Volte em instantes.
        </p>
      ) : (
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{estado.acesso.consumo.percentual}% do uso de IA do mês</span>
            {ultima && (
              <span>
                {ultima.tipo === "SEMANAL" ? "resumo semanal" : "última"} {formatRelativeTime(ultima.createdAt)}
              </span>
            )}
          </div>
          <Button
            onClick={gerar}
            disabled={gerando || estado.acesso.consumo.esgotado}
            className="w-full gap-2"
          >
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {gerando ? "Analisando sua loja…" : ultima ? "Gerar nova análise" : "Gerar primeira análise"}
          </Button>

          {ultima && (
            <div className="space-y-4">
              {ultima.conteudo.resumo && <p className="text-sm leading-relaxed text-foreground">{ultima.conteudo.resumo}</p>}
              {ultima.conteudo.prioridades.length > 0 && (
                <ol className="space-y-3">
                  {ultima.conteudo.prioridades.map((p, i) => (
                    <li key={`${p.titulo}-${i}`} className="rounded-xl border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {i + 1}. {p.titulo}
                        </p>
                        <StatusPill tone={TOM_IMPACTO[p.impacto]}>{p.impacto}</StatusPill>
                      </div>
                      {p.porque && <p className="mt-1 text-xs text-fg2">{p.porque}</p>}
                      {p.acao && <p className="mt-1.5 text-xs font-medium text-primary">→ {p.acao}</p>}
                    </li>
                  ))}
                </ol>
              )}
              {[
                { titulo: "Riscos", itens: ultima.conteudo.riscos, cor: "text-destructive-text" },
                { titulo: "Oportunidades", itens: ultima.conteudo.oportunidades, cor: "text-success-text" },
              ]
                .filter((bloco) => bloco.itens.length > 0)
                .map((bloco) => (
                  <div key={bloco.titulo}>
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", bloco.cor)}>{bloco.titulo}</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-fg2">
                      {bloco.itens.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
