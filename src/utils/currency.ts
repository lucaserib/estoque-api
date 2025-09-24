export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function brlToCents(value: string | number): number {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  const cleanValue = value.replace(/[^\d.,]/g, "");
  const normalizedValue = cleanValue.replace(",", ".");
  return Math.round(parseFloat(normalizedValue) * 100);
}

export function exibirValorEmReais(valorEmCentavos: number): string {
  return formatBRL(valorEmCentavos);
}

// Nova função para valores já em reais (usado nas APIs do ML)
export function formatarReal(valorEmReais: number): string {
  return valorEmReais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
