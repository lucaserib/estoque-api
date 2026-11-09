import { Fragment, type ReactNode } from "react";
import Link from "next/link";

type Bloco =
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: string[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] };

const ITEM = /^\s*(?:[-*]|(\d+)[.)])\s+(.*)$/;

function celulas(linha: string): string[] {
  return linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function analisarDocumento(texto: string): Bloco[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.trim()) {
      i++;
      continue;
    }
    const titulo = /^(#{1,6})\s+(.*)$/.exec(linha);
    if (titulo) {
      blocos.push({ tipo: "titulo", nivel: titulo[1].length, texto: titulo[2].trim() });
      i++;
      continue;
    }
    if (linha.startsWith(">")) {
      const trecho: string[] = [];
      while (i < linhas.length && linhas[i].startsWith(">")) trecho.push(linhas[i++].replace(/^>\s?/, ""));
      blocos.push({ tipo: "aviso", texto: trecho.join(" ") });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(linha)) {
      const tabela: string[] = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) tabela.push(linhas[i++]);
      const [cabecalho, , ...resto] = tabela;
      blocos.push({ tipo: "tabela", cabecalho: celulas(cabecalho), linhas: resto.map(celulas) });
      continue;
    }
    if (ITEM.test(linha)) {
      const ordenada = Boolean(ITEM.exec(linha)?.[1]);
      const itens: string[] = [];
      while (i < linhas.length && ITEM.test(linhas[i])) itens.push(ITEM.exec(linhas[i++])![2]);
      blocos.push({ tipo: "lista", ordenada, itens });
      continue;
    }
    const paragrafo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,6}\s|>|\s*\|)/.test(linhas[i]) && !ITEM.test(linhas[i])) {
      paragrafo.push(linhas[i++].trim());
    }
    blocos.push({ tipo: "paragrafo", texto: paragrafo.join(" ") });
  }
  return blocos;
}

function Inline({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  const padrao = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let ultimo = 0;
  for (const achado of texto.matchAll(padrao)) {
    const inicio = achado.index ?? 0;
    if (inicio > ultimo) partes.push(texto.slice(ultimo, inicio));
    const bruto = achado[0];
    if (bruto.startsWith("**")) {
      partes.push(<strong key={inicio} className="font-semibold text-foreground">{bruto.slice(2, -2)}</strong>);
    } else if (bruto.startsWith("`")) {
      partes.push(<code key={inicio} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{bruto.slice(1, -1)}</code>);
    } else {
      const [, rotulo, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(bruto)!;
      if (href.startsWith("/") && !href.startsWith("//")) {
        partes.push(<Link key={inicio} href={href} className="font-medium text-primary underline underline-offset-2">{rotulo}</Link>);
      } else if (/^https:\/\//.test(href)) {
        partes.push(<a key={inicio} href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">{rotulo}</a>);
      } else {
        partes.push(rotulo);
      }
    }
    ultimo = inicio + bruto.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes.map((parte, i) => <Fragment key={i}>{parte}</Fragment>)}</>;
}

export function DocumentoMarkdown({ texto }: { texto: string }) {
  return (
    <article className="space-y-4 text-[15px] leading-relaxed text-fg2">
      {analisarDocumento(texto).map((bloco, i) => {
        if (bloco.tipo === "titulo") {
          if (bloco.nivel === 1) return <h1 key={i} className="text-3xl font-semibold tracking-tight text-foreground">{bloco.texto}</h1>;
          return <h2 key={i} className="pt-4 text-lg font-semibold text-foreground">{bloco.texto}</h2>;
        }
        if (bloco.tipo === "aviso") {
          return (
            <p key={i} className="rounded-lg border border-warning/30 bg-warning/[0.08] px-4 py-3 text-sm text-foreground">
              <Inline texto={bloco.texto} />
            </p>
          );
        }
        if (bloco.tipo === "lista") {
          const Tag = bloco.ordenada ? "ol" : "ul";
          return (
            <Tag key={i} className={`space-y-1.5 pl-5 ${bloco.ordenada ? "list-decimal" : "list-disc"}`}>
              {bloco.itens.map((item, j) => (
                <li key={j}>
                  <Inline texto={item} />
                </li>
              ))}
            </Tag>
          );
        }
        if (bloco.tipo === "tabela") {
          return (
            <div key={i} className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {bloco.cabecalho.map((c, j) => (
                      <th key={j} className="px-3 py-2 text-left font-semibold text-foreground">
                        <Inline texto={c} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloco.linhas.map((linha, j) => (
                    <tr key={j} className="border-t border-border">
                      {linha.map((c, k) => (
                        <td key={k} className="px-3 py-2 align-top">
                          <Inline texto={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i}>
            <Inline texto={bloco.texto} />
          </p>
        );
      })}
    </article>
  );
}
