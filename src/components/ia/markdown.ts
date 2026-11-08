export type BlocoMarkdown =
  | { tipo: "paragrafo"; linhas: string[] }
  | { tipo: "titulo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: string[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] };

export type TrechoInline =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrito"; texto: string }
  | { tipo: "italico"; texto: string }
  | { tipo: "codigo"; texto: string }
  | { tipo: "link"; texto: string; href: string };

const ITEM_LISTA = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;
const LINHA_TABELA = /^\s*\|.*\|\s*$/;
const SEPARADOR_TABELA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const TITULO = /^\s*#{1,6}\s+(.*)$/;

function celulas(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function dividirBlocos(texto: string): BlocoMarkdown[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: BlocoMarkdown[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.trim()) {
      i++;
      continue;
    }

    const titulo = TITULO.exec(linha);
    if (titulo) {
      blocos.push({ tipo: "titulo", texto: titulo[1].trim() });
      i++;
      continue;
    }

    if (LINHA_TABELA.test(linha) && i + 1 < linhas.length && SEPARADOR_TABELA.test(linhas[i + 1])) {
      const cabecalho = celulas(linha);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && LINHA_TABELA.test(linhas[i])) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      blocos.push({ tipo: "tabela", cabecalho, linhas: corpo });
      continue;
    }

    const item = ITEM_LISTA.exec(linha);
    if (item) {
      const ordenada = Boolean(item[1]);
      const itens: string[] = [];
      while (i < linhas.length) {
        const atual = ITEM_LISTA.exec(linhas[i]);
        if (atual && Boolean(atual[1]) === ordenada) {
          itens.push(atual[2].trim());
          i++;
        } else if (linhas[i].trim() && /^\s{2,}\S/.test(linhas[i]) && itens.length > 0) {
          itens[itens.length - 1] += ` ${linhas[i].trim()}`;
          i++;
        } else {
          break;
        }
      }
      blocos.push({ tipo: "lista", ordenada, itens });
      continue;
    }

    const paragrafo: string[] = [];
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !TITULO.test(linhas[i]) &&
      !ITEM_LISTA.test(linhas[i]) &&
      !(LINHA_TABELA.test(linhas[i]) && i + 1 < linhas.length && SEPARADOR_TABELA.test(linhas[i + 1]))
    ) {
      paragrafo.push(linhas[i].trim());
      i++;
    }
    blocos.push({ tipo: "paragrafo", linhas: paragrafo });
  }

  return blocos;
}

const PADRAO_INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

export function linkInternoSeguro(href: string): string | null {
  const limpo = href.trim();
  if (!limpo.startsWith("/") || limpo.startsWith("//") || limpo.includes("\\")) return null;
  if (/[\s<>"']/.test(limpo)) return null;
  return limpo;
}

export function dividirInline(texto: string): TrechoInline[] {
  const trechos: TrechoInline[] = [];
  let ultimo = 0;
  for (const encontrado of texto.matchAll(PADRAO_INLINE)) {
    const inicio = encontrado.index ?? 0;
    if (inicio > ultimo) trechos.push({ tipo: "texto", texto: texto.slice(ultimo, inicio) });
    const bruto = encontrado[0];
    if (bruto.startsWith("**") || bruto.startsWith("__")) trechos.push({ tipo: "negrito", texto: bruto.slice(2, -2) });
    else if (bruto.startsWith("`")) trechos.push({ tipo: "codigo", texto: bruto.slice(1, -1) });
    else if (bruto.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(bruto)!;
      const href = linkInternoSeguro(link[2]);
      trechos.push(href ? { tipo: "link", texto: link[1], href } : { tipo: "texto", texto: link[1] });
    } else trechos.push({ tipo: "italico", texto: bruto.slice(1, -1) });
    ultimo = inicio + bruto.length;
  }
  if (ultimo < texto.length) trechos.push({ tipo: "texto", texto: texto.slice(ultimo) });
  return trechos;
}
