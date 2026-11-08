"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { podeVer } from "@/lib/permissoes";

export interface TarefaSincronizacao {
  id: string;
  tipo: "PEDIDOS_PERIODO" | "PEDIDOS_INCREMENTAL" | "ADS" | "COBRANCAS" | string;
  status: string;
  processados: number;
  mesAtual: string | null;
  erro: string | null;
}

export interface StatusSincronizacao {
  contaConectada: boolean;
  pendente: boolean;
  tarefas: TarefaSincronizacao[];
  vendasAguardandoDetalhes: number;
  vendasComFalhaDeDetalhe: number;
  ultimaAtualizacaoEm: string | null;
  processandoAgora: boolean;
  ultimoWebhookPorTopico: Record<string, string | null>;
  alertaWebhooksAusentes: boolean;
  errosPendentes: number;
}

export interface ParametrosAtualizacao {
  modo: "INCREMENTAL" | "PERIODO" | "BACKFILL";
  desde?: Date;
  ate?: Date;
}

interface ValorContexto {
  status: StatusSincronizacao | null;
  processando: boolean;
  atualizando: boolean;
  erro: string | null;
  versaoDados: number;
  atualizar: (parametros: ParametrosAtualizacao) => Promise<void>;
  recarregarStatus: () => Promise<StatusSincronizacao | null>;
  sinalizarDadosAlterados: () => void;
}

const ContextoSincronizacao = createContext<ValorContexto | null>(null);

const RODADAS_MAXIMAS = 60;
const INTERVALO_STATUS_MS = 60000;

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SincronizacaoFinanceiraProvider({ children }: { children: ReactNode }) {
  const { data: session, status: statusSessao } = useSession();
  const papel = session?.user?.role;
  const habilitado = statusSessao === "authenticated" && Boolean(papel && podeVer(papel, "FINANCEIRO_VER"));

  const [status, setStatus] = useState<StatusSincronizacao | null>(null);
  const [processando, setProcessando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versaoDados, setVersaoDados] = useState(0);
  const emExecucao = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const recarregarStatus = useCallback(async (): Promise<StatusSincronizacao | null> => {
    try {
      const resposta = await fetch("/api/financeiro/sincronizacao/status", { cache: "no-store" });
      if (!resposta.ok) return null;
      const dados: StatusSincronizacao = await resposta.json();
      if (montado.current) setStatus(dados);
      return dados;
    } catch {
      return null;
    }
  }, []);

  const processarFila = useCallback(async () => {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setProcessando(true);
    setErro(null);
    try {
      for (let rodada = 0; rodada < RODADAS_MAXIMAS && montado.current; rodada++) {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") break;
        const resposta = await fetch("/api/financeiro/sincronizacao/processar", { method: "POST" });
        if (!resposta.ok) {
          const corpo = await resposta.json().catch(() => null);
          setErro(corpo?.error ?? "Não foi possível continuar a sincronização agora.");
          break;
        }
        const dados: {
          resultado: { status: string; processados: number; vendasDetalhadas: number };
          status: StatusSincronizacao;
        } = await resposta.json();
        if (!montado.current) break;
        setStatus(dados.status);
        if (dados.resultado.processados > 0 || dados.resultado.vendasDetalhadas > 0) {
          setVersaoDados((v) => v + 1);
        }
        if (!dados.status.pendente) break;
        if (dados.resultado.status === "OCUPADO") await esperar(8000);
        else if (dados.resultado.status === "ERRO") await esperar(4000);
      }
    } finally {
      emExecucao.current = false;
      if (montado.current) setProcessando(false);
    }
  }, []);

  useEffect(() => {
    if (!habilitado) return;
    let cancelado = false;

    const verificar = async () => {
      const atual = await recarregarStatus();
      if (!cancelado && atual?.pendente) await processarFila();
    };

    verificar();
    const intervalo = setInterval(verificar, INTERVALO_STATUS_MS);
    const aoVoltarParaAba = () => {
      if (document.visibilityState === "visible") verificar();
    };
    document.addEventListener("visibilitychange", aoVoltarParaAba);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [habilitado, recarregarStatus, processarFila]);

  const atualizar = useCallback(
    async (parametros: ParametrosAtualizacao) => {
      setAtualizando(true);
      setErro(null);
      try {
        const resposta = await fetch("/api/financeiro/sincronizacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modo: parametros.modo,
            desde: parametros.desde?.toISOString(),
            ate: parametros.ate?.toISOString(),
          }),
        });
        if (!resposta.ok) {
          const corpo = await resposta.json().catch(() => null);
          setErro(corpo?.error ?? "Não foi possível atualizar agora.");
          return;
        }
        setVersaoDados((v) => v + 1);
        const atual = await recarregarStatus();
        if (atual?.pendente) await processarFila();
      } finally {
        if (montado.current) setAtualizando(false);
      }
    },
    [processarFila, recarregarStatus]
  );

  const sinalizarDadosAlterados = useCallback(() => setVersaoDados((v) => v + 1), []);

  return (
    <ContextoSincronizacao.Provider
      value={{ status, processando, atualizando, erro, versaoDados, atualizar, recarregarStatus, sinalizarDadosAlterados }}
    >
      {children}
    </ContextoSincronizacao.Provider>
  );
}

export function useSincronizacaoFinanceira(): ValorContexto {
  const valor = useContext(ContextoSincronizacao);
  if (!valor) {
    return {
      status: null,
      processando: false,
      atualizando: false,
      erro: null,
      versaoDados: 0,
      atualizar: async () => undefined,
      recarregarStatus: async () => null,
      sinalizarDadosAlterados: () => undefined,
    };
  }
  return valor;
}

export function useAoAtualizarDados(recarregar: () => void) {
  const { versaoDados } = useSincronizacaoFinanceira();
  const primeira = useRef(true);
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    recarregarRef.current();
  }, [versaoDados]);
}
