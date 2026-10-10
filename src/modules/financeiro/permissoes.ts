import { UserRole } from "@prisma/client";
import {
  podeVer,
  podeEditar,
  exigirPermissao,
  exigirVisualizacao,
} from "@/lib/permissoes";

export function podeVerFinanceiro(papel: UserRole): boolean {
  return podeVer(papel, "FINANCEIRO_VER");
}

export function podeEditarFinanceiro(papel: UserRole): boolean {
  return podeEditar(papel, "FINANCEIRO_EDITAR");
}

export function exigirVisualizacaoFinanceiro(papel: UserRole): void {
  exigirVisualizacao(papel, "FINANCEIRO_VER");
}

export function exigirEdicaoFinanceira(papel: UserRole): void {
  exigirPermissao(papel, "FINANCEIRO_EDITAR");
}
