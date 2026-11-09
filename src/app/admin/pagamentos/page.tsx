"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { DialogoAcaoAdmin, PainelAdmin, TabelaAdmin, baixarArquivo, chamarAdmin } from "@/components/admin/ui";
import { formatBRL, formatDateBR, formatNumberBR } from "@/lib/format";

interface Pagamento {
  id: string;
  mpPaymentId: string;
  contaId: string;
  tipo: "ASSINATURA" | "CREDITO_IA";
  valorCentavos: number;
  status: string;
  metodo: string | null;
  aprovadoEm: string | null;
  createdAt: string;
  emailConta: string | null;
  loja: string | null;
}

interface Assinatura {
  userId: string;
  status: string;
  plan: string | null;
  precoContratadoCentavos: number | null;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  proximaCobrancaEm: string | null;
  descontoAplicadoCentavos: number | null;
  pausadaAte: string | null;
  email: string;
  loja: string | null;
  testeInterno: boolean;
}

const TOM_STATUS: Record<string, "success" | "warning" | "critical" | "neutral"> = {
  approved: "success",
  pending: "warning",
  in_process: "warning",
  rejected: "critical",
  cancelled: "neutral",
  refunded: "neutral",
  charged_back: "critical",
};

export default function AdminPagamentosPage() {
  const [aba, setAba] = useState<"pagamentos" | "assinaturas">("pagamentos");
  const [filtros, setFiltros] = useState({ tipo: "", status: "", de: "", ate: "" });
  const [pagamentos, setPagamentos] = useState<Pagamento[] | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[] | null>(null);
  const [estorno, setEstorno] = useState<Pagamento | null>(null);

  const parametros = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();

  const carregar = useCallback(async () => {
    const [p, a] = await Promise.all([fetch(`/api/admin/pagamentos?${parametros}`), fetch("/api/admin/assinaturas")]);
    if (p.ok) setPagamentos((await p.json()).pagamentos);
    if (a.ok) setAssinaturas((await a.json()).assinaturas);
  }, [parametros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const porStatus = (assinaturas ?? []).reduce<Record<string, number>>((t, a) => ({ ...t, [a.status]: (t[a.status] ?? 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Assinaturas e pagamentos"
        subtitle="Todo pagamento do Mercado Pago passa por aqui. Valores sem dados de cartão."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => baixarArquivo(`/api/admin/pagamentos?${parametros}${parametros ? "&" : ""}formato=csv`)}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />
      <div className="flex gap-2" role="tablist">
        {(["pagamentos", "assinaturas"] as const).map((valor) => (
          <Button key={valor} role="tab" aria-selected={aba === valor} variant={aba === valor ? "default" : "outline"} size="sm" onClick={() => setAba(valor)}>
            {valor === "pagamentos" ? "Pagamentos" : "Assinaturas"}
          </Button>
        ))}
      </div>

      {aba === "pagamentos" ? (
        <>
          <PainelAdmin titulo="Filtros">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-muted-foreground">
                Tipo
                <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} className="mt-0.5 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground">
                  <option value="">Todos</option>
                  <option value="ASSINATURA">Assinatura</option>
                  <option value="CREDITO_IA">Perguntas da IA</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Status
                <select value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })} className="mt-0.5 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground">
                  <option value="">Todos</option>
                  {Object.keys(TOM_STATUS).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                De
                <Input type="date" value={filtros.de} onChange={(e) => setFiltros({ ...filtros, de: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Até
                <Input type="date" value={filtros.ate} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })} />
              </label>
            </div>
          </PainelAdmin>
          <PainelAdmin titulo={pagamentos ? `${formatNumberBR(pagamentos.length)} pagamento(s)` : "Pagamentos"}>
            {!pagamentos ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TabelaAdmin
                colunas={[{ titulo: "Data" }, { titulo: "Conta" }, { titulo: "Tipo" }, { titulo: "Status" }, { titulo: "Meio" }, { titulo: "Valor", alinhar: "direita" }, { titulo: "" }]}
                linhas={pagamentos.map((p) => [
                  formatDateBR(p.aprovadoEm ?? p.createdAt),
                  <Link key="c" href={`/admin/contas/${p.contaId}`} className="hover:underline">{p.loja ?? p.emailConta ?? p.contaId}</Link>,
                  p.tipo === "CREDITO_IA" ? "Perguntas da IA" : "Assinatura",
                  <StatusPill key="s" tone={TOM_STATUS[p.status] ?? "neutral"}>{p.status}</StatusPill>,
                  p.metodo ?? "—",
                  formatBRL(p.valorCentavos),
                  p.tipo === "CREDITO_IA" && p.status === "approved" ? (
                    <Button key="e" size="sm" variant="ghost" className="text-destructive-text" onClick={() => setEstorno(p)}>Estornar</Button>
                  ) : (
                    ""
                  ),
                ])}
                vazio="Nenhum pagamento com esses filtros."
              />
            )}
          </PainelAdmin>
        </>
      ) : (
        <PainelAdmin titulo={`Assinaturas · ${Object.entries(porStatus).map(([s, n]) => `${s} ${n}`).join(" · ")}`}>
          {!assinaturas ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <TabelaAdmin
              colunas={[{ titulo: "Conta" }, { titulo: "Status" }, { titulo: "Plano" }, { titulo: "Preço", alinhar: "direita" }, { titulo: "Próxima cobrança" }, { titulo: "Observação" }]}
              linhas={assinaturas.map((a) => [
                <Link key="c" href={`/admin/contas/${a.userId}`} className="hover:underline">{a.loja ?? a.email}{a.testeInterno ? " (interna)" : ""}</Link>,
                a.status,
                a.plan === "ANNUAL" ? "Anual" : a.plan === "MONTHLY" ? "Mensal" : "—",
                a.precoContratadoCentavos ? formatBRL(a.precoContratadoCentavos) : "—",
                a.status === "TRIALING" ? `fim do teste ${formatDateBR(a.trialEndsAt)}` : a.proximaCobrancaEm ? formatDateBR(a.proximaCobrancaEm) : a.currentPeriodEnd ? formatDateBR(a.currentPeriodEnd) : "—",
                [a.descontoAplicadoCentavos ? `desconto ${formatBRL(a.descontoAplicadoCentavos)}` : null, a.pausadaAte ? `pausada até ${formatDateBR(a.pausadaAte)}` : null].filter(Boolean).join(" · ") || "—",
              ])}
            />
          )}
        </PainelAdmin>
      )}

      <DialogoAcaoAdmin
        aberto={estorno !== null}
        aoFechar={() => setEstorno(null)}
        titulo="Estornar compra de perguntas"
        descricao={estorno ? `Devolve ${formatBRL(estorno.valorCentavos)} pelo Mercado Pago e retira as perguntas que sobraram desse pacote.` : undefined}
        perigoso
        rotuloConfirmar="Estornar"
        aoConfirmar={async (motivo) => {
          if (!estorno) return;
          const r = await chamarAdmin<{ perguntasRetiradas: number }>(`/api/admin/pagamentos/${estorno.id}/estorno`, "POST", { motivo });
          await carregar();
          return `Estornado. ${r.perguntasRetiradas} pergunta(s) retiradas.`;
        }}
      />
    </div>
  );
}
