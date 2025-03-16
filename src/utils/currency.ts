export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatBRL(value: number): string {
  // Verificar se o valor já parece estar em centavos (maior que 100x o valor comum)
  const valueToFormat = value > 1000 ? value / 100 : value;

  return valueToFormat.toLocaleString("pt-BR", {
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

// Função auxiliar que garantidamente converte para centavos → reais
export function exibirValorEmReais(valorEmCentavos: number): string {
  return (valorEmCentavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
