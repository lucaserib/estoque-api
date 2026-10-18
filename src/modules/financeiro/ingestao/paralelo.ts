export async function emParalelo<T, R>(
  itens: T[],
  concorrencia: number,
  executar: (item: T, indice: number) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.max(1, Math.min(concorrencia, itens.length)) }, async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      resultados[indice] = await executar(itens[indice], indice);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}
