import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export type AcaoPermissao =
  | "VER_CUSTO"
  | "EDITAR_PRODUTO"
  | "PEDIDOS_COMPRA_EDITAR"
  | "PEDIDOS_COMPRA_VER"
  | "ESTOQUE_AJUSTAR"
  | "VENDAS_ML_EDITAR"
  | "VENDAS_ML_VER"
  | "INTEGRACOES_USUARIOS_ASSINATURA";

type NivelAcesso = "SIM" | "VER" | "NAO";

const MATRIZ: Record<AcaoPermissao, Record<UserRole, NivelAcesso>> = {
  VER_CUSTO: {
    ADMIN: "SIM",
    COMPRAS: "SIM",
    ESTOQUE: "NAO",
    VENDAS: "NAO",
    LEITURA: "NAO",
  },
  EDITAR_PRODUTO: {
    ADMIN: "SIM",
    COMPRAS: "SIM",
    ESTOQUE: "NAO",
    VENDAS: "NAO",
    LEITURA: "NAO",
  },
  PEDIDOS_COMPRA_EDITAR: {
    ADMIN: "SIM",
    COMPRAS: "SIM",
    ESTOQUE: "NAO",
    VENDAS: "NAO",
    LEITURA: "NAO",
  },
  PEDIDOS_COMPRA_VER: {
    ADMIN: "SIM",
    COMPRAS: "SIM",
    ESTOQUE: "VER",
    VENDAS: "NAO",
    LEITURA: "VER",
  },
  ESTOQUE_AJUSTAR: {
    ADMIN: "SIM",
    COMPRAS: "NAO",
    ESTOQUE: "SIM",
    VENDAS: "NAO",
    LEITURA: "NAO",
  },
  VENDAS_ML_EDITAR: {
    ADMIN: "SIM",
    COMPRAS: "VER",
    ESTOQUE: "VER",
    VENDAS: "SIM",
    LEITURA: "VER",
  },
  VENDAS_ML_VER: {
    ADMIN: "SIM",
    COMPRAS: "SIM",
    ESTOQUE: "SIM",
    VENDAS: "SIM",
    LEITURA: "SIM",
  },
  INTEGRACOES_USUARIOS_ASSINATURA: {
    ADMIN: "SIM",
    COMPRAS: "NAO",
    ESTOQUE: "NAO",
    VENDAS: "NAO",
    LEITURA: "NAO",
  },
};

export class SemPermissaoError extends Error {
  readonly code = "SEM_PERMISSAO";

  constructor(acao: AcaoPermissao) {
    super(`Seu papel não tem permissão para: ${acao}`);
    this.name = "SemPermissaoError";
  }
}

export function podeVer(papel: UserRole, acao: AcaoPermissao): boolean {
  const nivel = MATRIZ[acao][papel];
  return nivel === "SIM" || nivel === "VER";
}

export function podeEditar(papel: UserRole, acao: AcaoPermissao): boolean {
  return MATRIZ[acao][papel] === "SIM";
}

export function exigirPermissao(papel: UserRole, acao: AcaoPermissao): void {
  if (!podeEditar(papel, acao)) {
    throw new SemPermissaoError(acao);
  }
}

export function exigirVisualizacao(papel: UserRole, acao: AcaoPermissao): void {
  if (!podeVer(papel, acao)) {
    throw new SemPermissaoError(acao);
  }
}

export function permissaoErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof SemPermissaoError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 403 }
    );
  }
  return null;
}
