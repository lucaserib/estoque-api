export function urlDoApp(): string {
  const configurada =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return configurada.replace(/\/+$/, "");
}

export function linkAbsoluto(caminho: string): string {
  if (/^https?:\/\//i.test(caminho)) return caminho;
  return `${urlDoApp()}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

export function remetenteEmail(): string {
  return process.env.EMAIL_REMETENTE?.trim() || "Skubo <ola@skubo.com.br>";
}

export function responderParaEmail(): string | undefined {
  return process.env.EMAIL_RESPONDER_PARA?.trim() || undefined;
}

export function enderecoRodape(): string {
  return process.env.EMPRESA_ENDERECO_RODAPE?.trim() || "Skubo · Brasil";
}

export function mailtoDescadastro(): string | null {
  const remetente = responderParaEmail() ?? remetenteEmail();
  const endereco = remetente.match(/<([^>]+)>/)?.[1] ?? (remetente.includes("@") ? remetente.trim() : null);
  return endereco ? `mailto:${endereco}?subject=descadastro` : null;
}
