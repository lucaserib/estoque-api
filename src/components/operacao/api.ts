export class ErroApiOperacao extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo: string | null
  ) {
    super(mensagem);
    this.name = "ErroApiOperacao";
  }
}

export async function chamarOperacao<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const resposta = await fetch(`/api/operacao${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST"),
    headers: opcoes.corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ErroApiOperacao(dados?.error ?? "Não foi possível concluir agora.", resposta.status, dados?.code ?? null);
  }
  return dados as T;
}

export function parametros(valores: Record<string, string | number | boolean | null | undefined>): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor === undefined || valor === null || valor === "" || valor === false) continue;
    busca.set(chave, valor === true ? "1" : String(valor));
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}
