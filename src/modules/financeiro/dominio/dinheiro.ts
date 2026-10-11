/**
 * Dinheiro é sempre inteiro em centavos neste módulo. Nenhuma função aqui
 * usa float para valor monetário — só para proporções intermediárias do rateio.
 */

export function somar(...valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

/**
 * Divide `totalCentavos` entre `pesos` proporcionalmente, sem perder nem sobrar
 * centavo (soma das partes === totalCentavos sempre). Método do maior resto:
 * cada parte recebe o piso da proporção exata, e os centavos que faltam vão,
 * um a um, para quem tem o maior resto fracionário (empate: ordem original).
 *
 * Funciona com totalCentavos negativo (ex.: rateio de um cancelamento) porque
 * o resto de `exata - Math.floor(exata)` cai sempre em [0, 1), não importa o sinal.
 *
 * Se todos os pesos forem zero mas houver mais de um destinatário, divide em
 * partes iguais em vez de devolver tudo zerado — evita "perder" o total quando
 * o critério de peso (ex.: valor do item) é zero para todo mundo.
 */
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

/**
 * Divide em N parcelas iguais, com o resto da divisão inteira todo na
 * última parcela — não pelo maior resto como em `ratear`. É assim que
 * parcelamento de compra aparece numa fatura: parcelas "redondas", a
 * diferença de centavos absorvida só na última.
 */
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
