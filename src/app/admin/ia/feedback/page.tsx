"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ThumbsDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import type { PaginaFeedbackIa } from "@/modules/admin/feedbackIa";

export default function AdminFeedbackIaPage() {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaFeedbackIa | null>(null);

  const carregar = useCallback(async (numero: number) => {
    setDados(null);
    const resposta = await fetch(`/api/admin/ia/feedback?pagina=${numero}`);
    if (resposta.ok) setDados(await resposta.json());
  }, []);

  useEffect(() => {
    carregar(pagina);
  }, [carregar, pagina]);

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Feedback da IA"
        subtitle="Respostas marcadas como não úteis, com a pergunta que as gerou. Use para ajustar o prompt."
      />

      {!dados ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : dados.itens.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma resposta marcada com 👎 ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {dados.itens.map((item) => (
            <li key={item.id} className="space-y-3 rounded-card border border-border/80 bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <ThumbsDown className="h-3.5 w-3.5 text-destructive-text" />
                <span>{item.conta}</span>
                <span>· {formatRelativeTime(item.criadoEm)}</span>
                {item.ferramentas.length > 0 && <span>· ferramentas: {item.ferramentas.join(", ")}</span>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pergunta</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.pergunta ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resposta</p>
                <p className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-fg2">
                  {item.resposta}
                </p>
              </div>
              {item.comentario && (
                <p className="text-sm text-fg2">
                  <span className="font-semibold text-foreground">Comentário:</span> {item.comentario}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {dados && dados.total > dados.porPagina && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {pagina} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
