"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

interface StatusResponse {
  emAndamento: { tipo: string; processados: number; iniciadoEm: string } | null;
  ultimaSincronizacaoConcluidaEm: string | null;
  errosPendentes: number;
}

interface SincronizacaoResponse {
  status: "CONCLUIDO" | "EM_ANDAMENTO";
  processados: number;
  erros: number;
  proximoPasso: "CONTINUAR" | null;
}

interface BotaoAtualizarFinanceiroProps {
  modo: "INCREMENTAL" | "PERIODO";
  desde?: Date;
  ate?: Date;
  onConcluido?: () => void;
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BotaoAtualizarFinanceiro({ modo, desde, ate, onConcluido }: BotaoAtualizarFinanceiroProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const carregarStatus = useCallback(async () => {
    try {
      const resposta = await fetch("/api/financeiro/sincronizacao/status");
      if (!resposta.ok) return;
      setStatus(await resposta.json());
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus]);

  const atualizar = useCallback(async () => {
    setSincronizando(true);
    try {
      let continuar = true;
      while (continuar) {
        const resposta = await fetch("/api/financeiro/sincronizacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modo,
            desde: desde?.toISOString(),
            ate: ate?.toISOString(),
          }),
        });
        if (!resposta.ok) break;
        const resultado: SincronizacaoResponse = await resposta.json();
        continuar = resultado.proximoPasso === "CONTINUAR";
      }
      await carregarStatus();
      onConcluido?.();
    } finally {
      setSincronizando(false);
    }
  }, [modo, desde, ate, carregarStatus, onConcluido]);

  const corSaude: "success" | "warning" | "critical" =
    status && status.errosPendentes > 0
      ? status.errosPendentes > 10
        ? "critical"
        : "warning"
      : "success";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status?.errosPendentes != null && status.errosPendentes > 0 && (
        <StatusPill tone={corSaude}>{status.errosPendentes} pendência(s)</StatusPill>
      )}
      {status?.ultimaSincronizacaoConcluidaEm && (
        <span className="text-xs text-muted-foreground">
          Atualizado em {formatarDataHora(status.ultimaSincronizacaoConcluidaEm)}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={atualizar} disabled={sincronizando}>
        <RefreshCw className={`mr-2 h-4 w-4 ${sincronizando ? "animate-spin" : ""}`} />
        {sincronizando ? "Atualizando…" : "Atualizar dados"}
      </Button>
    </div>
  );
}
