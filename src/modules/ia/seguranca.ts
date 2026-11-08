const CHAVES_DE_PESSOA = new Set([
  "comprador",
  "compradores",
  "buyer",
  "cliente",
  "destinatario",
  "receiver",
  "contato",
  "payer",
  "pagador",
]);

const CHAVES_PESSOAIS = new Set([
  "email",
  "e-mail",
  "telefone",
  "phone",
  "celular",
  "cpf",
  "cnpj",
  "documento",
  "numerodocumento",
  "endereco",
  "address",
  "logradouro",
  "cep",
  "nomecomprador",
  "buyernickname",
  "nickname",
  "first_name",
  "last_name",
]);

const PADRAO_CUSTO = /^(custo|cmv|margem|lucro|valorcompra|capital|valorparado|valoremrisco|roi)/i;

const PADRAO_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PADRAO_CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const PADRAO_CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;

function limparTexto(texto: string): string {
  return texto
    .replace(PADRAO_EMAIL, "[e-mail removido]")
    .replace(PADRAO_CPF, "[documento removido]")
    .replace(PADRAO_CNPJ, "[documento removido]");
}

function mapearChaves(valor: unknown, manter: (chave: string) => boolean, limpar: (texto: string) => string): unknown {
  if (typeof valor === "string") return limpar(valor);
  if (Array.isArray(valor)) return valor.map((item) => mapearChaves(item, manter, limpar));
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([chave]) => manter(chave))
        .map(([chave, item]) => [chave, mapearChaves(item, manter, limpar)])
    );
  }
  return valor;
}

export function removerDadosPessoais<T>(objeto: T): T {
  return mapearChaves(
    objeto,
    (chave) => {
      const normal = chave.toLowerCase();
      return !CHAVES_DE_PESSOA.has(normal) && !CHAVES_PESSOAIS.has(normal);
    },
    limparTexto
  ) as T;
}

export function removerCustos<T>(objeto: T): T {
  return mapearChaves(objeto, (chave) => !PADRAO_CUSTO.test(chave), (texto) => texto) as T;
}

export interface ListaCortada {
  itens: unknown[];
  totalItens: number;
  cortado: true;
}

function tamanho(valor: unknown): number {
  return JSON.stringify(valor)?.length ?? 0;
}

function cortarLista(lista: unknown[], caber: (parcial: ListaCortada) => boolean): ListaCortada {
  let baixo = 0;
  let alto = lista.length;
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    if (caber({ itens: lista.slice(0, meio), totalItens: lista.length, cortado: true })) baixo = meio;
    else alto = meio - 1;
  }
  return { itens: lista.slice(0, baixo), totalItens: lista.length, cortado: true };
}

export function limitarTamanho(json: unknown, maxCaracteres = 12000): unknown {
  if (tamanho(json) <= maxCaracteres) return json;

  if (Array.isArray(json)) {
    return cortarLista(json, (parcial) => tamanho(parcial) <= maxCaracteres);
  }

  if (json && typeof json === "object") {
    const copia: Record<string, unknown> = { ...(json as Record<string, unknown>) };
    const listas = Object.entries(copia)
      .filter(([, valor]) => Array.isArray(valor))
      .sort(([, a], [, b]) => tamanho(b) - tamanho(a));

    for (const [chave, valor] of listas) {
      if (tamanho(copia) <= maxCaracteres) break;
      const lista = valor as unknown[];
      copia[chave] = cortarLista(lista, (parcial) => tamanho({ ...copia, [chave]: parcial }) <= maxCaracteres);
    }
    if (tamanho(copia) <= maxCaracteres) return copia;
  }

  return { resumoTruncado: JSON.stringify(json).slice(0, Math.max(0, maxCaracteres - 60)), cortado: true };
}

export function embrulharDadosExternos(json: unknown): string {
  const seguro = JSON.stringify(json ?? null).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<dados_da_loja>\n${seguro}\n</dados_da_loja>`;
}

export function prepararSaidaFerramenta(saida: unknown, podeVerCusto: boolean, maxCaracteres = 12000): string {
  const semPessoas = removerDadosPessoais(saida);
  const filtrado = podeVerCusto ? semPessoas : removerCustos(semPessoas);
  return embrulharDadosExternos(limitarTamanho(filtrado, maxCaracteres));
}
