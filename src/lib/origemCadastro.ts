export const COOKIE_ORIGEM = "skubo_origem";
export const COOKIE_CONSENTIMENTO = "skubo_cookies";
export const DIAS_COOKIE_ORIGEM = 60;

export interface OrigemPrimeiroToque {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  ref?: string;
  paginaEntrada?: string;
  referrer?: string;
  primeiroToqueEm?: string;
}

const CAMPOS_UTM: Array<[keyof OrigemPrimeiroToque, string]> = [
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmContent", "utm_content"],
  ["utmTerm", "utm_term"],
];

function cortar(valor: string | null | undefined, tamanho: number): string | undefined {
  const limpo = valor?.trim();
  return limpo ? limpo.slice(0, tamanho) : undefined;
}

export function origemDaUrl(url: URL, referrer: string | null, agora: Date = new Date()): OrigemPrimeiroToque {
  const origem: OrigemPrimeiroToque = {};
  for (const [campo, parametro] of CAMPOS_UTM) {
    const valor = cortar(url.searchParams.get(parametro), 120);
    if (valor) origem[campo] = valor;
  }
  const ref = cortar(url.searchParams.get("ref"), 20);
  if (ref) origem.ref = ref.toUpperCase();
  origem.paginaEntrada = cortar(`${url.pathname}${url.search}`, 300);
  if (referrer) {
    try {
      const externo = new URL(referrer);
      if (externo.host !== url.host) origem.referrer = cortar(`${externo.origin}${externo.pathname}`, 300);
    } catch {}
  }
  origem.primeiroToqueEm = agora.toISOString();
  return origem;
}

export function serializarOrigem(origem: OrigemPrimeiroToque): string {
  return encodeURIComponent(JSON.stringify(origem));
}

export function lerOrigem(valor: string | null | undefined): OrigemPrimeiroToque | null {
  if (!valor) return null;
  try {
    const lido = JSON.parse(decodeURIComponent(valor));
    if (!lido || typeof lido !== "object") return null;
    const origem: OrigemPrimeiroToque = {};
    for (const campo of ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "ref", "paginaEntrada", "referrer", "primeiroToqueEm"] as const) {
      const v = (lido as Record<string, unknown>)[campo];
      if (typeof v === "string" && v.trim()) origem[campo] = v.slice(0, 300);
    }
    return origem;
  } catch {
    return null;
  }
}
