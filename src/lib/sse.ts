export interface EventoSse {
  evento: string;
  dados: unknown;
}

export function formatarEventoSse(evento: string, dados: unknown): string {
  return `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
}

export class LeitorSse {
  private pendente = "";

  alimentar(pedaco: string): EventoSse[] {
    this.pendente += pedaco;
    const blocos = this.pendente.split(/\r?\n\r?\n/);
    this.pendente = blocos.pop() ?? "";
    return blocos.map((bloco) => this.interpretar(bloco)).filter((e): e is EventoSse => e !== null);
  }

  finalizar(): EventoSse[] {
    const resto = this.pendente;
    this.pendente = "";
    const evento = resto.trim() ? this.interpretar(resto) : null;
    return evento ? [evento] : [];
  }

  private interpretar(bloco: string): EventoSse | null {
    let evento = "message";
    const linhasDeDados: string[] = [];
    for (const linha of bloco.split(/\r?\n/)) {
      if (!linha || linha.startsWith(":")) continue;
      const separador = linha.indexOf(":");
      const campo = separador === -1 ? linha : linha.slice(0, separador);
      const valor = separador === -1 ? "" : linha.slice(separador + 1).replace(/^ /, "");
      if (campo === "event") evento = valor;
      else if (campo === "data") linhasDeDados.push(valor);
    }
    if (linhasDeDados.length === 0) return null;
    const bruto = linhasDeDados.join("\n");
    try {
      return { evento, dados: JSON.parse(bruto) };
    } catch {
      return { evento, dados: bruto };
    }
  }
}

export async function lerEventosSse(
  resposta: Response,
  aoEvento: (evento: EventoSse) => void,
  sinal?: AbortSignal
): Promise<void> {
  if (!resposta.body) return;
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  const sse = new LeitorSse();
  const cancelar = () => leitor.cancel().catch(() => undefined);
  sinal?.addEventListener("abort", cancelar, { once: true });
  try {
    while (true) {
      const { value, done } = await leitor.read();
      if (done) break;
      for (const evento of sse.alimentar(decodificador.decode(value, { stream: true }))) aoEvento(evento);
    }
    for (const evento of sse.alimentar(decodificador.decode())) aoEvento(evento);
    for (const evento of sse.finalizar()) aoEvento(evento);
  } finally {
    sinal?.removeEventListener("abort", cancelar);
  }
}
