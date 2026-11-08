"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  FileText,
  type LucideIcon,
  Package,
  Plug,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL, formatBRLReais, formatNumberBR, formatPercent, formatRelativeTime } from "@/lib/format";
import { chartColor } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import type { MetricasPlataforma, PontoSerie } from "@/modules/admin/metricas";
import { TesteConexaoIa } from "@/components/admin/TesteConexaoIa";

function rotuloDia(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function Painel({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border/80 bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-foreground">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Linha({ icone: Icone, rotulo, valor, alerta }: { icone: LucideIcon; rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-0">
      <span className="flex items-center gap-2 text-sm text-fg2">
        <Icone className="h-4 w-4 text-muted-foreground" />
        {rotulo}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", alerta ? "text-destructive-text" : "text-foreground")}>{valor}</span>
    </div>
  );
}

function GraficoArea({ dados, cor, formatar }: { dados: PontoSerie[]; cor: string; formatar: (v: number) => string }) {
  const id = `g-${cor.replace("#", "")}`;
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="dia" tickFormatter={rotuloDia} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
          <YAxis tickFormatter={(v) => formatar(Number(v))} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={72} />
          <Tooltip
            labelFormatter={(v) => rotuloDia(String(v))}
            formatter={(v) => [formatar(Number(v)), ""]}
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          />
          <Area type="monotone" dataKey="valor" stroke={cor} strokeWidth={2} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AdminVisaoGeralPage() {
  const [dados, setDados] = useState<MetricasPlataforma | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch("/api/admin/metricas");
      if (resposta.ok) setDados(await resposta.json());
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Visão geral"
        subtitle={dados ? `Atualizado ${formatRelativeTime(dados.geradoEm)}` : "Saúde do negócio Skubo em um lugar só."}
        actions={
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      {!dados ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
            <StatCard
              highlight
              size="lg"
              icon={TrendingUp}
              label="Receita recorrente mensal (MRR)"
              value={formatBRLReais(dados.assinaturas.mrr)}
              note={`${dados.assinaturas.mensais} mensais · ${dados.assinaturas.anuais} anuais · ${formatBRLReais(dados.ia.receitaMensal)} de IA`}
            />
            <StatCard
              icon={Building2}
              label="Lojas cadastradas"
              value={formatNumberBR(dados.contas.total)}
              note={`+${dados.contas.novas7d} em 7 dias · +${dados.contas.novas30d} em 30 dias`}
            />
            <StatCard
              icon={Activity}
              label="Lojas ativas (vendas em 30 dias)"
              value={formatNumberBR(dados.contas.ativas30d)}
              note={dados.contas.total > 0 ? `${formatPercent((dados.contas.ativas30d / dados.contas.total) * 100, 0)} da base` : undefined}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={CreditCard} label="Assinaturas ativas" value={formatNumberBR(dados.assinaturas.ativas)} status="success"
              note={dados.assinaturas.conversao !== null ? `Conversão ${formatPercent(dados.assinaturas.conversao * 100, 0)}` : undefined} />
            <StatCard icon={Users} label="Em teste" value={formatNumberBR(dados.assinaturas.emTeste)}
              note={`${dados.assinaturas.testesVencendo7d} vencem em 7 dias`} status={dados.assinaturas.testesVencendo7d > 0 ? "warning" : "neutral"} />
            <StatCard icon={AlertTriangle} label="Inadimplentes" value={formatNumberBR(dados.assinaturas.inadimplentes)}
              status={dados.assinaturas.inadimplentes > 0 ? "destructive" : "neutral"} note={`${dados.assinaturas.canceladas} canceladas`} />
            <StatCard icon={Sparkles} label="Skubo IA (assinantes)" value={formatNumberBR(dados.ia.assinantes)}
              note={`${dados.ia.emTeste} em teste · ${dados.ia.liberadasManual} liberadas à mão`}
              href="/admin/contas?filtro=ia" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Painel titulo="Volume vendido pelas lojas (GMV, 30 dias)" acao={<span className="text-sm font-semibold tabular-nums">{formatBRL(dados.operacao.gmv30d)}</span>}>
              <GraficoArea dados={dados.series.gmv} cor={chartColor(0)} formatar={(v) => formatBRL(v)} />
            </Painel>
            <Painel titulo="Novas lojas por dia (30 dias)" acao={<span className="text-sm font-semibold tabular-nums">{dados.contas.novas30d}</span>}>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.series.cadastros} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" tickFormatter={rotuloDia} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={32} />
                    <Tooltip labelFormatter={(v) => rotuloDia(String(v))} formatter={(v) => [String(v), "Lojas"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Bar dataKey="valor" fill={chartColor(1)} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Painel>
          </div>

          <section className="space-y-4" aria-labelledby="titulo-bloco-ia">
            <div className="flex items-center justify-between gap-3">
              <h2 id="titulo-bloco-ia" className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Skubo IA
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/ia/feedback">Ver respostas com 👎</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Wallet} label="Receita do add-on (mês)" value={formatBRLReais(dados.ia.receitaMensal)}
                note={`${dados.ia.assinantes} assinante(s) pagando`} />
              <StatCard icon={Activity} label="Custo estimado da IA (mês)" value={formatBRL(dados.ia.custoMesCentavos)}
                note={dados.ia.custoSemPreco > 0 ? `${dados.ia.custoSemPreco} chamada(s) sem preço configurado` : "Pelos preços IA_PRECO_*"}
                status={dados.ia.custoSemPreco > 0 ? "warning" : "neutral"} />
              <StatCard icon={TrendingUp} label="Margem do add-on (mês)" value={formatBRLReais(dados.ia.margemMensal)}
                status={dados.ia.margemMensal < 0 ? "destructive" : "success"} note="Receita − custo estimado" />
              <StatCard icon={Users} label="Conversão teste → assinatura"
                value={dados.ia.conversaoTeste !== null ? formatPercent(dados.ia.conversaoTeste * 100, 0) : "—"}
                note={`${dados.ia.testesIniciados} teste(s) iniciados`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Painel titulo="Perguntas ao assistente por dia (30 dias)"
                acao={<span className="text-sm font-semibold tabular-nums">{formatNumberBR(dados.ia.mensagensPorDia.reduce((t, p) => t + p.valor, 0))}</span>}>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.ia.mensagensPorDia} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" tickFormatter={rotuloDia} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={32} />
                      <Tooltip labelFormatter={(v) => rotuloDia(String(v))} formatter={(v) => [String(v), "Perguntas"]}
                        contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Bar dataKey="valor" fill={chartColor(2)} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Painel>
              <Painel titulo="Qualidade e operação">
                <Linha icone={ThumbsUp} rotulo="Respostas úteis (👍, 30 dias)"
                  valor={dados.ia.taxaPositiva !== null ? `${formatPercent(dados.ia.taxaPositiva * 100, 0)} de ${dados.ia.feedbacks30d}` : "Sem avaliações"} />
                <Linha icone={Activity} rotulo="Chamadas à IA (24h)" valor={formatNumberBR(dados.ia.chamadas24h)} />
                <Linha icone={AlertTriangle} rotulo="Erros do provedor (24h)" valor={formatNumberBR(dados.ia.errosProvedor24h)}
                  alerta={dados.ia.errosProvedor24h > 0} />
                <Linha icone={FileText} rotulo="Análises da Central (30 dias)" valor={formatNumberBR(dados.ia.analises30d)} />
                <Linha icone={Sparkles} rotulo="Pedidos de ativação aguardando" valor={formatNumberBR(dados.ia.pedidosPendentes)}
                  alerta={dados.ia.pedidosPendentes > 0} />
                <div className="pt-3">
                  <TesteConexaoIa />
                </div>
              </Painel>
            </div>
            <Painel titulo="Custo estimado por conta (mês)">
              {dados.ia.custoPorConta.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum uso de IA neste mês.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 text-left font-medium">Conta</th>
                        <th className="py-2 text-right font-medium">Chamadas</th>
                        <th className="py-2 text-right font-medium">Custo estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.ia.custoPorConta.map((c) => (
                        <tr key={c.contaId} className="border-t border-divider">
                          <td className="py-2">
                            <p className="font-medium text-foreground">{c.nome || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatNumberBR(c.chamadas)}</td>
                          <td className="py-2 text-right font-medium tabular-nums">{formatBRL(c.custoCentavos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Painel>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Painel titulo="Operação das lojas">
              <Linha icone={ShoppingCart} rotulo="Pedidos em 30 dias" valor={formatNumberBR(dados.operacao.pedidos30d)} />
              <Linha icone={Package} rotulo="Produtos ativos" valor={formatNumberBR(dados.operacao.produtosCadastrados)} />
              <Linha icone={TrendingUp} rotulo="Anúncios ativos" valor={formatNumberBR(dados.operacao.anunciosAtivos)} />
              <Linha icone={FileText} rotulo="Notas fiscais em 30 dias" valor={formatNumberBR(dados.operacao.notasFiscais30d)} />
              <Linha icone={Users} rotulo="Usuários (donos + equipe)" valor={`${formatNumberBR(dados.usuarios.total)} · ${dados.usuarios.membros} de equipe`} />
            </Painel>
            <Painel titulo="Integrações">
              <Linha icone={Plug} rotulo="Lojas com Mercado Livre" valor={formatNumberBR(dados.integracoes.contasComMl)} />
              <Linha icone={Plug} rotulo="Lojas com Bling" valor={formatNumberBR(dados.integracoes.contasComBling)} />
              <Linha icone={AlertTriangle} rotulo="Contas ML a reconectar" valor={formatNumberBR(dados.integracoes.mlInativas)} alerta={dados.integracoes.mlInativas > 0} />
              <Linha icone={AlertTriangle} rotulo="Contas Bling a reconectar" valor={formatNumberBR(dados.integracoes.blingInativas)} alerta={dados.integracoes.blingInativas > 0} />
            </Painel>
            <Painel titulo="Saúde técnica (24h)">
              <Linha icone={Webhook} rotulo="Webhooks do ML" valor={`${formatNumberBR(dados.saude.webhooksMl24h)} · ${dados.saude.webhooksMlComErro24h} com erro`} alerta={dados.saude.webhooksMlComErro24h > 0} />
              <Linha icone={Webhook} rotulo="Webhooks do Bling" valor={`${formatNumberBR(dados.saude.webhooksBling24h)} · ${dados.saude.webhooksBlingComErro24h} com erro`} alerta={dados.saude.webhooksBlingComErro24h > 0} />
              <Linha icone={RefreshCw} rotulo="Sincronizações na fila" valor={formatNumberBR(dados.saude.tarefasPendentes)} />
              <Linha icone={AlertTriangle} rotulo="Sincronizações com erro" valor={formatNumberBR(dados.saude.tarefasComErro)} alerta={dados.saude.tarefasComErro > 0} />
              <Linha icone={AlertTriangle} rotulo="Vendas sem detalhe do pagamento" valor={formatNumberBR(dados.saude.vendasComFalhaDetalhe)} alerta={dados.saude.vendasComFalhaDetalhe > 0} />
            </Painel>
          </div>

          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/contas">Ver todas as contas</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
