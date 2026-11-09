import type { CategoriaEmail } from "@prisma/client";
import type { ConteudoEmail } from "../layout";

export interface ModeloEmail<D> {
  chave: string;
  categoria: CategoriaEmail;
  urgente: boolean;
  montar(dados: D): ConteudoEmail;
}

export function definirModelo<D>(modelo: ModeloEmail<D>): ModeloEmail<D> {
  return modelo;
}

export function dataBR(data: Date | string): string {
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function saudacao(nome: string | null | undefined): string {
  const primeiro = nome?.trim().split(/\s+/)[0];
  return primeiro ? `Olá, ${primeiro}!` : "Olá!";
}
