"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHAVE_FECHADO = "skubo-indique-fechado-ate";
const CHAVE_DIAS = "skubo-dias-de-uso";
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

function semanaIso(data: Date): string {
  const copia = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const dia = copia.getUTCDay() || 7;
  copia.setUTCDate(copia.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(copia.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((copia.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
  return `${copia.getUTCFullYear()}-${semana}`;
}

function diasDeUsoNaSemana(): number {
  try {
    const hoje = new Date();
    const semana = semanaIso(hoje);
    const dia = hoje.toLocaleDateString("en-CA");
    const salvo = JSON.parse(localStorage.getItem(CHAVE_DIAS) ?? "{}") as { semana?: string; dias?: string[] };
    const dias = salvo.semana === semana ? new Set(salvo.dias ?? []) : new Set<string>();
    dias.add(dia);
    localStorage.setItem(CHAVE_DIAS, JSON.stringify({ semana, dias: [...dias] }));
    return dias.size;
  } catch {
    return 0;
  }
}

function fechadoAgora(): boolean {
  try {
    return Number(localStorage.getItem(CHAVE_FECHADO) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function CartaoPedirIndicacao({ forcar = false, className }: { forcar?: boolean; className?: string }) {
  const [dias, setDias] = useState<number | null>(null);

  useEffect(() => {
    if (fechadoAgora()) return;
    const usoNaSemana = diasDeUsoNaSemana();
    fetch("/api/indicacao")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((painel) => {
        if (!painel?.regras?.ativo || !painel.emailVerificado) return;
        const momento = forcar || painel.momentos?.primeiraSincronizacao || painel.momentos?.primeiroResumo || usoNaSemana >= 3;
        if (momento) setDias(painel.regras.diasRecompensa);
      })
      .catch(() => {});
  }, [forcar]);

  if (dias === null) return null;

  const fechar = () => {
    try {
      localStorage.setItem(CHAVE_FECHADO, String(Date.now() + TRINTA_DIAS_MS));
    } catch {}
    setDias(null);
  };

  return (
    <div
      data-testid="cartao-pedir-indicacao"
      className={cn("flex items-center gap-3 rounded-card border border-success/25 bg-success/[0.06] px-4 py-3", className)}
    >
      <Gift className="h-5 w-5 shrink-0 text-success-text" />
      <p className="min-w-0 flex-1 text-sm text-foreground">
        Gostando do Skubo? Indique para outro lojista e ganhe <strong>{dias} dias grátis</strong> por loja que assinar.
      </p>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href="/indique">Indicar</Link>
      </Button>
      <button type="button" onClick={fechar} aria-label="Fechar" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
