// utils/currency.ts
export const centsToBRL = (cents: number): string => {
  return (cents / 100).toFixed(2); // Convert to BRL string with 2 decimals
};

export const brlToCents = (brl: string | number): number => {
  const value = typeof brl === "string" ? parseFloat(brl) : brl;
  return Math.round(value * 100); // Convert to cents, round to avoid floating-point issues
};

export const formatBRL = (cents: number): string => {
  return `R$ ${centsToBRL(cents)}`; // Format with R$ prefix
};
