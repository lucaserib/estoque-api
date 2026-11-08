"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  type LucideIcon,
  Plug,
  RefreshCw,
  Sparkles,
  Store,
  Tags,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { AnaliseIaCard } from "@/components/controle/AnaliseIaCard";
import { abrirAssistente, perguntaSobreItemDiagnostico } from "@/components/ia/eventos";
import { useAcessoIa } from "@/components/ia/useAcessoIa";
import { formatBRL, formatNumberBR, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AreaDiagnostico, Diagnostico, Gravidade, ItemDiagnostico } from "@/modules/controle/diagnostico";

const ICONE_AREA: Record<AreaDiagnostico, LucideIcon> = {
  integracoes: Plug,
  estoque: Boxes,
  cadastro: Tags,
  anuncios: Store,
  financeiro: CircleDollarSign,
};

const ROTULO_GRAVIDADE: Record<Gravidade, { texto: string; tom: "critical" | "warning" | "neutral" }> = {
  critica: { texto: "Resolver agora", tom: "critical" },
  atencao: { texto: "Atenção", tom: "warning" },
  informativa: { texto: "Bom saber", tom: "neutral" },
};

const CLASSIFICACAO: Record<Diagnostico["classificacao"], { texto: string; cor: string }> = {
  excelente: { texto: "Excelente", cor: "hsl(var(--success))" },
  boa: { texto: "Boa", cor: "hsl(var(--primary))" },
  regular: { texto: "Regular", cor: "hsl(var(--warning))" },
  critica: { texto: "Crítica", cor: "hsl(var(--destructive))" },
};

function AnelNota({ nota, cor }: { nota: number; cor: string }) {
  const raio = 52;
  const circunferencia = 2 * Math.PI * raio;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90" aria-hidden="true">
      <circle cx="60" cy="60" r={raio} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={raio}
        fill="none"
        stroke={cor}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia * (1 - nota / 100)}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

function CartaoProblema({ item }: { item: ItemDiagnostico }) {
  const { visivel: iaVisivel } = useAcessoIa();
  const Icone = ICONE_AREA[item.area];
  const gravidade = ROTULO_GRAVIDADE[item.gravidade];
  return (
    <li className="card-hover flex flex-col gap-3 rounded-card border border-border/80 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:gap-4">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          item.gravidade === "critica"
            ? "bg-destructive/10 text-destructive-text"
            : item.gravidade === "atencao"
            ? "bg-warning/15 text-warning-text"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{item.titulo}</p>
          {item.quantidade > 1 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-fg2">
              {formatNumberBR(item.quantidade)}
            </span>
          )}
          <StatusPill tone={gravidade.tom}>{gravidade.texto}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-fg2">{item.descricao}</p>
        {item.exemplos.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground" title={item.exemplos.join(", ")}>
            Ex.: {item.exemplos.join(", ")}
          </p>
        )}
        {item.valorEmRisco !== null && item.valorEmRisco > 0 && (
          <p className="mt-1 text-xs font-medium text-foreground">Valor envolvido: {formatBRL(item.valorEmRisco)}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {iaVisivel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => abrirAssistente({ pergunta: perguntaSobreItemDiagnostico(item), enviar: true })}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Perguntar sobre isto
          </Button>
        )}
        <Button asChild variant={item.gravidade === "critica" ? "default" : "outline"} size="sm" className="gap-1.5">
          <Link href={item.acao.href}>
            {item.acao.rotulo}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </li>
  );
}

export default function CentralDeControlePage() {
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState<AreaDiagnostico | "todas">("todas");

  const carregar = useCallback(async (forcar = false) => {
    setCarregando(true);
    setErro(false);
    try {
      const resposta = await fetch(`/api/controle/diagnostico${forcar ? "?atualizar=1" : ""}`);
      if (!resposta.ok) throw new Error();
      setDiagnostico(await resposta.json());
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const itensVisiveis = (diagnostico?.itens ?? []).filter((i) => filtro === "todas" || i.area === filtro);
  const classificacao = diagnostico ? CLASSIFICACAO[diagnostico.classificacao] : null;
  const criticos = diagnostico?.itens.filter((i) => i.gravidade === "critica").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de controle"
        subtitle="Tudo o que pode estar distorcendo seus números ou travando vendas, com o que fazer em cada caso."
        actions={
          <Button variant="outline" size="sm" onClick={() => carregar(true)} disabled={carregando} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
            Analisar de novo
          </Button>
        }
      />

      {!diagnostico && carregando ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[260px] rounded-card" />
          <Skeleton className="h-[260px] rounded-card" />
        </div>
      ) : erro && !diagnostico ? (
        <div className="rounded-card border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Não foi possível analisar agora.{" "}
          <button className="font-medium text-primary hover:underline" onClick={() => carregar(true)}>
            Tentar de novo
          </button>
        </div>
      ) : diagnostico && classificacao ? (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
            <section className="relative overflow-hidden rounded-card border border-border/80 bg-card p-6 shadow-card">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <AnelNota nota={diagnostico.nota} cor={classificacao.cor} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold tabular-nums text-foreground">{diagnostico.nota}</span>
                    <span className="text-[11px] text-muted-foreground">de 100</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saúde da loja</p>
                  <p className="text-xl font-semibold" style={{ color: classificacao.cor }}>
                    {classificacao.texto}
                  </p>
                  <p className="mt-1 text-sm text-fg2">
                    {criticos > 0
                      ? `${criticos} ponto(s) para resolver agora`
                      : diagnostico.itens.length > 0
                      ? "Nada crítico. Veja os ajustes abaixo."
                      : "Tudo em ordem."}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Analisado {formatRelativeTime(diagnostico.geradoEm)} · {formatNumberBR(diagnostico.contexto.produtosAtivos)}{" "}
                produtos · {formatNumberBR(diagnostico.contexto.anunciosAtivos)} anúncios ativos ·{" "}
                {formatNumberBR(diagnostico.contexto.vendasMes)} vendas no mês
              </p>
              {diagnostico.incompleto.length > 0 && (
                <p className="mt-2 text-xs text-warning-text">
                  Não deu para analisar: {diagnostico.incompleto.join(", ")}. Clique em Analisar de novo.
                </p>
              )}
            </section>

            <section className="grid content-start gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
              {diagnostico.areas.map((area) => {
                const Icone = ICONE_AREA[area.area];
                const ativo = filtro === area.area;
                return (
                  <button
                    key={area.area}
                    type="button"
                    onClick={() => setFiltro(ativo ? "todas" : area.area)}
                    aria-pressed={ativo}
                    className={cn(
                      "card-hover flex flex-col rounded-card border bg-card p-4 text-left shadow-card",
                      ativo ? "border-primary ring-2 ring-primary/20" : "border-border/80"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icone className="h-5 w-5 text-primary" />
                      {area.problemas === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-success-text" />
                      ) : (
                        <span className="text-xs font-semibold text-fg2">{area.problemas}</span>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold leading-tight text-foreground">{area.titulo}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            area.nota >= 90 ? "bg-success" : area.nota >= 70 ? "bg-primary" : area.nota >= 45 ? "bg-warning" : "bg-destructive"
                          )}
                          style={{ width: `${Math.max(4, area.nota)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{area.nota}/100</p>
                    </div>
                  </button>
                );
              })}
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <section aria-label="Pontos de atenção" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-foreground">
                  {filtro === "todas" ? "O que resolver" : diagnostico.areas.find((a) => a.area === filtro)?.titulo}
                </h2>
                {filtro !== "todas" && (
                  <button className="text-xs font-medium text-primary hover:underline" onClick={() => setFiltro("todas")}>
                    Ver todas as áreas
                  </button>
                )}
              </div>
              {itensVisiveis.length === 0 ? (
                <div className="flex flex-col items-center rounded-card border border-dashed border-border bg-card/60 px-6 py-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-success-text" />
                  <p className="mt-3 font-semibold text-foreground">Nada pendente aqui</p>
                  <p className="mt-1 text-sm text-muted-foreground">Seus dados estão consistentes nesta área.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {itensVisiveis.map((item) => (
                    <CartaoProblema key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </section>
            <AnaliseIaCard />
          </div>
        </>
      ) : null}

      {carregando && diagnostico && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando análise…
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> A central reaproveita as mesmas regras de Reposição, Produtos, Anúncios e
        Financeiro — corrigiu lá, melhora aqui.
      </p>
    </div>
  );
}
