import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..");
const POSTS_SEM_ALTERACAO = new Set(["ia/teste/route.ts", "email/publico/route.ts", "email/gerar/route.ts"]);

function rotas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return entrada.name === "__tests__" ? [] : rotas(caminho);
    return entrada.name === "route.ts" ? [caminho] : [];
  });
}

describe("auditoria do admin", () => {
  const arquivos = rotas(RAIZ);

  it("encontra as rotas do admin", () => {
    expect(arquivos.length).toBeGreaterThan(15);
  });

  it("toda rota do admin que muda dado chama auditar()", () => {
    const semAuditoria = arquivos
      .map((arquivo) => ({ rel: path.relative(RAIZ, arquivo).split(path.sep).join("/"), texto: fs.readFileSync(arquivo, "utf8") }))
      .filter(({ texto }) => /export async function (POST|PUT|PATCH|DELETE)\b/.test(texto))
      .filter(({ rel }) => !POSTS_SEM_ALTERACAO.has(rel))
      .filter(({ texto }) => !texto.includes("auditar("))
      .map(({ rel }) => rel);
    expect(semAuditoria).toEqual([]);
  });

  it("toda rota do admin passa por verifyAdminPlataforma", () => {
    const abertas = arquivos.filter((arquivo) => !fs.readFileSync(arquivo, "utf8").includes("verifyAdminPlataforma(")).map((a) => path.relative(RAIZ, a));
    expect(abertas).toEqual([]);
  });
});
