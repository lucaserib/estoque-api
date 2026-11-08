import { describe, expect, it } from "vitest";
import { dividirBlocos, dividirInline, linkInternoSeguro } from "../markdown";

describe("dividirBlocos", () => {
  it("reconhece título, parágrafo, listas e tabela", () => {
    const blocos = dividirBlocos(
      [
        "## Resumo",
        "Você precisa comprar **3 produtos**.",
        "Linha seguinte.",
        "",
        "- Borrifador",
        "- Pulverizador",
        "",
        "1. Gere o pedido",
        "2. Envie ao fornecedor",
        "",
        "| Produto | Comprar |",
        "|---|---:|",
        "| Borrifador | 30 |",
        "| Pulverizador | 12 |",
      ].join("\n")
    );
    expect(blocos).toEqual([
      { tipo: "titulo", texto: "Resumo" },
      { tipo: "paragrafo", linhas: ["Você precisa comprar **3 produtos**.", "Linha seguinte."] },
      { tipo: "lista", ordenada: false, itens: ["Borrifador", "Pulverizador"] },
      { tipo: "lista", ordenada: true, itens: ["Gere o pedido", "Envie ao fornecedor"] },
      {
        tipo: "tabela",
        cabecalho: ["Produto", "Comprar"],
        linhas: [
          ["Borrifador", "30"],
          ["Pulverizador", "12"],
        ],
      },
    ]);
  });

  it("não transforma HTML em nada especial", () => {
    expect(dividirBlocos("<script>alert(1)</script>")).toEqual([{ tipo: "paragrafo", linhas: ["<script>alert(1)</script>"] }]);
  });
});

describe("dividirInline", () => {
  it("separa negrito, itálico, código e links internos", () => {
    expect(dividirInline("Veja **R$ 1.200,00** em [Reposição](/reposicao) e `SKU-1` _hoje_")).toEqual([
      { tipo: "texto", texto: "Veja " },
      { tipo: "negrito", texto: "R$ 1.200,00" },
      { tipo: "texto", texto: " em " },
      { tipo: "link", texto: "Reposição", href: "/reposicao" },
      { tipo: "texto", texto: " e " },
      { tipo: "codigo", texto: "SKU-1" },
      { tipo: "texto", texto: " " },
      { tipo: "italico", texto: "hoje" },
    ]);
  });

  it("transforma link externo ou perigoso em texto puro", () => {
    expect(dividirInline("[clique](https://golpe.com)")).toEqual([{ tipo: "texto", texto: "clique" }]);
    expect(dividirInline("[x](javascript:alert(1))").some((t) => t.tipo === "link")).toBe(false);
    expect(linkInternoSeguro("javascript:alert(1)")).toBeNull();
    expect(linkInternoSeguro("//golpe.com")).toBeNull();
    expect(linkInternoSeguro("/produtos?pendencia=SEM_CUSTO")).toBe("/produtos?pendencia=SEM_CUSTO");
  });
});
