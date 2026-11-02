"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EtapaOnboarding, ResultadoOnboarding } from "@/modules/onboarding/etapas";

const LIMITE_PONTUACAO = 90;

function proximaEtapa(etapas: EtapaOnboarding[]): EtapaOnboarding | null {
  return etapas.find((e) => e.status === "pendente" || e.status === "atencao") ?? null;
}

/** Fixo no topo da Visão geral enquanto a configuração não passar de 90%. */
export function ProximoPassoCard() {
  const [dados, setDados] = useState<ResultadoOnboarding | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/onboarding")
      .then((res) => (res.ok ? res.json() : null))
      .then((dados) => {
        if (ativo) setDados(dados);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  if (!dados || dados.pontuacao >= LIMITE_PONTUACAO) return null;

  const proxima = proximaEtapa(dados.etapas);
  if (!proxima) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-primary/20 bg-card-gradient p-4 shadow-card">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Compass className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Sua loja está {dados.pontuacao}% configurada — próximo passo
          </p>
          <p className="truncate font-medium text-foreground">{proxima.titulo}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/comecar">Ver jornada completa</Link>
        </Button>
        <Button asChild size="sm" className="gap-1.5">
          <Link href={proxima.acao.href}>
            {proxima.acao.rotulo}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
