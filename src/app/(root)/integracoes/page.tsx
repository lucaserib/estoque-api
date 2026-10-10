"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MercadoLivreIcon } from "@/components/ui/mercado-livre-icon";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Loader2, RefreshCw, Settings, Unplug } from "lucide-react";
import { toast } from "sonner";
import { pollBlingSyncHistory } from "@/lib/pollBlingSyncHistory";

interface MLAccount {
  id: string;
  isActive: boolean;
  expiresAt: string;
  userInfo?: {
    nickname?: string;
    email?: string;
    siteId?: string;
  };
  siteId?: string;
}

interface BlingAccount {
  id: string;
  isActive: boolean;
  expiresAt: string;
  lastSyncAt: string | null;
  tokenFormato: "jwt" | "opaco";
  ultimaSincronizacaoProdutos: string | null;
  ultimaSincronizacaoEstoque: string | null;
  webhooksRecebidos24h: number;
  webhooksComErro24h: number;
}

interface HistoricoItem {
  id: string;
  quando: string;
  origem: string;
  escopo: string;
  registros: number;
  resultado: string;
  status: string;
}

interface VerificacaoConfigBling {
  item: string;
  ok: boolean;
  bloqueante: boolean;
  mensagem: string;
}

interface DiagnosticoConfigBling {
  ok: boolean;
  callbackEsperado: string;
  verificacoes: VerificacaoConfigBling[];
}

const MENSAGENS_ERRO_BLING: Record<string, string> = {
  acesso_negado: "A autorização foi cancelada na tela do Bling.",
  bling_recusou: "O Bling recusou a autorização. Confira se o aplicativo está ativo no portal de desenvolvedores do Bling.",
  parametros_ausentes: "O Bling voltou sem o código de autorização. Tente conectar novamente.",
  sessao_invalida: "Sua sessão não chegou no retorno do Bling. Entre no Leap Stock pelo mesmo endereço do link de redirecionamento cadastrado no Bling e tente de novo.",
  state_expirado: "A tentativa de conexão expirou (mais de 10 minutos) ou foi iniciada em outro navegador/domínio. Clique em Conectar novamente.",
  state_invalido: "A tentativa de conexão não confere com a sua sessão. Clique em Conectar novamente.",
  credenciais_invalidas: "O Bling recusou o Client ID/Client Secret configurados no servidor. Confira BLING_CLIENT_ID e BLING_CLIENT_SECRET na Vercel.",
  codigo_invalido: "O código de autorização do Bling expirou ou já foi usado. Clique em Conectar novamente.",
  redirect_uri_divergente: "O link de redirecionamento cadastrado no aplicativo do Bling não confere com este domínio.",
  bling_indisponivel: "O Bling não respondeu. Tente novamente em alguns minutos.",
  erro_salvar_conta: "A autorização deu certo, mas o servidor não conseguiu gravar a conta. Verifique a TOKEN_ENCRYPTION_KEY e o banco de dados.",
  desconhecido: "O Bling recusou a conexão por um motivo não identificado. Veja os logs da função /api/bling/auth/callback na Vercel.",
};

const RESULT_TONE: Record<string, "success" | "warning" | "critical" | "info"> = {
  success: "success",
  partial: "warning",
  error: "critical",
  processing: "info",
};

export default function IntegracoesPage() {
  const [mlAccounts, setMlAccounts] = useState<MLAccount[]>([]);
  const [blingAccounts, setBlingAccounts] = useState<BlingAccount[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingML, setSyncingML] = useState(false);
  const [syncingBlingProdutos, setSyncingBlingProdutos] = useState(false);
  const [syncingBlingEstoque, setSyncingBlingEstoque] = useState(false);
  const [conectandoBling, setConectandoBling] = useState(false);
  const [erroBling, setErroBling] = useState<string | null>(null);
  const [diagnosticoBling, setDiagnosticoBling] = useState<DiagnosticoConfigBling | null>(null);

  const carregarDiagnosticoBling = useCallback(async () => {
    try {
      const response = await fetch("/api/bling/auth?action=diagnostico");
      if (response.ok) setDiagnosticoBling(await response.json());
    } catch {
      setDiagnosticoBling(null);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get("bling");
    const erro = params.get("bling_erro");
    const aviso = params.get("bling_aviso");
    if (!resultado && !erro) return;

    if (erro) {
      const mensagem = MENSAGENS_ERRO_BLING[erro] ?? MENSAGENS_ERRO_BLING.desconhecido;
      setErroBling(mensagem);
      toast.error(mensagem);
      carregarDiagnosticoBling();
    } else if (resultado === "conectado") {
      toast.success(
        aviso === "empresa_nao_identificada"
          ? "Bling conectado. Não foi possível identificar a empresa agora; os webhooks passam a funcionar depois da próxima renovação automática."
          : "Bling conectado com sucesso."
      );
    }

    window.history.replaceState(null, "", window.location.pathname);
  }, [carregarDiagnosticoBling]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mlRes, blingRes, historicoRes] = await Promise.all([
        fetch("/api/mercadolivre/auth?action=accounts"),
        fetch("/api/bling/auth?action=accounts"),
        fetch("/api/integracoes/historico"),
      ]);

      if (mlRes.ok) setMlAccounts(await mlRes.json());
      if (blingRes.ok) setBlingAccounts(await blingRes.json());
      if (historicoRes.ok) {
        const data = await historicoRes.json();
        setHistorico(data.historico || []);
      }
    } catch (error) {
      toast.error("Erro ao carregar integrações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mlAccount = mlAccounts[0];
  const blingAccount = blingAccounts[0];

  const lastMLSync = historico.find((h) => h.origem === "Mercado Livre");
  const lastBlingSync = historico.find((h) => h.origem === "Bling");

  const handleSyncML = async () => {
    if (!mlAccount) return;
    setSyncingML(true);
    try {
      const response = await fetch("/api/mercadolivre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: mlAccount.id, syncType: "full" }),
      });
      if (!response.ok) throw new Error("Erro na sincronização");
      const result = await response.json();
      toast.success(`Sincronização concluída! ${result.syncedCount || 0} itens atualizados`);
      loadData();
    } catch (error) {
      toast.error("Erro ao sincronizar com o Mercado Livre");
    } finally {
      setSyncingML(false);
    }
  };

  const handleSyncBlingProdutos = async () => {
    if (!blingAccount) return;
    setSyncingBlingProdutos(true);
    try {
      const response = await fetch("/api/bling/produtos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: blingAccount.id }),
      });
      if (!response.ok) throw new Error("Erro na sincronização");
      const { syncHistoryId } = await response.json();
      const resultado = await pollBlingSyncHistory(syncHistoryId);

      if (resultado.status === "error") {
        throw new Error(resultado.errors?.[0] || "Erro na sincronização");
      }

      toast.success(
        `Produtos sincronizados! ${resultado.newItems} criados, ${resultado.updatedItems} atualizados`
      );
      loadData();
    } catch (error) {
      toast.error("Erro ao sincronizar produtos do Bling");
    } finally {
      setSyncingBlingProdutos(false);
    }
  };

  const handleSyncBlingEstoque = async () => {
    if (!blingAccount) return;
    setSyncingBlingEstoque(true);
    try {
      const response = await fetch("/api/produtos/estoque-bling", { method: "POST" });
      if (!response.ok) throw new Error("Erro na sincronização");
      const data = await response.json();
      toast.success(
        `Estoque sincronizado! ${data.stats.atualizados} divergência(s) corrigida(s)`
      );
      loadData();
    } catch (error) {
      toast.error("Erro ao sincronizar estoque do Bling");
    } finally {
      setSyncingBlingEstoque(false);
    }
  };

  const handleConectarBling = async () => {
    setConectandoBling(true);
    try {
      const response = await fetch("/api/bling/auth?action=connect");
      const data = await response.json().catch(() => null);

      if (response.ok && data?.authUrl) {
        window.location.href = data.authUrl;
        return;
      }

      if (data?.code === "BLING_CONFIG" && data.diagnostico) {
        setDiagnosticoBling(data.diagnostico);
        setErroBling(data.error);
        toast.error(data.error);
      } else {
        toast.error(data?.error ?? "Erro ao iniciar a conexão com o Bling");
      }
    } catch {
      toast.error("Erro ao iniciar a conexão com o Bling");
    }
    setConectandoBling(false);
  };

  const handleDisconnect = async (
    provider: "mercadolivre" | "bling",
    accountId: string
  ) => {
    const confirmDisconnect = window.confirm(
      "Tem certeza que deseja desconectar esta integração?"
    );
    if (!confirmDisconnect) return;

    try {
      const url =
        provider === "mercadolivre"
          ? `/api/mercadolivre/auth?accountId=${accountId}`
          : `/api/bling/auth?accountId=${accountId}`;
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao desconectar");
      toast.success("Integração desconectada");
      loadData();
    } catch (error) {
      toast.error("Erro ao desconectar integração");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-[1400px] p-6">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        eyebrow="Sistema"
        title="Integrações"
        subtitle="Conexões ativas, validade dos tokens e histórico das últimas sincronizações."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Mercado Livre */}
        <SectionCard
          contentClassName="p-0"
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-divider p-5">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <MercadoLivreIcon width={26} height={26} className="object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-semibold text-foreground">Mercado Livre</h2>
              <p className="mt-1 truncate text-xs text-faint">
                {mlAccount?.userInfo?.nickname || mlAccount?.userInfo?.email || "Nenhuma conta conectada"}
              </p>
            </div>
            <StatusPill tone={mlAccount ? "success" : "neutral"}>
              {mlAccount ? "Conectado" : "Desconectado"}
            </StatusPill>
          </div>
          {mlAccount && (
            <div className="px-5 pb-1 pt-2">
              <div className="flex justify-between gap-4 border-b border-divider py-2.5 text-sm">
                <span className="text-muted-foreground">Site</span>
                <span className="font-medium text-foreground">
                  {mlAccount.userInfo?.siteId || mlAccount.siteId || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-divider py-2.5 text-sm">
                <span className="text-muted-foreground">Token expira em</span>
                <span className="font-medium text-foreground">
                  {new Date(mlAccount.expiresAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Última sincronização</span>
                <span className="font-medium text-foreground">
                  {lastMLSync ? new Date(lastMLSync.quando).toLocaleString("pt-BR") : "—"}
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 p-5 pt-4">
            {mlAccount ? (
              <>
                <Button size="sm" onClick={handleSyncML} disabled={syncingML} className="gap-2">
                  {syncingML ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sincronizar agora
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/configuracoes">
                    <Settings className="h-4 w-4" />
                    Configurar
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDisconnect("mercadolivre", mlAccount.id)}
                  className="ml-auto gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Unplug className="h-4 w-4" />
                  Desconectar
                </Button>
              </>
            ) : (
              <Button asChild size="sm" className="gap-2">
                <Link href="/configuracoes">Conectar Mercado Livre</Link>
              </Button>
            )}
          </div>
        </SectionCard>

        {/* Bling */}
        <SectionCard
          contentClassName="p-0"
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-divider p-5">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-info/10 text-[13px] font-semibold text-info">
              BL
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-semibold text-foreground">Bling</h2>
              <p className="mt-1 truncate text-xs text-faint">
                {blingAccount
                  ? `Token ${blingAccount.tokenFormato === "jwt" ? "JWT" : "opaco"}`
                  : "Nenhuma conta conectada"}
              </p>
            </div>
            <StatusPill
              tone={
                !blingAccount ? "neutral" : blingAccount.isActive ? "success" : "critical"
              }
            >
              {!blingAccount
                ? "Desconectado"
                : blingAccount.isActive
                ? "Conectado"
                : "Reconexão necessária"}
            </StatusPill>
          </div>
          {blingAccount && (
            <div className="px-5 pb-1 pt-2">
              <div className="flex justify-between gap-4 border-b border-divider py-2.5 text-sm">
                <span className="text-muted-foreground">Token expira em</span>
                <span className="font-medium text-foreground">
                  {new Date(blingAccount.expiresAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-divider py-2.5 text-sm">
                <span className="text-muted-foreground">Última sincronização de produtos</span>
                <span className="font-medium text-foreground">
                  {blingAccount.ultimaSincronizacaoProdutos || lastBlingSync
                    ? new Date(
                        blingAccount.ultimaSincronizacaoProdutos || lastBlingSync!.quando
                      ).toLocaleString("pt-BR")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-divider py-2.5 text-sm">
                <span className="text-muted-foreground">Última sincronização de estoque</span>
                <span className="font-medium text-foreground">
                  {blingAccount.ultimaSincronizacaoEstoque
                    ? new Date(blingAccount.ultimaSincronizacaoEstoque).toLocaleString("pt-BR")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Webhooks (24h)</span>
                <span className="font-medium text-foreground">
                  {blingAccount.webhooksRecebidos24h} recebido(s)
                  {blingAccount.webhooksComErro24h > 0 && (
                    <span className="text-destructive">
                      {" "}
                      · {blingAccount.webhooksComErro24h} com erro
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 p-5 pt-4">
            {blingAccount ? (
              <>
                {blingAccount.isActive ? (
                  <>
                    <Button
                      size="sm"
                      onClick={handleSyncBlingProdutos}
                      disabled={syncingBlingProdutos}
                      className="gap-2"
                    >
                      {syncingBlingProdutos ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sincronizar produtos
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSyncBlingEstoque}
                      disabled={syncingBlingEstoque}
                      className="gap-2"
                    >
                      {syncingBlingEstoque ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sincronizar estoque
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleConectarBling}
                    disabled={conectandoBling}
                    className="gap-2"
                  >
                    {conectandoBling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Reconectar
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/configuracoes-gerais">
                    <Settings className="h-4 w-4" />
                    Configurar
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDisconnect("bling", blingAccount.id)}
                  className="ml-auto gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Unplug className="h-4 w-4" />
                  Desconectar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleConectarBling}
                disabled={conectandoBling}
                className="gap-2"
              >
                {conectandoBling && <Loader2 className="h-4 w-4 animate-spin" />}
                Conectar Bling
              </Button>
            )}
          </div>
          {(erroBling || diagnosticoBling) && (
            <div className="border-t border-divider px-5 py-4 text-sm" role="status">
              {erroBling && <p className="font-medium text-destructive">{erroBling}</p>}
              {diagnosticoBling && (
                <div className="mt-3 space-y-2">
                  <p className="text-muted-foreground">
                    Link de redirecionamento que deve estar cadastrado no aplicativo do Bling:
                  </p>
                  <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                    {diagnosticoBling.callbackEsperado}
                  </code>
                  <ul className="space-y-1.5">
                    {diagnosticoBling.verificacoes
                      .filter((verificacao) => !verificacao.ok)
                      .map((verificacao) => (
                        <li key={verificacao.item} className="flex gap-2">
                          <StatusPill tone={verificacao.bloqueante ? "critical" : "warning"}>
                            {verificacao.item}
                          </StatusPill>
                          <span className="text-muted-foreground">{verificacao.mensagem}</span>
                        </li>
                      ))}
                  </ul>
                  {diagnosticoBling.verificacoes.every((verificacao) => verificacao.ok) && (
                    <p className="text-muted-foreground">
                      A configuração do servidor está correta. Se o erro continuar, confira o link acima no portal do Bling.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Histórico de sincronização" contentClassName="p-0">
        <DataTable>
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead className="pl-4">Quando</DataTableHead>
              <DataTableHead>Origem</DataTableHead>
              <DataTableHead>Escopo</DataTableHead>
              <DataTableHead className="text-right">Registros</DataTableHead>
              <DataTableHead className="pr-4">Resultado</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {historico.map((item) => (
              <DataTableRow key={item.id}>
                <DataTableCell className="pl-4 font-mono text-xs text-muted-foreground">
                  {new Date(item.quando).toLocaleString("pt-BR")}
                </DataTableCell>
                <DataTableCell className="font-medium">{item.origem}</DataTableCell>
                <DataTableCell className="text-muted-foreground">{item.escopo}</DataTableCell>
                <DataTableCell numeric>{item.registros}</DataTableCell>
                <DataTableCell className="pr-4">
                  <StatusPill tone={RESULT_TONE[item.status] || "neutral"}>
                    {item.resultado}
                  </StatusPill>
                </DataTableCell>
              </DataTableRow>
            ))}

            {historico.length === 0 && (
              <DataTableRow>
                <DataTableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhuma sincronização registrada ainda.
                </DataTableCell>
              </DataTableRow>
            )}
          </DataTableBody>
        </DataTable>
      </SectionCard>
    </div>
  );
}
