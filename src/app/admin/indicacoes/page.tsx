"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Gift, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { DialogoAcaoAdmin, PainelAdmin, TabelaAdmin, chamarAdmin } from "@/components/admin/ui";
import { formatBRL, formatDateBR, formatNumberBR } from "@/lib/format";

interface Painel {
  resumo: { porStatus: Record<string, number>; diasConcedidos: number; aguardandoMl: number; custoReceitaAdiadaCentavos: number };
  ranking: Array<{ contaId: string; email: string | null; recompensadas: number }>;
  indicacoes: Array<{
    id: string;
    status: string;
    rotuloStatus: string;
    motivoInvalidacao: string | null;
    indicador: string | null;
    indicado: string | null;
    indicadorContaId: string;
    indicadoContaId: string;
    createdAt: string;
    carenciaAte: string | null;
    aprovadaManualmentePor: string | null;
  }>;
}

const TOM: Record<string, "success" | "warning" | "critical" | "neutral" | "info"> = {
  CADASTRADO: "neutral",
  ATIVADO: "info",
  PAGOU: "info",
  EM_CARENCIA: "warning",
  RECOMPENSADA: "success",
  INVALIDADA: "critical",
};

export default function AdminIndicacoesPage() {
  const [status, setStatus] = useState("");
  const [painel, setPainel] = useState<Painel | null>(null);
  const [decisao, setDecisao] = useState<{ id: string; tipo: "aprovar" | "invalidar" } | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/admin/indicacoes${status ? `?status=${status}` : ""}`);
    if (r.ok) setPainel(await r.json());
  }, [status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="Indicações" subtitle="Quem indicou quem, o que valeu e quanto o programa custa." />
      {!painel ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Gift} label="Recompensadas" value={formatNumberBR(painel.resumo.porStatus.RECOMPENSADA ?? 0)} note={`${painel.resumo.porStatus.EM_CARENCIA ?? 0} em carência${painel.resumo.aguardandoMl ? ` (${painel.resumo.aguardandoMl} sem ML)` : ""} · ${painel.resumo.porStatus.INVALIDADA ?? 0} inválidas`} />
            <StatCard icon={CalendarClock} label="Dias concedidos" value={formatNumberBR(painel.resumo.diasConcedidos)} />
            <StatCard icon={Wallet} label="Receita adiada (estimada)" value={formatBRL(painel.resumo.custoReceitaAdiadaCentavos)} note="Dias × preço mensal ÷ 30" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <PainelAdmin
              titulo="Indicações"
              acao={
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                  <option value="">Todas</option>
                  {Object.keys(TOM).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              }
            >
              <TabelaAdmin
                colunas={[{ titulo: "Quem indicou" }, { titulo: "Indicado" }, { titulo: "Status" }, { titulo: "Motivo" }, { titulo: "" }]}
                linhas={painel.indicacoes.map((i) => [
                  <Link key="a" href={`/admin/contas/${i.indicadorContaId}`} className="hover:underline">{i.indicador ?? "—"}</Link>,
                  <Link key="b" href={`/admin/contas/${i.indicadoContaId}`} className="hover:underline">{i.indicado ?? "—"}</Link>,
                  <StatusPill key="s" tone={TOM[i.status] ?? "neutral"}>{i.rotuloStatus}</StatusPill>,
                  i.motivoInvalidacao ?? (i.carenciaAte && i.status === "EM_CARENCIA" ? `carência até ${formatDateBR(i.carenciaAte)}` : "—"),
                  <span key="acoes" className="flex gap-1">
                    {i.status !== "RECOMPENSADA" && (
                      <Button size="sm" variant="ghost" onClick={() => setDecisao({ id: i.id, tipo: "aprovar" })}>Aprovar</Button>
                    )}
                    {i.status !== "RECOMPENSADA" && i.status !== "INVALIDADA" && (
                      <Button size="sm" variant="ghost" className="text-destructive-text" onClick={() => setDecisao({ id: i.id, tipo: "invalidar" })}>Invalidar</Button>
                    )}
                  </span>,
                ])}
                vazio="Nenhuma indicação."
              />
            </PainelAdmin>
            <PainelAdmin titulo="Quem mais indica">
              <TabelaAdmin
                colunas={[{ titulo: "Conta" }, { titulo: "Recompensas", alinhar: "direita" }]}
                linhas={painel.ranking.map((r) => [
                  <Link key="r" href={`/admin/contas/${r.contaId}`} className="hover:underline">{r.email ?? r.contaId}</Link>,
                  formatNumberBR(r.recompensadas),
                ])}
                vazio="Ninguém ainda."
              />
            </PainelAdmin>
          </div>
        </>
      )}
      <DialogoAcaoAdmin
        aberto={decisao !== null}
        aoFechar={() => setDecisao(null)}
        titulo={decisao?.tipo === "aprovar" ? "Aprovar e liberar a recompensa" : "Invalidar a indicação"}
        descricao={decisao?.tipo === "aprovar" ? "Concede os dias agora, mesmo que o antifraude tenha barrado." : "O motivo aparece para quem indicou."}
        perigoso={decisao?.tipo === "invalidar"}
        aoConfirmar={async (motivo) => {
          if (!decisao) return;
          await chamarAdmin(`/api/admin/indicacoes/${decisao.id}`, "POST", { decisao: decisao.tipo, motivo });
          await carregar();
          return "Feito e registrado na auditoria.";
        }}
      />
    </div>
  );
}
