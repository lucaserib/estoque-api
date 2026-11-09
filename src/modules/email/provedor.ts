import fs from "node:fs";
import { Resend } from "resend";
import { remetenteEmail, responderParaEmail } from "./config";

export interface MensagemEmail {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  cabecalhos?: Record<string, string>;
  etiquetas?: Record<string, string>;
  chaveIdempotencia?: string;
}

export interface ResultadoEnvio {
  id: string | null;
  erro: string | null;
}

export interface ProvedorEmail {
  readonly nome: "resend" | "console";
  enviar(mensagem: MensagemEmail): Promise<ResultadoEnvio>;
  enviarLote(mensagens: MensagemEmail[]): Promise<ResultadoEnvio[]>;
}

function etiquetasResend(etiquetas: Record<string, string> | undefined) {
  if (!etiquetas) return undefined;
  return Object.entries(etiquetas).map(([name, value]) => ({
    name: name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256),
    value: value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256),
  }));
}

export function criarProvedorResend(chave: string): ProvedorEmail {
  const cliente = new Resend(chave);
  const montar = (mensagem: MensagemEmail) => ({
    from: remetenteEmail(),
    to: [mensagem.para],
    subject: mensagem.assunto,
    html: mensagem.html,
    text: mensagem.texto,
    replyTo: responderParaEmail(),
    headers: mensagem.cabecalhos,
    tags: etiquetasResend(mensagem.etiquetas),
  });

  return {
    nome: "resend",
    async enviar(mensagem) {
      const resposta = await cliente.emails.send(montar(mensagem), {
        idempotencyKey: mensagem.chaveIdempotencia,
      });
      if (resposta.error) return { id: null, erro: resposta.error.message };
      return { id: resposta.data?.id ?? null, erro: null };
    },
    async enviarLote(mensagens) {
      if (mensagens.length === 0) return [];
      if (mensagens.length === 1) return [await this.enviar(mensagens[0])];
      const resposta = await cliente.batch.send(mensagens.map(montar), { batchValidation: "permissive" });
      if (resposta.error) return mensagens.map(() => ({ id: null, erro: resposta.error!.message }));
      const ids = resposta.data?.data ?? [];
      return mensagens.map((_, indice) => {
        const id = ids[indice]?.id ?? null;
        return { id, erro: id ? null : "O Resend não devolveu o id deste e-mail." };
      });
    },
  };
}

const caixaDeSaidaConsole: Array<MensagemEmail & { enviadoEm: string }> = [];

export function emailsDoConsole(): ReadonlyArray<MensagemEmail & { enviadoEm: string }> {
  return caixaDeSaidaConsole;
}

export function limparEmailsDoConsole(): void {
  caixaDeSaidaConsole.length = 0;
}

export function criarProvedorConsole(): ProvedorEmail {
  let contador = 0;
  const registrar = (mensagem: MensagemEmail): ResultadoEnvio => {
    contador += 1;
    const registro = { ...mensagem, enviadoEm: new Date().toISOString() };
    caixaDeSaidaConsole.push(registro);
    if (caixaDeSaidaConsole.length > 200) caixaDeSaidaConsole.shift();
    const arquivo = process.env.EMAIL_CONSOLE_ARQUIVO?.trim();
    if (arquivo) {
      try {
        fs.appendFileSync(arquivo, `${JSON.stringify({ para: registro.para, assunto: registro.assunto, texto: registro.texto, enviadoEm: registro.enviadoEm })}\n`);
      } catch (error) {
        console.error("[EMAIL_CONSOLE] Falha ao gravar o arquivo de e-mails:", error);
      }
    }
    if (process.env.NODE_ENV !== "test") {
      console.info(`[EMAIL_CONSOLE] Para ${mensagem.para} · ${mensagem.assunto}\n${mensagem.texto}`);
    }
    return { id: `console-${Date.now()}-${contador}`, erro: null };
  };

  return {
    nome: "console",
    async enviar(mensagem) {
      return registrar(mensagem);
    },
    async enviarLote(mensagens) {
      return mensagens.map(registrar);
    },
  };
}

let provedorAtual: ProvedorEmail | null = null;

export function obterProvedorEmail(): ProvedorEmail {
  if (provedorAtual) return provedorAtual;
  const escolhido = process.env.EMAIL_PROVEDOR?.trim().toLowerCase();
  const chave = process.env.RESEND_API_KEY?.trim();
  provedorAtual = escolhido !== "console" && chave ? criarProvedorResend(chave) : criarProvedorConsole();
  if (provedorAtual.nome === "console" && process.env.NODE_ENV === "production" && escolhido !== "console") {
    console.warn("[EMAIL] RESEND_API_KEY ausente: os e-mails vão só para o log.");
  }
  return provedorAtual;
}

export function definirProvedorEmail(provedor: ProvedorEmail | null): void {
  provedorAtual = provedor;
}
