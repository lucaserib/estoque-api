"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { dividirBlocos, dividirInline } from "./markdown";

function Inline({ texto, aoNavegar }: { texto: string; aoNavegar?: () => void }) {
  return (
    <>
      {dividirInline(texto).map((trecho, i) => {
        if (trecho.tipo === "negrito") return <strong key={i} className="font-semibold text-foreground">{trecho.texto}</strong>;
        if (trecho.tipo === "italico") return <em key={i}>{trecho.texto}</em>;
        if (trecho.tipo === "codigo") {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              {trecho.texto}
            </code>
          );
        }
        if (trecho.tipo === "link") {
          return (
            <Link key={i} href={trecho.href} onClick={aoNavegar} className="font-medium text-primary underline underline-offset-2">
              {trecho.texto}
            </Link>
          );
        }
        return <Fragment key={i}>{trecho.texto}</Fragment>;
      })}
    </>
  );
}

export function MarkdownSeguro({ texto, className, aoNavegar }: { texto: string; className?: string; aoNavegar?: () => void }) {
  const blocos = dividirBlocos(texto);
  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed text-fg2", className)}>
      {blocos.map((bloco, i): ReactNode => {
        if (bloco.tipo === "titulo") {
          return (
            <p key={i} className="font-semibold text-foreground">
              <Inline texto={bloco.texto} aoNavegar={aoNavegar} />
            </p>
          );
        }
        if (bloco.tipo === "lista") {
          const Tag = bloco.ordenada ? "ol" : "ul";
          return (
            <Tag key={i} className={cn("space-y-1 pl-5", bloco.ordenada ? "list-decimal" : "list-disc")}>
              {bloco.itens.map((item, j) => (
                <li key={j}>
                  <Inline texto={item} aoNavegar={aoNavegar} />
                </li>
              ))}
            </Tag>
          );
        }
        if (bloco.tipo === "tabela") {
          return (
            <div key={i} className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    {bloco.cabecalho.map((c, j) => (
                      <th key={j} className="px-2.5 py-1.5 text-left font-semibold text-foreground">
                        <Inline texto={c} aoNavegar={aoNavegar} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloco.linhas.map((linha, j) => (
                    <tr key={j} className="border-t border-divider">
                      {linha.map((c, k) => (
                        <td key={k} className="px-2.5 py-1.5 tabular-nums">
                          <Inline texto={c} aoNavegar={aoNavegar} />
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
            {bloco.linhas.map((linha, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline texto={linha} aoNavegar={aoNavegar} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
