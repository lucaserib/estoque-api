export function somar(...valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

export function ratear(totalCentavos: number, pesos: number[]): number[] {
  if (pesos.length === 0) {
    if (totalCentavos !== 0) {
      throw new Error(
        `ratear: totalCentavos=${totalCentavos} não pode ser dividido entre 0 destinatários`
      );
    }
    return [];
  }

  const somaPesos = somar(...pesos);
  const pesosEfetivos = somaPesos === 0 ? pesos.map(() => 1) : pesos;
  const somaPesosEfetivos = somaPesos === 0 ? pesosEfetivos.length : somaPesos;

  const exatas = pesosEfetivos.map(
    (peso) => (totalCentavos * peso) / somaPesosEfetivos
  );
  const bases = exatas.map((exata) => Math.floor(exata));
  const restos = exatas.map((exata, i) => exata - bases[i]);

  const faltam = totalCentavos - somar(...bases);

  const ordemPorResto = restos
    .map((resto, indice) => ({ resto, indice }))
    .sort((a, b) => b.resto - a.resto);

  const partes = [...bases];
  for (let i = 0; i < faltam; i++) {
    partes[ordemPorResto[i].indice] += 1;
  }

  return partes;
}

export function dividirEmParcelas(
  totalCentavos: number,
  numeroDeParcelas: number
): number[] {
  if (numeroDeParcelas <= 0) {
    throw new Error(
      `dividirEmParcelas: numeroDeParcelas deve ser positivo, recebeu ${numeroDeParcelas}`
    );
  }

  const valorParcela = Math.trunc(totalCentavos / numeroDeParcelas);
  const parcelas = new Array(numeroDeParcelas).fill(valorParcela);
  parcelas[numeroDeParcelas - 1] += totalCentavos - valorParcela * numeroDeParcelas;
  return parcelas;
}

export function formatar(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}
