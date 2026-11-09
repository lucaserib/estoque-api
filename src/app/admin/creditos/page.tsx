"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, MessageSquare, Receipt, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { PainelAdmin, TabelaAdmin } from "@/components/admin/ui";
import { formatBRL, formatNumberBR } from "@/lib/format";

interface Metricas {
  pacotes: Array<{ pacoteId: string; nome: string; vendas: number; receitaCentavos: number; perguntas: number; custoEstimadoCentavos: number | null; margemCentavos: number | null }>;
  mes: { perguntasConsumidas: number; chamadasIa: number; perguntasCobradas: number; custoCentavos: number; custoPorPerguntaCentavos: number | null };
  saldoParado: Array<{ contaId: string; email: string | null; loja: string | null; saldo: number }>;
  totalSaldoEmAberto: number;
}

export default function AdminCreditosPage() {
  const [dados, setDados] = useState<Metricas | null>(null);

  useEffect(() => {
    fetch("/api/admin/creditos")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDados);
  }, []);

  if (!dados) return <Skeleton className="h-96 w-full" />;
  const receita = dados.pacotes.reduce((t, p) => t + p.receitaCentavos, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="Créditos de IA" subtitle="Pacotes vendidos, consumo, custo por pergunta e margem." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Receipt} label="Receita com pacotes (total)" value={formatBRL(receita)} note={`${formatNumberBR(dados.pacotes.reduce((t, p) => t + p.vendas, 0))} venda(s)`} />
        <StatCard icon={MessageSquare} label="Perguntas consumidas (mês)" value={formatNumberBR(dados.mes.perguntasConsumidas)} note={`${formatNumberBR(dados.mes.chamadasIa)} chamadas à IA`} />
        <StatCard
          icon={Coins}
          label="Custo por pergunta (mês)"
          value={dados.mes.custoPorPerguntaCentavos === null ? "—" : formatBRL(Math.round(dados.mes.custoPorPerguntaCentavos))}
          note={`Custo total ${formatBRL(dados.mes.custoCentavos)}`}
        />
        <StatCard icon={TrendingUp} label="Perguntas em aberto" value={formatNumberBR(dados.totalSaldoEmAberto)} note="Saldo válido de todas as contas" />
      </div>
      <PainelAdmin titulo="Margem por pacote">
        <TabelaAdmin
          colunas={[{ titulo: "Pacote" }, { titulo: "Vendas", alinhar: "direita" }, { titulo: "Receita", alinhar: "direita" }, { titulo: "Custo estimado", alinhar: "direita" }, { titulo: "Margem", alinhar: "direita" }]}
          linhas={dados.pacotes.map((p) => [
            p.nome,
            formatNumberBR(p.vendas),
            formatBRL(p.receitaCentavos),
            p.custoEstimadoCentavos === null ? "—" : formatBRL(p.custoEstimadoCentavos),
            p.margemCentavos === null ? "—" : formatBRL(p.margemCentavos),
          ])}
          vazio="Nenhum pacote vendido ainda."
        />
        <p className="mt-3 text-xs text-muted-foreground">Custo estimado = perguntas vendidas × custo médio por pergunta do mês (UsoIa).</p>
      </PainelAdmin>
      <PainelAdmin titulo="Contas com saldo parado (sem perguntar há 30 dias)">
        <TabelaAdmin
          colunas={[{ titulo: "Conta" }, { titulo: "Saldo", alinhar: "direita" }]}
          linhas={dados.saldoParado.map((c) => [
            <Link key="c" href={`/admin/contas/${c.contaId}`} className="hover:underline">{c.loja ?? c.email ?? c.contaId}</Link>,
            formatNumberBR(c.saldo),
          ])}
          vazio="Todo mundo com saldo está usando."
        />
      </PainelAdmin>
    </div>
  );
}
