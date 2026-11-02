"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

interface StatusSincronizacaoFinanceira {
  contaConectada: boolean;
  pendente: boolean;
  vendasAguardandoDetalhes: number;
  vendasComFalhaDeDetalhe: number;
  ultimaAtualizacaoEm: string | null;
  ultimoWebhookPorTopico: Record<string, string | null>;
  alertaWebhooksAusentes: boolean;
  errosPendentes: number;
}

interface StatusCatalogo {
  emAndamento: boolean;
  erro: string | null;
  concluidoEm: string | null;
  bling: { conectado: boolean; ultimaSincronizacaoProdutos: string | null; ultimaSincronizacaoEstoque: string | null } | null;
  mercadoLivre: { conectado: boolean; anuncios: number; anunciosComErro: number; ultimaSincronizacao: string | null } | null;
}

interface PendenciasResponse {
  total: number;
  porCodigo: Record<string, { quantidade: number; valorEstoqueAfetado: number }>;
}

const PENDENCIA_LABEL: Record<string, string> = {
  SEM_CUSTO: "Sem custo",
  SEM_FORNECEDOR: "Sem fornecedor",
  SEM_PRECO: "Sem preço de venda",
  MARGEM_NEGATIVA: "Margem negativa",
  SEM_FRETE: "Sem custo de frete",
  SEM_TARIFA: "Sem tarifa calculada",
  ESTOQUE_DIVERGENTE: "Estoque divergente do Bling",
};

export default function SaudeDadosPage() {
  const [financeiro, setFinanceiro] = useState<StatusSincronizacaoFinanceira | null>(null);
  const [catalogo, setCatalogo] = useState<StatusCatalogo | null>(null);
  const [pendencias, setPendencias] = useState<PendenciasResponse | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [respFinanceiro, respCatalogo, respPendencias] = await Promise.all([
        fetch("/api/financeiro/sincronizacao/status"),
        fetch("/api/catalogo/sincronizacao"),
        fetch("/api/produtos/pendencias"),
      ]);
      if (respFinanceiro.ok) setFinanceiro(await respFinanceiro.json());
      if (respCatalogo.ok) setCatalogo(await respCatalogo.json());
      if (respPendencias.ok) setPendencias(await respPendencias.json());
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        title="Saúde dos dados"
        subtitle="Visão única do que está sincronizado, com o que está pendente e com erro em cada integração."
        actions={
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {carregando && !financeiro && !catalogo && !pendencias ? (
        <>
          <Skeleton className="h-40 rounded-md" />
          <Skeleton className="h-40 rounded-md" />
          <Skeleton className="h-40 rounded-md" />
        </>
      ) : (
        <>
          <SectionCard
            title="Financeiro"
            description="Cobertura da sincronização com o Mercado Livre e o Mercado Pago."
            actions={
              <Link href="/financeiro">
                <Button variant="outline" size="sm">Abrir Financeiro</Button>
              </Link>
            }
          >
            {!financeiro?.contaConectada ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta do Mercado Livre conectada.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <StatusPill tone={financeiro.pendente ? "warning" : "success"}>
                    {financeiro.pendente ? "Sincronização pendente" : "Dados em dia"}
                  </StatusPill>
                  {financeiro.ultimaAtualizacaoEm && (
                    <span className="text-muted-foreground">
                      atualizado {formatRelativeTime(financeiro.ultimaAtualizacaoEm)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-muted-foreground">
                  <span>Vendas aguardando detalhe: <strong className="text-foreground">{financeiro.vendasAguardandoDetalhes}</strong></span>
                  <span>Vendas com falha de detalhe: <strong className={financeiro.vendasComFalhaDeDetalhe > 0 ? "text-destructive-text" : "text-foreground"}>{financeiro.vendasComFalhaDeDetalhe}</strong></span>
                  <span>Erros pendentes: <strong className={financeiro.errosPendentes > 0 ? "text-destructive-text" : "text-foreground"}>{financeiro.errosPendentes}</strong></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(financeiro.ultimoWebhookPorTopico).map(([topico, data]) => (
                    <StatusPill key={topico} tone={data ? "neutral" : "warning"}>
                      {topico}: {data ? formatRelativeTime(data) : "nunca recebido"}
                    </StatusPill>
                  ))}
                </div>
                {financeiro.alertaWebhooksAusentes && (
                  <p className="text-warning-text">Nenhum webhook recebido recentemente — confirme a configuração no app do Mercado Livre.</p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Catálogo e estoque"
            description="Bling (produtos e estoque local), anúncios do Mercado Livre e estoque Full."
            actions={
              <Link href="/integracoes">
                <Button variant="outline" size="sm">Abrir Integrações</Button>
              </Link>
            }
          >
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <StatusPill tone={catalogo?.erro ? "critical" : catalogo?.emAndamento ? "info" : "success"}>
                  {catalogo?.erro ? "Erro na última sincronização" : catalogo?.emAndamento ? "Sincronizando" : "Concluído"}
                </StatusPill>
                {catalogo?.concluidoEm && (
                  <span className="text-muted-foreground">última vez {formatRelativeTime(catalogo.concluidoEm)}</span>
                )}
              </div>
              {catalogo?.erro && <p className="text-destructive-text">{catalogo.erro}</p>}
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                {catalogo?.bling && (
                  <>
                    <span>Bling produtos: <strong className="text-foreground">{catalogo.bling.ultimaSincronizacaoProdutos ? formatRelativeTime(catalogo.bling.ultimaSincronizacaoProdutos) : "nunca"}</strong></span>
                    <span>Bling estoque: <strong className="text-foreground">{catalogo.bling.ultimaSincronizacaoEstoque ? formatRelativeTime(catalogo.bling.ultimaSincronizacaoEstoque) : "nunca"}</strong></span>
                  </>
                )}
                {catalogo?.mercadoLivre && (
                  <span>
                    Anúncios com erro:{" "}
                    <strong className={catalogo.mercadoLivre.anunciosComErro > 0 ? "text-destructive-text" : "text-foreground"}>
                      {catalogo.mercadoLivre.anunciosComErro} de {catalogo.mercadoLivre.anuncios}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Cadastro de produtos"
            description="Pendências que afetam custo, margem e reposição."
            actions={
              <Link href="/produtos">
                <Button variant="outline" size="sm">Abrir Produtos</Button>
              </Link>
            }
          >
            {!pendencias || pendencias.total === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma pendência de cadastro.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(pendencias.porCodigo).map(([codigo, info]) => (
                  <Link key={codigo} href={`/produtos?pendencia=${codigo}`}>
                    <StatusPill tone="warning">
                      {PENDENCIA_LABEL[codigo] ?? codigo}: {info.quantidade}
                    </StatusPill>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
