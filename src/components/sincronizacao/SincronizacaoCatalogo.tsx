"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

interface ProgressoEtapa {
  feitos: number;
  total: number;
  erros: number;
  ultimoErro?: string;
}

interface StatusCatalogo {
  emAndamento: boolean;
  etapa: "BLING_PRODUTOS" | "BLING_ESTOQUE" | "ML_ANUNCIOS" | "FULL_ESTOQUE" | null;
  progresso: Partial<Record<string, ProgressoEtapa>>;
  concluidoEm: string | null;
  erro: string | null;
  bling: { conectado: boolean; ultimaSincronizacaoEstoque: string | null } | null;
  mercadoLivre: { conectado: boolean; anuncios: number; anunciosComErro: number } | null;
}

const ROTULO_ETAPA: Record<string, string> = {
  BLING_PRODUTOS: "Lendo produtos do Bling",
  BLING_ESTOQUE: "Lendo estoque do Bling",
  ML_ANUNCIOS: "Lendo anúncios e estoque Full do ML",
  FULL_ESTOQUE: "Gravando estoque Full",
};

const RODADAS_MAXIMAS = 30;

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  onConcluido?: () => void;
  compacto?: boolean;
}

/**
 * Mantém produtos, estoque local (Bling), anúncios e estoque Full (ML)
 * atualizados: ao abrir a tela, pede ao servidor para sincronizar se a última
 * atualização tiver mais de 6 h e continua chamando enquanto houver etapa
 * pendente. "Atualizar estoque agora" força uma rodada nova.
 */
export function SincronizacaoCatalogo({ onConcluido, compacto }: Props) {
  const [status, setStatus] = useState<StatusCatalogo | null>(null);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emExecucao = useRef(false);
  const onConcluidoRef = useRef(onConcluido);
  onConcluidoRef.current = onConcluido;

  const executar = useCallback(async (forcar: boolean) => {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setRodando(true);
    setErro(null);
    let houveRodada = false;
    try {
      for (let rodada = 0; rodada < RODADAS_MAXIMAS; rodada++) {
        const resposta = await fetch("/api/catalogo/sincronizacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forcar: forcar && rodada === 0 }),
        });
        const corpo = await resposta.json().catch(() => null);
        if (!resposta.ok) {
          setErro(corpo?.error ?? "Não foi possível atualizar o estoque agora.");
          break;
        }
        setStatus(corpo);
        if (!corpo.emAndamento) break;
        houveRodada = true;
      }
    } finally {
      emExecucao.current = false;
      setRodando(false);
      if (houveRodada) onConcluidoRef.current?.();
    }
  }, []);

  useEffect(() => {
    executar(false);
  }, [executar]);

  const etapa = status?.etapa;
  const progresso = etapa ? status?.progresso[etapa] : null;
  const textoProgresso = etapa
    ? `${ROTULO_ETAPA[etapa] ?? "Sincronizando"}${progresso && progresso.total > 0 ? ` · ${progresso.feitos}/${progresso.total}` : ""}`
    : null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {textoProgresso && (
        <StatusPill tone="info">
          <RefreshCw className="mr-1 inline h-3 w-3 animate-spin" />
          {textoProgresso}
        </StatusPill>
      )}
      {!textoProgresso && status?.concluidoEm && !compacto && (
        <StatusPill tone="success">
          <CheckCircle2 className="mr-1 inline h-3 w-3" />
          Estoque e anúncios atualizados · {formatarHora(status.concluidoEm)}
        </StatusPill>
      )}
      {status?.erro && !textoProgresso && (
        <StatusPill tone="warning" title={status.erro}>
          Parte da atualização falhou
        </StatusPill>
      )}
      {erro && <StatusPill tone="critical">{erro}</StatusPill>}
      <Button variant="outline" size="sm" className="gap-2" disabled={rodando} onClick={() => executar(true)}>
        <RefreshCw className={`h-4 w-4 ${rodando ? "animate-spin" : ""}`} />
        {rodando ? "Atualizando…" : "Atualizar estoque agora"}
      </Button>
    </div>
  );
}
