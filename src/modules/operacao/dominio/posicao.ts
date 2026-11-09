export const ESPACO_POSICAO = 1024;
export const ESPACO_MINIMO = 1e-6;

export function posicaoEntre(antes: number | null, depois: number | null): number | null {
  if (antes === null && depois === null) return ESPACO_POSICAO;
  if (antes === null) return (depois as number) - ESPACO_POSICAO;
  if (depois === null) return antes + ESPACO_POSICAO;
  if (depois - antes <= ESPACO_MINIMO) return null;
  return antes + (depois - antes) / 2;
}

export function posicoesRenumeradas(quantidade: number): number[] {
  return Array.from({ length: quantidade }, (_, indice) => (indice + 1) * ESPACO_POSICAO);
}

export function posicaoNoFim(ultima: number | null | undefined): number {
  return (ultima ?? 0) + ESPACO_POSICAO;
}

export function posicaoNoInicio(primeira: number | null | undefined): number {
  return primeira === null || primeira === undefined ? ESPACO_POSICAO : primeira - ESPACO_POSICAO;
}
