"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { PainelAdmin, ROTULO_SITUACAO, TabelaAdmin } from "@/components/admin/ui";
import { formatBRL, formatDateBR, formatNumberBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LinhaConta } from "@/modules/admin/contas";

const FILTROS = [
  { chave: "situacao", rotulo: "Situação", opcoes: [["", "Todas"], ["TESTE", "Em teste"], ["ATIVA", "Ativa"], ["INADIMPLENTE", "Inadimplente"], ["VENCIDA", "Vencida"], ["CANCELADA", "Cancelada"], ["BLOQUEADA", "Bloqueada"]] },
  { chave: "plano", rotulo: "Plano", opcoes: [["", "Todos"], ["MONTHLY", "Mensal"], ["ANNUAL", "Anual"], ["SEM", "Sem plano"]] },
  { chave: "origem", rotulo: "Origem", opcoes: [["", "Todas"], ["indicacao", "Indicação"], ["INSTAGRAM", "Instagram"], ["YOUTUBE", "YouTube"], ["GOOGLE", "Google"], ["GRUPO_WHATSAPP", "Grupo de WhatsApp"], ["OUTRO", "Outro"]] },
  { chave: "ml", rotulo: "Mercado Livre", opcoes: [["", "Tanto faz"], ["sim", "Conectado"], ["nao", "Sem"]] },
  { chave: "bling", rotulo: "Bling", opcoes: [["", "Tanto faz"], ["sim", "Conectado"], ["nao", "Sem"]] },
  { chave: "saldoIa", rotulo: "Saldo da IA", opcoes: [["", "Tanto faz"], ["com", "Com perguntas"], ["sem", "Sem perguntas"]] },
  { chave: "testeInterno", rotulo: "Teste interno", opcoes: [["", "Tanto faz"], ["sim", "Só internas"], ["nao", "Sem internas"]] },
] as const;

function Selo({ ativo, rotulo }: { ativo: boolean; rotulo: string }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", ativo ? "bg-success/15 text-success-text" : "bg-muted text-muted-foreground line-through")}>
      {rotulo}
    </span>
  );
}

export default function AdminContasPage() {
  const [contas, setContas] = useState<LinhaConta[] | null>(null);
  const [filtros, setFiltros] = useState<Record<string, string>>({ busca: "", de: "", ate: "" });

  const carregar = useCallback(async (atuais: Record<string, string>) => {
    const parametros = new URLSearchParams(Object.entries(atuais).filter(([, v]) => v));
    const resposta = await fetch(`/api/admin/contas?${parametros.toString()}`);
    if (resposta.ok) setContas((await resposta.json()).contas);
  }, []);

  useEffect(() => {
    const espera = setTimeout(() => carregar(filtros), 300);
    return () => clearTimeout(espera);
  }, [filtros, carregar]);

  const mudar = (chave: string, valor: string) => setFiltros((anterior) => ({ ...anterior, [chave]: valor }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="Contas" subtitle="Cada loja, sua situação, origem e uso. Clique para ver tudo e agir." />

      <PainelAdmin titulo="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filtros.busca} onChange={(e) => mudar("busca", e.target.value)} placeholder="E-mail, nome ou loja" className="pl-9" aria-label="Buscar conta" />
          </label>
          <label className="text-xs text-muted-foreground">
            Cadastro de
            <Input type="date" value={filtros.de} onChange={(e) => mudar("de", e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            até
            <Input type="date" value={filtros.ate} onChange={(e) => mudar("ate", e.target.value)} />
          </label>
          {FILTROS.map((filtro) => (
            <label key={filtro.chave} className="text-xs text-muted-foreground">
              {filtro.rotulo}
              <select
                value={filtros[filtro.chave] ?? ""}
                onChange={(e) => mudar(filtro.chave, e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
              >
                {filtro.opcoes.map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </PainelAdmin>

      <PainelAdmin titulo={contas ? `${formatNumberBR(contas.length)} conta(s)` : "Contas"}>
        {!contas ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <TabelaAdmin
            colunas={[
              { titulo: "Conta" },
              { titulo: "Situação" },
              { titulo: "Plano" },
              { titulo: "Integrações" },
              { titulo: "IA", alinhar: "direita" },
              { titulo: "Origem" },
              { titulo: "Cadastro", alinhar: "direita" },
            ]}
            linhas={contas.map((c) => [
              <Link key="conta" href={`/admin/contas/${c.contaId}`} className="block min-w-[200px] hover:underline">
                <span className="block font-medium text-foreground">{c.loja ?? c.nome ?? "Sem nome"}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.email}
                  {c.membros > 0 && ` · +${c.membros} na equipe`}
                  {c.testeInterno && " · teste interno"}
                </span>
              </Link>,
              <StatusPill key="s" tone={ROTULO_SITUACAO[c.situacao]?.tom ?? "neutral"}>
                {ROTULO_SITUACAO[c.situacao]?.texto ?? c.situacao}
              </StatusPill>,
              c.plano ? `${c.plano === "ANNUAL" ? "Anual" : "Mensal"}${c.precoContratadoCentavos ? ` · ${formatBRL(c.precoContratadoCentavos)}` : ""}` : "—",
              <span key="i" className="flex gap-1">
                <Selo ativo={c.ml} rotulo="ML" />
                <Selo ativo={c.bling} rotulo="Bling" />
              </span>,
              c.iaLiberadaManual ? "Ilimitada" : formatNumberBR(c.saldoIa),
              c.indicada ? "Indicação" : c.origem ?? "—",
              formatDateBR(c.criadaEm),
            ])}
            vazio="Nenhuma conta com esses filtros."
          />
        )}
      </PainelAdmin>
    </div>
  );
}
