import { verificarChaveCriptografia } from "@/lib/tokenCrypto";
import { obterSegredoAuth } from "@/lib/authSecret";

export interface VerificacaoConfigBling {
  item: string;
  ok: boolean;
  bloqueante: boolean;
  mensagem: string;
}

export interface DiagnosticoConfigBling {
  ok: boolean;
  callbackEsperado: string;
  verificacoes: VerificacaoConfigBling[];
}

const CALLBACK_PATH = "/api/bling/auth/callback";

function origemDe(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function ehLocalhost(origem: string): boolean {
  const host = new URL(origem).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function diagnosticarConfiguracaoBling(origemRequisicao: string): DiagnosticoConfigBling {
  const callbackEsperado = `${origemRequisicao}${CALLBACK_PATH}`;
  const verificacoes: VerificacaoConfigBling[] = [];

  verificacoes.push({
    item: "BLING_CLIENT_ID",
    ok: Boolean(process.env.BLING_CLIENT_ID?.trim()),
    bloqueante: true,
    mensagem: process.env.BLING_CLIENT_ID?.trim()
      ? "Definido."
      : "Variável ausente na Vercel. Copie o Client ID do aplicativo no portal de desenvolvedores do Bling.",
  });

  verificacoes.push({
    item: "BLING_CLIENT_SECRET",
    ok: Boolean(process.env.BLING_CLIENT_SECRET?.trim()),
    bloqueante: true,
    mensagem: process.env.BLING_CLIENT_SECRET?.trim()
      ? "Definido."
      : "Variável ausente na Vercel. Copie o Client Secret do aplicativo no portal de desenvolvedores do Bling.",
  });

  const segredoAuth = obterSegredoAuth();
  verificacoes.push({
    item: "NEXTAUTH_SECRET",
    ok: Boolean(segredoAuth),
    bloqueante: true,
    mensagem: segredoAuth
      ? "Definido."
      : "Nem NEXTAUTH_SECRET nem AUTH_SECRET estão definidos. Um deles assina o login e o state da conexão com o Bling.",
  });

  const chave = verificarChaveCriptografia();
  verificacoes.push({
    item: "TOKEN_ENCRYPTION_KEY",
    ok: chave !== "invalida",
    bloqueante: chave === "invalida",
    mensagem:
      chave === "ok"
        ? "Chave válida (32 bytes)."
        : chave === "ausente"
        ? "Não definida: os tokens serão gravados sem criptografia. Recomendado definir com `openssl rand -base64 32`."
        : "Chave inválida: não decodifica para 32 bytes em base64. Toda gravação de conta Bling/ML vai falhar até corrigir. Gere com `openssl rand -base64 32`.",
  });

  const origemNextAuth = origemDe(process.env.NEXTAUTH_URL);
  const nextAuthOk = !origemNextAuth || origemNextAuth === origemRequisicao;
  verificacoes.push({
    item: "NEXTAUTH_URL",
    ok: nextAuthOk,
    bloqueante: false,
    mensagem: nextAuthOk
      ? "Coerente com o domínio acessado."
      : `Aponta para ${origemNextAuth}, mas o app foi acessado por ${origemRequisicao}. Use sempre o mesmo domínio para conectar o Bling, senão o cookie de sessão não volta no callback.`,
  });

  const httpsOk = origemRequisicao.startsWith("https://") || ehLocalhost(origemRequisicao);
  verificacoes.push({
    item: "HTTPS",
    ok: httpsOk,
    bloqueante: true,
    mensagem: httpsOk
      ? "Domínio adequado para o callback."
      : "O Bling exige callback em HTTPS. Use o domínio de produção ou um túnel HTTPS.",
  });

  const callbackConfigurado = process.env.BLING_REDIRECT_URI?.trim();
  const callbackOk = !callbackConfigurado || callbackConfigurado === callbackEsperado;
  const colouLinkDeConvite = Boolean(callbackConfigurado?.includes("bling.com.br"));
  verificacoes.push({
    item: "BLING_REDIRECT_URI",
    ok: callbackOk,
    bloqueante: false,
    mensagem: callbackOk
      ? `O "Link de redirecionamento" do aplicativo no Bling deve ser exatamente ${callbackEsperado}`
      : colouLinkDeConvite
      ? `BLING_REDIRECT_URI contém o "Link de convite" do Bling (endereço do bling.com.br). Troque o valor por ${callbackEsperado} ou apague a variável. O link de convite não deve ser usado para conectar: use o botão Conectar do Leap Stock.`
      : `BLING_REDIRECT_URI está como ${callbackConfigurado}, mas o callback deste domínio é ${callbackEsperado}. O Bling devolve o usuário para o link cadastrado no aplicativo; se ele for de outro domínio, a sessão e o state não chegam e a conexão falha.`,
  });

  return {
    ok: verificacoes.every((v) => v.ok || !v.bloqueante),
    callbackEsperado,
    verificacoes,
  };
}

export function origemDaRequisicao(url: string, headers: Headers): string {
  const protoEncaminhado = headers.get("x-forwarded-proto");
  const hostEncaminhado = headers.get("x-forwarded-host") ?? headers.get("host");
  if (protoEncaminhado && hostEncaminhado) {
    return `${protoEncaminhado}://${hostEncaminhado}`;
  }
  return new URL(url).origin;
}
