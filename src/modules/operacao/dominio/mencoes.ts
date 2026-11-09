const PADRAO_MENCAO = /@\[([^\]\n]{1,80})\]\(([0-9a-zA-Z_-]{1,64})\)/g;

export interface TrechoComentario {
  tipo: "texto" | "mencao";
  texto: string;
  userId?: string;
}

export function marcarMencao(nome: string, userId: string): string {
  return `@[${nome.replace(/[[\]\n]/g, "").slice(0, 80)}](${userId})`;
}

export function extrairMencoes(corpo: string): string[] {
  const ids = new Set<string>();
  for (const encontrada of corpo.matchAll(PADRAO_MENCAO)) ids.add(encontrada[2]);
  return [...ids];
}

export function limparMencoesInvalidas(corpo: string, validas: Set<string>): string {
  return corpo.replace(PADRAO_MENCAO, (inteira, nome: string, id: string) => (validas.has(id) ? inteira : `@${nome}`));
}

export function textoSemMarcacao(corpo: string): string {
  return corpo.replace(PADRAO_MENCAO, (_, nome: string) => `@${nome}`);
}

export function trechosDoComentario(corpo: string): TrechoComentario[] {
  const trechos: TrechoComentario[] = [];
  let ultimo = 0;
  for (const encontrada of corpo.matchAll(PADRAO_MENCAO)) {
    const inicio = encontrada.index ?? 0;
    if (inicio > ultimo) trechos.push({ tipo: "texto", texto: corpo.slice(ultimo, inicio) });
    trechos.push({ tipo: "mencao", texto: `@${encontrada[1]}`, userId: encontrada[2] });
    ultimo = inicio + encontrada[0].length;
  }
  if (ultimo < corpo.length) trechos.push({ tipo: "texto", texto: corpo.slice(ultimo) });
  return trechos;
}
