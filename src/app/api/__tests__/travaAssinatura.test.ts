import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..");

const LIBERADAS_PREFIXO = [
  "auth/",
  "register/",
  "convites/",
  "mercadopago/",
  "assinatura/",
  "planos/",
  "perfil/",
  "email/",
  "descadastro/",
  "ia/creditos/",
  "cron/",
  "admin/",
];
const LIBERADAS_EXATAS = ["bling/webhook/route.ts", "mercadolivre/webhook/route.ts", "bling/auth/callback/route.ts"];
const LIBERADAS_SO_LEITURA = ["usuarios/route.ts", "indicacao/"];
const TRATADORES = ["permissaoErrorResponse(", "respostaErroRotaIa(", "respostaErroCobrancaIa(", "respostaErroAdmin("];

function rotas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return entrada.name === "__tests__" ? [] : rotas(caminho);
    return entrada.name === "route.ts" ? [caminho] : [];
  });
}

function relativo(arquivo: string): string {
  return path.relative(RAIZ, arquivo).split(path.sep).join("/");
}

function trechosForaDoGet(texto: string): string {
  const partes = texto.split(/(?=export async function (?:GET|POST|PUT|PATCH|DELETE)\b)/);
  return partes.filter((parte) => !parte.startsWith("export async function GET")).join("\n");
}

const todas = rotas(RAIZ);

describe("trava de assinatura nas rotas da API", () => {
  it("encontra as rotas", () => {
    expect(todas.length).toBeGreaterThan(100);
  });

  it("nenhuma rota fora da lista liberada usa verifyUser sem checar a assinatura", () => {
    const violacoes = todas
      .filter((arquivo) => {
        const rel = relativo(arquivo);
        return !LIBERADAS_PREFIXO.some((p) => rel.startsWith(p)) && !LIBERADAS_EXATAS.includes(rel);
      })
      .filter((arquivo) => {
        const rel = relativo(arquivo);
        const texto = fs.readFileSync(arquivo, "utf8");
        const soLeitura = LIBERADAS_SO_LEITURA.some((p) => rel === p || rel.startsWith(p));
        return /\bverifyUser\(/.test(soLeitura ? trechosForaDoGet(texto) : texto);
      })
      .map(relativo);

    expect(violacoes).toEqual([]);
  });

  it("toda rota com verifyUserAtivo transforma a assinatura inativa em 402", () => {
    const semTratador = todas
      .filter((arquivo) => fs.readFileSync(arquivo, "utf8").includes("verifyUserAtivo("))
      .filter((arquivo) => {
        const texto = fs.readFileSync(arquivo, "utf8");
        return !TRATADORES.some((tratador) => texto.includes(tratador));
      })
      .map(relativo);

    expect(semTratador).toEqual([]);
  });
});
