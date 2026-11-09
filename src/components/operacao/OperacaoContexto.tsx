"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EtiquetaDto, InicioOperacao, MembroDto, QuadroDto } from "@/modules/operacao/tipos";
import { chamarOperacao } from "./api";

interface ValorOperacao {
  inicio: InicioOperacao | null;
  erro: string | null;
  recarregar: () => Promise<void>;
  membro: (id: string | null | undefined) => MembroDto | undefined;
  etiqueta: (id: string) => EtiquetaDto | undefined;
  quadroPadrao: QuadroDto | undefined;
  responsaveis: MembroDto[];
}

const ContextoOperacao = createContext<ValorOperacao | null>(null);

let cache: { dados: InicioOperacao; em: number } | null = null;
const VALIDADE_CACHE_MS = 60_000;

export async function carregarInicioOperacao(forcar = false): Promise<InicioOperacao> {
  if (!forcar && cache && Date.now() - cache.em < VALIDADE_CACHE_MS) return cache.dados;
  const dados = await chamarOperacao<InicioOperacao>("/inicio");
  cache = { dados, em: Date.now() };
  return dados;
}

export function OperacaoProvider({ children }: { children: React.ReactNode }) {
  const [inicio, setInicio] = useState<InicioOperacao | null>(cache?.dados ?? null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      setInicio(await carregarInicioOperacao(true));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  }, []);

  useEffect(() => {
    carregarInicioOperacao()
      .then((dados) => {
        setInicio(dados);
        setErro(null);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, []);

  const valor = useMemo<ValorOperacao>(() => {
    const membros = new Map((inicio?.membros ?? []).map((m) => [m.id, m]));
    const etiquetas = new Map((inicio?.etiquetas ?? []).map((e) => [e.id, e]));
    return {
      inicio,
      erro,
      recarregar,
      membro: (id) => (id ? membros.get(id) : undefined),
      etiqueta: (id) => etiquetas.get(id),
      quadroPadrao: inicio?.quadros.find((q) => q.padrao) ?? inicio?.quadros[0],
      responsaveis: (inicio?.membros ?? []).filter((m) => m.podeEditar),
    };
  }, [inicio, erro, recarregar]);

  return <ContextoOperacao.Provider value={valor}>{children}</ContextoOperacao.Provider>;
}

export function useOperacao(): ValorOperacao {
  const valor = useContext(ContextoOperacao);
  if (!valor) throw new Error("useOperacao fora do OperacaoProvider");
  return valor;
}
