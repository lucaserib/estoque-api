import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { AUTOMACOES_PADRAO, renderizarAutomacao } from "../automacoes";
import { renderizarMarkdownEmail } from "../markdown";

describe("automações", () => {
  it("cobre todas as chaves do plano", () => {
    expect(AUTOMACOES_PADRAO.map((a) => a.chave).sort()).toEqual(
      [
        "boas-vindas",
        "cancelou",
        "conectar-bling",
        "conectar-ml",
        "creditos-acabando",
        "creditos-esgotados",
        "ia-perguntas-gratis",
        "indicacao-entrou",
        "indicacao-recompensa",
        "pagamento-falhou",
        "primeira-reposicao",
        "renovacao-anual",
        "teste-acabando",
        "teste-terminou",
        "volte-14",
        "volte-3",
      ].sort()
    );
  });

  it("troca as variáveis e tira a linha do cupom quando não há cupom", () => {
    const volte = AUTOMACOES_PADRAO.find((a) => a.chave === "volte-3")!;
    const sem = renderizarAutomacao({ ...volte, cupomCodigo: null }, { nome: "Ana", loja: "loja Ana" });
    expect(sem.assunto).toBe("Sentimos sua falta, Ana");
    expect(sem.corpo).not.toContain("cupom");
    const com = renderizarAutomacao({ ...volte, cupomCodigo: "VOLTA20" }, { nome: "Ana", loja: "loja Ana" });
    expect(com.corpo).toContain("**VOLTA20**");
  });

  it("markdown do e-mail escapa HTML e só aceita links http(s)", () => {
    const { html, texto } = renderizarMarkdownEmail('Oi <script>x</script> [ok](https://skubo.com.br) [ruim](javascript:alert(1))');
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="https://skubo.com.br"');
    expect(html).not.toContain("javascript:");
    expect(texto).toContain("ok (https://skubo.com.br)");
  });
});
