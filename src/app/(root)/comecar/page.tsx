"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  Lock,
  AlertTriangle,
  Circle,
  ArrowRight,
  Clock,
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

function AnelProgresso({ pontuacao }: { pontuacao: number }) {
  const raio = 52;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia * (1 - pontuacao / 100);

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={raio} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={raio}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{pontuacao}%</span>
        <span className="text-[11px] text-muted-foreground">configurado</span>
      </div>
    </div>
  );
}

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
        "flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between",
        bloqueada && "opacity-60"
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

export default function ComecarPage() {
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

  if (erro) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
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
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
        <PageHeader title="Configurar minha loja" subtitle="O que falta pra tirar o máximo do Skubo" />
        <Skeleton className="h-32 rounded-card" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Configurar minha loja"
        subtitle="O que falta pra tirar o máximo do Skubo"
        actions={
          <Button variant="outline" size="sm" onClick={() => setSpotlightAberto(true)}>
            Ver onde fica cada coisa
          </Button>
        }
      />

      <Spotlight open={spotlightAberto} onOpenChange={setSpotlightAberto} />

      <div className="flex flex-col items-center gap-5 rounded-card border border-border bg-card-gradient p-6 shadow-card sm:flex-row">
        <AnelProgresso pontuacao={dados.pontuacao} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <CubeMark className="h-6 w-6" />
            <span className="font-display text-lg font-semibold text-foreground">Nível {dados.nivel}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{DESCRICAO_NIVEL[dados.nivel]}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {NIVEIS.map((nivel) => (
              <span
                key={nivel}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  NIVEIS.indexOf(nivel) <= NIVEIS.indexOf(dados.nivel)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {nivel}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {dados.etapas.map((etapa) => (
          <CartaoEtapa
            key={etapa.id}
            etapa={etapa}
            onPular={pular}
            onAcao={etapa.id === 4 ? () => setSincronizacaoAberta(true) : undefined}
          />
        ))}
      </div>

      <SincronizacaoCatalogoModal
        open={sincronizacaoAberta}
        onOpenChange={setSincronizacaoAberta}
        onConcluido={carregar}
      />

      <div className="flex justify-end">
        <Button variant="ghost" asChild>
          <Link href="/dashboard">Ir para a Visão geral</Link>
        </Button>
      </div>
    </div>
  );
}
