export function sugerirUnidadesPeloTitulo(titulo: string): number | null {
  const t = titulo.toLowerCase();
  const padroes = [
    /\bkit\s*(?:com|c\/)?\s*(\d{1,3})\b/,
    /\b(\d{1,3})\s*(?:un|und|unid|unidades|pçs|pcs|peças|pecas)\b/,
    /\b(\d{1,3})\s*x\b/,
  ];
  for (const padrao of padroes) {
    const m = t.match(padrao);
    if (m) {
      const n = Number(m[1]);
      if (n >= 2 && n <= 100) return n;
    }
  }
  if (/\b(par|dupla)\b/.test(t)) return 2;
  return null;
}
