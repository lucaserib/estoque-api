"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

interface StatusResponse {
  emAndamento: { tipo: string; processados: number; status: string } | null;
  ultimaSincronizacaoConcluidaEm: string | null;
  errosPendentes: number;
  alertaWebhooksAusentes: boolean;
}

const ROTULO_TIPO_TAREFA: Record<string, string> = {
  PEDIDOS_PERIODO: "Importando suas vendas",
  PEDIDOS_INCREMENTAL: "Atualizando vendas recentes",
};

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
  const onConcluidoRef = useRef(onConcluido);
  onConcluidoRef.current = onConcluido;

  const carregarStatus = useCallback(async (): Promise<StatusResponse | null> => {
    try {
      const resposta = await fetch("/api/financeiro/sincronizacao/status");
      if (!resposta.ok) return null;
      const dados: StatusResponse = await resposta.json();
      setStatus(dados);
      return dados;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    let processadosAntes = -1;

    const acompanhar = async () => {
      while (!cancelado) {
        const dados = await carregarStatus();
        if (!dados?.emAndamento) break;
        if (dados.emAndamento.processados === processadosAntes) break;
        processadosAntes = dados.emAndamento.processados;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelado) onConcluidoRef.current?.();
    };

    acompanhar();
    return () => {
      cancelado = true;
    };
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
      {status?.emAndamento && (
        <StatusPill tone="info">
          <RefreshCw className="mr-1 inline h-3 w-3 animate-spin" />
          {ROTULO_TIPO_TAREFA[status.emAndamento.tipo] ?? "Sincronizando"}: {status.emAndamento.processados} pedido(s)
        </StatusPill>
      )}
      {status?.alertaWebhooksAusentes && (
        <StatusPill tone="warning">
          Notificações do ML não estão chegando — confira a URL e os tópicos no app do ML
        </StatusPill>
      )}
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
