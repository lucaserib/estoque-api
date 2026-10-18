"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { useSincronizacaoFinanceira, type StatusSincronizacao } from "./SincronizacaoFinanceira";

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

export function descreverProgresso(status: StatusSincronizacao | null): string | null {
  if (!status || !status.contaConectada) return null;
  const tarefa = status.tarefas[0];
  if (tarefa) {
    if (tarefa.tipo === "PEDIDOS_PERIODO") {
      return `Importando vendas${tarefa.mesAtual ? ` de ${tarefa.mesAtual}` : ""} · ${tarefa.processados.toLocaleString("pt-BR")} pedidos lidos`;
    }
    if (tarefa.tipo === "PEDIDOS_INCREMENTAL") return "Buscando vendas novas e alteradas";
    if (tarefa.tipo === "COBRANCAS") return "Lendo a fatura do Mercado Livre";
    if (tarefa.tipo === "ADS") return "Lendo gastos de publicidade";
    return "Sincronizando";
  }
  if (status.vendasAguardandoDetalhes > 0) {
    return `Detalhando ${status.vendasAguardandoDetalhes.toLocaleString("pt-BR")} venda(s): tarifa, frete e liberação`;
  }
  return null;
}

export function BotaoAtualizarFinanceiro({ modo, desde, ate }: BotaoAtualizarFinanceiroProps) {
  const { status, processando, atualizando, erro, atualizar } = useSincronizacaoFinanceira();
  const progresso = descreverProgresso(status);
  const ocupado = atualizando || processando;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status && !status.contaConectada && (
        <StatusPill tone="warning">
          <Link href="/integracoes" className="underline">
            Conecte o Mercado Livre
          </Link>
        </StatusPill>
      )}
      {progresso && (
        <StatusPill tone="info">
          <RefreshCw className={`mr-1 inline h-3 w-3 ${ocupado ? "animate-spin" : ""}`} />
          {progresso}
        </StatusPill>
      )}
      {status?.contaConectada && !progresso && !ocupado && (
        <StatusPill tone="success">
          <CheckCircle2 className="mr-1 inline h-3 w-3" />
          Dados em dia
          {status.ultimaAtualizacaoEm ? ` · ${formatarDataHora(status.ultimaAtualizacaoEm)}` : ""}
        </StatusPill>
      )}
      {status && status.vendasComFalhaDeDetalhe > 0 && (
        <StatusPill tone="warning">
          <Link href="/financeiro/vendas?aguardandoDetalhes=true" className="underline">
            {status.vendasComFalhaDeDetalhe} venda(s) sem detalhe do pagamento
          </Link>
        </StatusPill>
      )}
      {status?.alertaWebhooksAusentes && (
        <StatusPill tone="warning">Notificações do ML não estão chegando</StatusPill>
      )}
      {erro && <StatusPill tone="critical">{erro}</StatusPill>}
      <Button
        variant="outline"
        size="sm"
        onClick={() => atualizar({ modo, desde, ate })}
        disabled={atualizando}
        title={
          modo === "PERIODO"
            ? "Busca de novo no Mercado Livre todos os pedidos do período exibido"
            : "Busca as vendas novas e alteradas desde a última atualização"
        }
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${atualizando ? "animate-spin" : ""}`} />
        {atualizando ? "Atualizando…" : modo === "PERIODO" ? "Reprocessar período" : "Atualizar dados"}
      </Button>
    </div>
  );
}
