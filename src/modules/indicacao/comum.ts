export function emailCanonico(email: string): string {
  const [usuario, dominio] = email.trim().toLowerCase().split("@");
  if (!dominio) return email.trim().toLowerCase();
  const semEtiqueta = usuario.split("+")[0];
  const gmail = dominio === "gmail.com" || dominio === "googlemail.com";
  return `${gmail ? semEtiqueta.replace(/\./g, "") : semEtiqueta}@${gmail ? "gmail.com" : dominio}`;
}

export function mascararNome(nome: string | null | undefined, email?: string | null): string {
  const base = nome?.trim() || email?.split("@")[0] || "Loja";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => (parte.length <= 2 ? `${parte[0]}*` : `${parte.slice(0, 2)}${"*".repeat(Math.min(3, parte.length - 2))}`))
    .join(" ");
}

export const ROTULOS_STATUS_INDICACAO: Record<string, string> = {
  CADASTRADO: "Criou a conta",
  ATIVADO: "Conectou o Mercado Livre",
  PAGOU: "Assinou",
  EM_CARENCIA: "Assinou · aguardando a carência",
  RECOMPENSADA: "Recompensa liberada",
  INVALIDADA: "Não valeu",
};
