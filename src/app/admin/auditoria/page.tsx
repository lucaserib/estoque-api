"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PainelAdmin } from "@/components/admin/ui";

interface Registro {
  id: string;
  adminEmail: string;
  acao: string;
  alvoTipo: string;
  alvoId: string | null;
  antes: unknown;
  depois: unknown;
  motivo: string | null;
  ip: string | null;
  createdAt: string;
}

export default function AdminAuditoriaPage() {
  const [filtros, setFiltros] = useState({ admin: "", acao: "", alvoId: "" });
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const p = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    const r = await fetch(`/api/admin/auditoria?${p.toString()}`);
    if (r.ok) setRegistros((await r.json()).registros);
  }, [filtros]);

  useEffect(() => {
    const espera = setTimeout(carregar, 300);
    return () => clearTimeout(espera);
  }, [carregar]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="Auditoria" subtitle="Toda ação do admin que mudou algum dado, com quem, quando, o antes e o depois." />
      <PainelAdmin titulo="Filtros">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="E-mail do admin" value={filtros.admin} onChange={(e) => setFiltros({ ...filtros, admin: e.target.value })} aria-label="Filtrar por admin" />
          <Input placeholder="Ação (ex.: CUPOM)" value={filtros.acao} onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })} aria-label="Filtrar por ação" />
          <Input placeholder="Id do alvo" value={filtros.alvoId} onChange={(e) => setFiltros({ ...filtros, alvoId: e.target.value })} aria-label="Filtrar por alvo" />
        </div>
      </PainelAdmin>
      <PainelAdmin titulo="Registros">
        {!registros ? (
          <Skeleton className="h-64 w-full" />
        ) : registros.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {registros.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <button type="button" onClick={() => setAberto(aberto === r.id ? null : r.id)} className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left">
                  <span>
                    <strong className="font-semibold">{r.acao}</strong> <span className="text-muted-foreground">em {r.alvoTipo} {r.alvoId ?? ""}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {r.adminEmail}
                  </span>
                </button>
                {r.motivo && <p className="mt-1 text-fg2">Motivo: {r.motivo}</p>}
                {aberto === r.id && (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(r.antes, null, 2) ?? "—"}</pre>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(r.depois, null, 2) ?? "—"}</pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PainelAdmin>
    </div>
  );
}
