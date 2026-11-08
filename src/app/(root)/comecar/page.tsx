"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  Lock,
  AlertTriangle,
  Circle,
  ArrowRight,
  Clock,
  BookOpen,
  Compass,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { CubeMark } from "@/components/brand/Logo";
import { Spotlight } from "@/components/onboarding/Spotlight";
import { SincronizacaoCatalogoModal } from "@/components/sincronizacao/SincronizacaoCatalogoModal";
import type { EtapaOnboarding, Nivel, ResultadoOnboarding, StatusEtapa } from "@/modules/onboarding/etapas";

const NIVEIS: Nivel[] = ["Caixa", "Prateleira", "Depósito", "Centro de Distribuição"];

const DESCRICAO_NIVEL: Record<Nivel, string> = {
  Caixa: "O básico guardado: Mercado Livre e Bling conectados.",
  Prateleira: "Seus anúncios já batem com o estoque certo.",
  Depósito: "Custo e fornecedor prontos pra calcular margem de verdade.",
  "Centro de Distribuição": "Loja 100% configurada.",
};

const ICONE_STATUS: Record<StatusEtapa, { Icon: typeof CheckCircle2; cor: string }> = {
  feito: { Icon: CheckCircle2, cor: "text-success-text" },
  atencao: { Icon: AlertTriangle, cor: "text-warning-text" },
  bloqueado: { Icon: Lock, cor: "text-muted-foreground/60" },
  pendente: { Icon: Circle, cor: "text-muted-foreground/60" },
};

function CartaoEtapa({
  etapa,
  onPular,
  onAcao,
}: {
  etapa: EtapaOnboarding;
  onPular: (etapa: EtapaOnboarding) => void;
  onAcao?: () => void;
}) {
  const { Icon, cor } = ICONE_STATUS[etapa.status];
  const bloqueada = etapa.status === "bloqueado";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
        bloqueada && "opacity-60",
        etapa.status === "feito" && "bg-muted/40"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", cor)} strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{etapa.titulo}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{etapa.porque}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {etapa.progresso && etapa.progresso.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.round((etapa.progresso.feito / etapa.progresso.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {etapa.progresso.feito}/{etapa.progresso.total}
                </span>
              </div>
            )}
            <span className="flex items-center gap-1 text-xs text-faint">
              <Clock className="h-3 w-3" /> {etapa.minutosEstimados} min
            </span>
          </div>
        </div>
      </div>

      {!bloqueada && (
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {etapa.pulavel && etapa.status !== "feito" && (
            <Button variant="ghost" size="sm" onClick={() => onPular(etapa)}>
              Pular
            </Button>
          )}
          {onAcao ? (
            <Button variant={etapa.status === "feito" ? "outline" : "default"} size="sm" className="gap-1.5" onClick={onAcao}>
              {etapa.acao.rotulo}
              {etapa.status !== "feito" && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          ) : (
            <Button asChild variant={etapa.status === "feito" ? "outline" : "default"} size="sm" className="gap-1.5">
              <Link href={etapa.acao.href}>
                {etapa.acao.rotulo}
                {etapa.status !== "feito" && <ArrowRight className="h-3.5 w-3.5" />}
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const FASES: Array<{ titulo: string; descricao: string; ids: number[] }> = [
  { titulo: "Conectar", descricao: "Ligue o Skubo às suas contas.", ids: [1, 2, 3] },
  { titulo: "Catálogo e estoque", descricao: "Produtos, vínculos, custos e fornecedores.", ids: [4, 5, 6, 7] },
  { titulo: "Financeiro", descricao: "Impostos, despesas, meta e saldo.", ids: [8, 9, 10, 11] },
  { titulo: "No dia a dia", descricao: "Leve o Skubo no bolso.", ids: [12] },
];

export default function ComecarPage() {
  const { data: session } = useSession();
  const [dados, setDados] = useState<ResultadoOnboarding | null>(null);
  const [erro, setErro] = useState(false);
  const [spotlightAberto, setSpotlightAberto] = useState(false);
  const [sincronizacaoAberta, setSincronizacaoAberta] = useState(false);
  const pontuacaoAnterior = useRef<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error();
      const novo: ResultadoOnboarding = await res.json();
      setErro(false);

      if (pontuacaoAnterior.current !== null && novo.pontuacao > pontuacaoAnterior.current) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
      }
      pontuacaoAnterior.current = novo.pontuacao;
      setDados(novo);
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pular = useCallback(
    async (etapa: EtapaOnboarding) => {
      const marcador = etapa.id === 12 ? "12_instalado" : String(etapa.id);
      await fetch("/api/onboarding/pular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marcador }),
      }).catch(() => {});
      carregar();
    },
    [carregar]
  );

  const primeiroNome = session?.user?.name?.split(" ")[0];

  if (erro) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Configurar minha loja" subtitle="O que falta pra tirar o máximo do Skubo" />
        <ErrorState
          title="Não deu pra carregar sua jornada de configuração"
          description="Tente de novo — se continuar falhando, confira sua conexão."
          onRetry={carregar}
        />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-44 rounded-card" />
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    );
  }

  const proxima = dados.etapas.find((e) => e.status === "pendente" || e.status === "atencao");
  const concluidas = dados.etapas.filter((e) => e.status === "feito").length;
  const acaoDa = (etapa: EtapaOnboarding) => (etapa.id === 4 ? () => setSincronizacaoAberta(true) : undefined);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Spotlight open={spotlightAberto} onOpenChange={setSpotlightAberto} />

      <section className="bg-hero relative overflow-hidden rounded-card p-6 text-white shadow-lift sm:p-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-white/80">
              {dados.pontuacao === 100 ? "Tudo pronto" : primeiroNome ? `Olá, ${primeiroNome}` : "Bem-vindo ao Skubo"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold leading-tight sm:text-[28px]">
              {dados.pontuacao === 100
                ? "Sua loja está 100% configurada."
                : "Vamos deixar sua loja no controle em poucos minutos."}
            </h1>
            <p className="mt-2 text-sm text-white/80">
              {concluidas} de {dados.etapas.length} passos feitos · Nível {dados.nivel}: {DESCRICAO_NIVEL[dados.nivel]}
            </p>
            {proxima && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {acaoDa(proxima) ? (
                  <Button onClick={acaoDa(proxima)} className="gap-2 bg-white text-primary hover:bg-white/90">
                    {proxima.titulo}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button asChild className="gap-2 bg-white text-primary hover:bg-white/90">
                    <Link href={proxima.acao.href}>
                      {proxima.titulo}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <span className="flex items-center gap-1 text-xs text-white/75">
                  <Clock className="h-3.5 w-3.5" /> cerca de {proxima.minutosEstimados} min
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-24 w-24 -rotate-90" aria-hidden="true">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#45F0C0"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 * (1 - dados.pontuacao / 100)}
                  className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
              <span className="absolute text-xl font-semibold tabular-nums">{dados.pontuacao}%</span>
            </div>
            <div className="space-y-1">
              {NIVEIS.map((nivel) => (
                <p
                  key={nivel}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    NIVEIS.indexOf(nivel) <= NIVEIS.indexOf(dados.nivel) ? "text-white" : "text-white/50"
                  )}
                >
                  <CubeMark mono className="h-3.5 w-3.5" />
                  {nivel}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {FASES.map((fase, indiceFase) => {
            const etapas = dados.etapas.filter((e) => fase.ids.includes(e.id));
            if (etapas.length === 0) return null;
            const feitas = etapas.filter((e) => e.status === "feito").length;
            return (
              <section key={fase.titulo} aria-labelledby={`fase-${indiceFase}`}>
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      feitas === etapas.length ? "bg-success text-white" : "bg-primary/10 text-primary"
                    )}
                  >
                    {feitas === etapas.length ? <CheckCircle2 className="h-4 w-4" /> : indiceFase + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id={`fase-${indiceFase}`} className="text-[15px] font-semibold text-foreground">
                      {fase.titulo}
                    </h2>
                    <p className="text-xs text-muted-foreground">{fase.descricao}</p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {feitas}/{etapas.length}
                  </span>
                </div>
                <div className="space-y-2 border-l-2 border-dashed border-border/80 pl-4 ml-3.5">
                  {etapas.map((etapa) => (
                    <CartaoEtapa key={etapa.id} etapa={etapa} onPular={pular} onAcao={acaoDa(etapa)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-card border border-border/80 bg-card p-5 shadow-card">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> O que você ganha
            </p>
            <ul className="mt-3 space-y-2 text-sm text-fg2">
              <li>Lucro real por venda, com tarifa, frete e imposto.</li>
              <li>Aviso antes do estoque acabar, local e Full.</li>
              <li>Pedido de compra pronto por fornecedor.</li>
              <li>Faturamento com frete e notas do Bling.</li>
            </ul>
          </div>
          <div className="rounded-card border border-border/80 bg-card p-2 shadow-card">
            <button
              type="button"
              onClick={() => setSpotlightAberto(true)}
              className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm hover:bg-muted"
            >
              <Compass className="h-4 w-4 text-primary" />
              Ver onde fica cada coisa
            </button>
            <Link href="/ajuda/manual" className="flex items-center gap-3 rounded-xl p-3 text-sm hover:bg-muted">
              <BookOpen className="h-4 w-4 text-primary" /> Manual do Skubo
            </Link>
            <Link href="/ajuda/celular" className="flex items-center gap-3 rounded-xl p-3 text-sm hover:bg-muted">
              <Smartphone className="h-4 w-4 text-primary" /> Instalar no celular
            </Link>
          </div>
          <Button variant="outline" asChild className="w-full">
            <Link href="/">Ir para a Visão geral</Link>
          </Button>
        </aside>
      </div>

      <SincronizacaoCatalogoModal open={sincronizacaoAberta} onOpenChange={setSincronizacaoAberta} onConcluido={carregar} />
    </div>
  );
}
