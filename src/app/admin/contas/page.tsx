"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { formatBRL, formatDateBR, formatNumberBR, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LinhaContaAdmin } from "@/modules/admin/metricas";

const STATUS_IA: Record<string, { texto: string; tom: "success" | "info" | "warning" | "critical" | "neutral" }> = {
  ATIVA: { texto: "Assinante", tom: "success" },
  TESTE: { texto: "Em teste", tom: "info" },
  PENDENTE: { texto: "Pagamento pendente", tom: "warning" },
  CANCELADA: { texto: "Cancelada", tom: "neutral" },
};

const STATUS: Record<string, { texto: string; tom: "success" | "info" | "warning" | "critical" | "neutral" }> = {
  ACTIVE: { texto: "Ativa", tom: "success" },
  TRIALING: { texto: "Em teste", tom: "info" },
  PAST_DUE: { texto: "Inadimplente", tom: "critical" },
  CANCELED: { texto: "Cancelada", tom: "neutral" },
};

type Filtro = "todas" | "ativas" | "teste" | "ia" | "sem-integracao";

const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "ativas", rotulo: "Pagantes" },
  { valor: "teste", rotulo: "Em teste" },
  { valor: "ia", rotulo: "IA (pedidos e ativas)" },
  { valor: "sem-integracao", rotulo: "Sem integração" },
];

function Integracao({ ativo, rotulo }: { ativo: boolean; rotulo: string }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        ativo ? "bg-success/15 text-success-text" : "bg-muted text-muted-foreground line-through"
      )}
    >
      {rotulo}
    </span>
  );
}

export default function AdminContasPage() {
  const [contas, setContas] = useState<LinhaContaAdmin[] | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [alterando, setAlterando] = useState<string | null>(null);

  useEffect(() => {
    const inicial = new URLSearchParams(window.location.search).get("filtro");
    if (inicial && FILTROS.some((f) => f.valor === inicial)) setFiltro(inicial as Filtro);
  }, []);

  const carregar = useCallback(async (termo: string) => {
    const resposta = await fetch(`/api/admin/contas${termo ? `?busca=${encodeURIComponent(termo)}` : ""}`);
    if (resposta.ok) setContas((await resposta.json()).contas);
  }, []);

  useEffect(() => {
    const espera = setTimeout(() => carregar(busca), 300);
    return () => clearTimeout(espera);
  }, [busca, carregar]);

  const visiveis = useMemo(
    () =>
      (contas ?? []).filter((c) => {
        if (filtro === "ativas") return c.assinatura?.status === "ACTIVE";
        if (filtro === "teste") return c.assinatura?.status === "TRIALING";
        if (filtro === "ia") {
          const a = c.assinatura;
          return Boolean(a && (a.iaLiberadaManual || a.iaSolicitadaEm || a.iaTesteIniciadoEm || a.iaStatus !== "INATIVA"));
        }
        if (filtro === "sem-integracao") return !c.mlConectado && !c.blingConectado;
        return true;
      }),
    [contas, filtro]
  );

  const alterarIa = async (
    conta: LinhaContaAdmin,
    mudanca: { liberadaManual?: boolean; orcamentoCentavos?: number | null }
  ) => {
    setAlterando(conta.id);
    try {
      const resposta = await fetch(`/api/admin/contas/${conta.id}/ia`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mudanca),
      });
      if (!resposta.ok) {
        toast.error("Não foi possível alterar a IA dessa conta.");
        return;
      }
      setContas((atual) =>
        (atual ?? []).map((c) =>
          c.id === conta.id
            ? {
                ...c,
                assinatura: {
                  status: c.assinatura?.status ?? "TRIALING",
                  plano: c.assinatura?.plano ?? null,
                  testeAte: c.assinatura?.testeAte ?? new Date().toISOString(),
                  iaStatus: c.assinatura?.iaStatus ?? "INATIVA",
                  iaTesteIniciadoEm: c.assinatura?.iaTesteIniciadoEm ?? null,
                  iaSolicitadaEm: c.assinatura?.iaSolicitadaEm ?? null,
                  iaLiberadaManual: mudanca.liberadaManual ?? c.assinatura?.iaLiberadaManual ?? false,
                  iaOrcamentoCentavos:
                    mudanca.orcamentoCentavos !== undefined
                      ? mudanca.orcamentoCentavos
                      : c.assinatura?.iaOrcamentoCentavos ?? null,
                },
              }
            : c
        )
      );
      if (mudanca.liberadaManual !== undefined) {
        toast.success(mudanca.liberadaManual ? `IA liberada para ${conta.email}` : `Liberação manual revogada para ${conta.email}`);
      } else {
        toast.success("Orçamento de IA atualizado.");
      }
    } finally {
      setAlterando(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="Contas" subtitle="Cada loja cadastrada, com plano, integrações e uso." />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="pl-9"
            aria-label="Buscar contas"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filtro === f.valor ? "border-primary bg-primary/10 text-primary" : "border-border text-fg2 hover:bg-muted"
              )}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {!contas ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma conta encontrada.
        </p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border/80 bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Loja</th>
                  <th className="px-3 py-3 text-left font-medium">Plano</th>
                  <th className="px-3 py-3 text-left font-medium">Integrações</th>
                  <th className="px-3 py-3 text-right font-medium">Produtos</th>
                  <th className="px-3 py-3 text-right font-medium">Pedidos 30d</th>
                  <th className="px-3 py-3 text-right font-medium">GMV 30d</th>
                  <th className="px-3 py-3 text-left font-medium">Última venda</th>
                  <th className="px-4 py-3 text-left font-medium">Skubo IA</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((conta) => {
                  const status = conta.assinatura ? STATUS[conta.assinatura.status] : null;
                  const pedidoIa =
                    conta.assinatura?.iaSolicitadaEm &&
                    !conta.assinatura.iaLiberadaManual &&
                    conta.assinatura.iaStatus !== "ATIVA";
                  const statusIa = conta.assinatura ? STATUS_IA[conta.assinatura.iaStatus] : null;
                  return (
                    <tr key={conta.id} className="border-t border-divider align-middle">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{conta.nome || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">
                          {conta.email} · desde {formatDateBR(conta.criadoEm)}
                          {conta.membros > 0 && ` · +${conta.membros} na equipe`}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {status ? (
                          <div className="space-y-1">
                            <StatusPill tone={status.tom}>{status.texto}</StatusPill>
                            <p className="text-[11px] text-muted-foreground">
                              {conta.assinatura?.status === "TRIALING"
                                ? `até ${formatDateBR(conta.assinatura.testeAte)}`
                                : conta.assinatura?.plano === "ANNUAL"
                                ? "Anual"
                                : conta.assinatura?.plano === "MONTHLY"
                                ? "Mensal"
                                : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem assinatura</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Integracao ativo={conta.mlConectado} rotulo="ML" />
                          <Integracao ativo={conta.blingConectado} rotulo="Bling" />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumberBR(conta.produtos)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumberBR(conta.pedidos30d)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{formatBRL(conta.gmv30d)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {conta.ultimaVenda ? formatRelativeTime(conta.ultimaVenda) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              {statusIa && <StatusPill tone={statusIa.tom}>{statusIa.texto}</StatusPill>}
                              {conta.assinatura?.iaLiberadaManual && <StatusPill tone="info">Manual</StatusPill>}
                              {pedidoIa && (
                                <span title="Pediu a IA" className="text-warning-text">
                                  <Sparkles className="h-4 w-4" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatBRL(conta.iaCustoMesCentavos)} no mês · {formatNumberBR(conta.iaChamadasMes)} chamadas
                            </p>
                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              Orçamento R$
                              <Input
                                key={`${conta.id}-${conta.assinatura?.iaOrcamentoCentavos ?? "padrao"}`}
                                defaultValue={
                                  conta.assinatura?.iaOrcamentoCentavos != null
                                    ? (conta.assinatura.iaOrcamentoCentavos / 100).toFixed(2)
                                    : ""
                                }
                                placeholder="padrão"
                                className="h-7 w-20 px-2 text-xs"
                                aria-label={`Orçamento mensal de IA para ${conta.email}`}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                                onBlur={(e) => {
                                  const bruto = e.target.value.trim().replace(",", ".");
                                  const atual = conta.assinatura?.iaOrcamentoCentavos ?? null;
                                  const novo = bruto === "" ? null : Math.round(Number(bruto) * 100);
                                  if (novo !== null && (!Number.isFinite(novo) || novo < 0)) {
                                    toast.error("Orçamento inválido.");
                                    return;
                                  }
                                  if (novo !== atual) alterarIa(conta, { orcamentoCentavos: novo });
                                }}
                              />
                            </label>
                          </div>
                          {alterando === conta.id ? (
                            <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={Boolean(conta.assinatura?.iaLiberadaManual)}
                              onCheckedChange={(liberadaManual) => alterarIa(conta, { liberadaManual })}
                              aria-label={`Liberar IA manualmente para ${conta.email}`}
                              title="Liberação manual (sem cobrança)"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
