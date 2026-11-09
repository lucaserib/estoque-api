"use client";

import { Gift, Repeat, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL, formatNumberBR, formatPercent } from "@/lib/format";
import type { MetricasComerciais } from "@/modules/admin/comercial";
import { PainelAdmin, TabelaAdmin } from "./ui";

const ROTULOS_ORIGEM: Record<string, string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  INDICACAO: "Indicação",
  GOOGLE: "Google",
  GRUPO_WHATSAPP: "Grupo de WhatsApp",
  OUTRO: "Outro",
};

function pct(valor: number | null) {
  return valor === null ? "—" : formatPercent(valor * 100, 1);
}

function Funil({ funil }: { funil: MetricasComerciais["funil"] }) {
  const etapas = [
    { rotulo: "Cadastros", valor: funil.cadastros },
    { rotulo: "E-mail verificado", valor: funil.emailVerificado },
    { rotulo: "Mercado Livre conectado", valor: funil.mlConectado },
    { rotulo: "Viu a primeira reposição", valor: funil.primeiraReposicao },
    { rotulo: "Assinou", valor: funil.assinaram },
  ];
  const topo = Math.max(1, funil.cadastros);
  return (
    <ol className="space-y-2.5">
      {etapas.map((etapa) => (
        <li key={etapa.rotulo}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-fg2">{etapa.rotulo}</span>
            <span className="font-semibold tabular-nums">
              {formatNumberBR(etapa.valor)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{formatPercent((etapa.valor / topo) * 100, 0)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((etapa.valor / topo) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function TabelaOrigem({ linhas }: { linhas: Array<{ chave: string; total: number }> }) {
  return (
    <TabelaAdmin
      colunas={[{ titulo: "Origem" }, { titulo: "Total", alinhar: "direita" }]}
      linhas={linhas.slice(0, 8).map((l) => [ROTULOS_ORIGEM[l.chave] ?? l.chave, formatNumberBR(l.total)])}
      vazio="Sem dados no período."
    />
  );
}

export function PainelComercial({ comercial }: { comercial: MetricasComerciais }) {
  const { receita, creditos } = comercial;
  return (
    <div className="space-y-4" data-testid="painel-comercial">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="MRR real" value={formatBRL(receita.mrrCentavos)} note={`ARR ${formatBRL(receita.arrCentavos)} · ${receita.pagantes} pagantes`} status="success" />
        <StatCard icon={Users} label="ARPA" value={formatBRL(receita.arpaCentavos)} note="Receita mensal por conta pagante" />
        <StatCard
          icon={TrendingDown}
          label="Churn do mês"
          value={pct(receita.churnLogo)}
          note={`Receita: ${pct(receita.churnReceita)}`}
          status={(receita.churnLogo ?? 0) > 0.05 ? "warning" : "neutral"}
        />
        <StatCard icon={Gift} label="Fator de indicação" value={comercial.fatorIndicacao === null ? "—" : comercial.fatorIndicacao.toFixed(2)} note="Indicações pagas ÷ assinantes" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Wallet} label="Perguntas da IA vendidas (mês)" value={formatBRL(creditos.receitaMesCentavos)} note={`${creditos.vendasMes} venda(s)`} />
        <StatCard icon={Repeat} label="Custo estimado da IA (mês)" value={formatBRL(creditos.custoIaMesCentavos)} note="Pelos preços IA_PRECO_*" />
        <StatCard
          icon={TrendingUp}
          label="Margem das perguntas (mês)"
          value={formatBRL(creditos.margemMesCentavos)}
          status={creditos.margemMesCentavos < 0 ? "destructive" : "success"}
          note="Receita − custo estimado"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PainelAdmin titulo="Funil do mês">
          <Funil funil={comercial.funil} />
        </PainelAdmin>
        <PainelAdmin titulo="Conversão teste → pago por semana de cadastro">
          <TabelaAdmin
            colunas={[{ titulo: "Semana" }, { titulo: "Cadastros", alinhar: "direita" }, { titulo: "Assinaram", alinhar: "direita" }, { titulo: "Conversão", alinhar: "direita" }]}
            linhas={comercial.coortes.map((c) => [
              new Date(`${c.semana}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
              formatNumberBR(c.cadastros),
              formatNumberBR(c.assinaram),
              pct(c.conversao),
            ])}
          />
        </PainelAdmin>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <PainelAdmin titulo="Cadastros por UTM (mês)">
          <TabelaOrigem linhas={comercial.origem.cadastrosPorUtm} />
        </PainelAdmin>
        <PainelAdmin titulo="Cadastros por como conheceu (mês)">
          <TabelaOrigem linhas={comercial.origem.cadastrosPorComoConheceu} />
          <p className="mt-3 text-xs text-muted-foreground">{comercial.origem.cadastrosPorIndicacao} vieram por link de indicação.</p>
        </PainelAdmin>
        <PainelAdmin titulo="Assinaturas por UTM">
          <TabelaOrigem linhas={comercial.origem.assinaturasPorUtm} />
        </PainelAdmin>
        <PainelAdmin titulo="Assinaturas por como conheceu">
          <TabelaOrigem linhas={comercial.origem.assinaturasPorComoConheceu} />
        </PainelAdmin>
      </div>
    </div>
  );
}
