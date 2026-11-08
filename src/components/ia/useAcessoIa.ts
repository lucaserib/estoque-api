"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export interface ConsumoIaCliente {
  base: "CUSTO" | "MENSAGENS";
  percentual: number;
  esgotado: boolean;
  renovaEm: string;
}

export interface AcessoIaCliente {
  configurada: boolean;
  desligada: boolean;
  liberada: boolean;
  origem: "ASSINATURA" | "TESTE" | "MANUAL" | "ENV" | null;
  status: "INATIVA" | "TESTE" | "ATIVA" | "PENDENTE" | "CANCELADA";
  testeAteEm: string | null;
  testeDisponivel: boolean;
  periodoFim: string | null;
  consumo: ConsumoIaCliente;
  adminPlataforma: boolean;
  podeAssinar: boolean;
  pagamentoConfigurado: boolean;
  precoMensal: number;
}

interface Estado {
  acesso: AcessoIaCliente | null;
  carregando: boolean;
  falhou: boolean;
}

let estado: Estado = { acesso: null, carregando: false, falhou: false };
let buscaEmAndamento: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

function publicar(novo: Partial<Estado>) {
  estado = { ...estado, ...novo };
  ouvintes.forEach((ouvinte) => ouvinte());
}

async function buscar(): Promise<void> {
  if (buscaEmAndamento) return buscaEmAndamento;
  publicar({ carregando: true });
  buscaEmAndamento = fetch("/api/ia/acesso")
    .then(async (resposta) => {
      if (!resposta.ok) throw new Error(String(resposta.status));
      publicar({ acesso: (await resposta.json()) as AcessoIaCliente, falhou: false });
    })
    .catch(() => publicar({ falhou: true }))
    .finally(() => {
      buscaEmAndamento = null;
      publicar({ carregando: false });
    });
  return buscaEmAndamento;
}

export function atualizarConsumoIa(consumo: ConsumoIaCliente) {
  if (estado.acesso) publicar({ acesso: { ...estado.acesso, consumo } });
}

export function recarregarAcessoIa() {
  return buscar();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const ESTADO_SERVIDOR: Estado = { acesso: null, carregando: true, falhou: false };

export function useAcessoIa() {
  const atual = useSyncExternalStore(
    assinar,
    () => estado,
    () => ESTADO_SERVIDOR
  );

  useEffect(() => {
    if (!estado.acesso && !estado.falhou && !buscaEmAndamento) buscar();
  }, []);

  const recarregar = useCallback(() => buscar(), []);

  const visivel = Boolean(atual.acesso && (atual.acesso.configurada || atual.acesso.adminPlataforma));
  const utilizavel = Boolean(
    atual.acesso && atual.acesso.liberada && atual.acesso.configurada && !atual.acesso.desligada
  );

  return { ...atual, visivel, utilizavel, recarregar };
}
