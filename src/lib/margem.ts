export interface MargemUnitariaInput {
  precoVenda: number | null | undefined;
  tarifa: number | null | undefined;
  frete: number | null | undefined;
  custo: number | null | undefined;
  aliquotaImposto?: number | null;
}

export interface MargemUnitariaResultado {
  margemValor: number | null;
  margemPercentual: number | null;
  completo: boolean;
  faltando: string[];
}

export function calcularMargemUnitaria({
  precoVenda,
  tarifa,
  frete,
  custo,
  aliquotaImposto,
}: MargemUnitariaInput): MargemUnitariaResultado {
  const faltando: string[] = [];
  if (precoVenda == null) faltando.push("precoVenda");
  if (tarifa == null) faltando.push("tarifa");
  if (frete == null) faltando.push("frete");
  if (custo == null) faltando.push("custo");

  if (
    precoVenda == null ||
    tarifa == null ||
    frete == null ||
    custo == null
  ) {
    return { margemValor: null, margemPercentual: null, completo: false, faltando };
  }

  const imposto = Math.round(precoVenda * (aliquotaImposto ?? 0));
  const margemValor = precoVenda - tarifa - frete - custo - imposto;
  const margemPercentual = precoVenda === 0 ? 0 : margemValor / precoVenda;

  return { margemValor, margemPercentual, completo: true, faltando: [] };
}
