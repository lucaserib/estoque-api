export function fimDoPeriodo(inicio: Date, plano: "MONTHLY" | "ANNUAL" | null): Date {
  const fim = new Date(inicio);
  if (plano === "ANNUAL") fim.setFullYear(fim.getFullYear() + 1);
  else fim.setMonth(fim.getMonth() + 1);
  return fim;
}

export function webhookSemSegredoEmProducao(): boolean {
  return !process.env.MP_WEBHOOK_SECRET && process.env.NODE_ENV === "production";
}
