import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatBRLReais(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export function formatNumberBR(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function formatDateBR(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR");
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNowStrict(new Date(date), {
    addSuffix: true,
    locale: ptBR,
  });
}
