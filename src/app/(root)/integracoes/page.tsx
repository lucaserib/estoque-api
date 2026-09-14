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
  const [syncingBling, setSyncingBling] = useState(false);

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

  const handleSyncBling = async () => {
    if (!blingAccount) return;
    setSyncingBling(true);
    try {
      const response = await fetch("/api/bling/produtos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: blingAccount.id }),
      });
      if (!response.ok) throw new Error("Erro na sincronização");
      const result = await response.json();
      toast.success(
        `Sincronização concluída! ${result.criados || 0} criados, ${result.atualizados || 0} atualizados`
      );
      loadData();
    } catch (error) {
      toast.error("Erro ao sincronizar com o Bling");
    } finally {
      setSyncingBling(false);
    }
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
                {blingAccount ? "Conta conectada" : "Nenhuma conta conectada"}
              </p>
            </div>
            <StatusPill tone={blingAccount ? "success" : "neutral"}>
              {blingAccount ? "Conectado" : "Desconectado"}
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
              <div className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Última sincronização</span>
                <span className="font-medium text-foreground">
                  {blingAccount.lastSyncAt || lastBlingSync
                    ? new Date(
                        blingAccount.lastSyncAt || lastBlingSync!.quando
                      ).toLocaleString("pt-BR")
                    : "—"}
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 p-5 pt-4">
            {blingAccount ? (
              <>
                <Button size="sm" onClick={handleSyncBling} disabled={syncingBling} className="gap-2">
                  {syncingBling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sincronizar agora
                </Button>
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
              <Button asChild size="sm" className="gap-2">
                <Link href="/configuracoes-gerais">Conectar Bling</Link>
              </Button>
            )}
          </div>
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
