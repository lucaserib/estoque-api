"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  LogOut,
  Moon,
  Sun,
  Store,
  RefreshCw,
  Unplug,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import { useLayout } from "@/app/context/LayoutContext";
import { formatRelativeTime } from "@/lib/format";

interface MLAccountInfo {
  id: string;
  nickname: string;
  isActive: boolean;
  userInfo?: { email?: string };
}

interface BlingAccountInfo {
  id: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  lastSyncAt: string | null;
}

interface IntegrationRowProps {
  icon: React.ReactNode;
  name: string;
  detail: string;
  lastSync: string | null;
  status: "ativo" | "expirado" | "desconectado";
  onConnect: () => void;
  onDisconnect?: () => void;
  manageHref?: string;
}

const IntegrationRow = ({
  icon,
  name,
  detail,
  lastSync,
  status,
  onConnect,
  onDisconnect,
  manageHref,
}: IntegrationRowProps) => {
  const router = useRouter();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{name}</p>
            {status === "ativo" && (
              <Badge className="bg-success/15 text-success">Ativo</Badge>
            )}
            {status === "expirado" && (
              <Badge className="bg-warning/15 text-warning">Expirado</Badge>
            )}
            {status === "desconectado" && (
              <Badge variant="outline">Desconectado</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{detail}</p>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Última sincronização {formatRelativeTime(lastSync)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status === "desconectado" && (
          <Button size="sm" onClick={onConnect}>
            Conectar
          </Button>
        )}
        {status === "expirado" && (
          <Button size="sm" onClick={onConnect}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reconectar
          </Button>
        )}
        {status === "ativo" && manageHref && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(manageHref)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Gerenciar
          </Button>
        )}
        {status !== "desconectado" && onDisconnect && (
          <Button size="sm" variant="ghost" onClick={onDisconnect}>
            <Unplug className="h-3.5 w-3.5 mr-1.5" />
            Desconectar
          </Button>
        )}
      </div>
    </div>
  );
};

export default function ConfiguracoesGeraisPage() {
  const { data: session } = useSession();
  const { isDarkMode, toggleDarkMode } = useLayout();

  const [loading, setLoading] = useState(true);
  const [mlAccounts, setMlAccounts] = useState<MLAccountInfo[]>([]);
  const [blingAccounts, setBlingAccounts] = useState<BlingAccountInfo[]>([]);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const [mlRes, blingRes] = await Promise.all([
        fetch("/api/mercadolivre/auth?action=accounts"),
        fetch("/api/bling/auth?action=accounts"),
      ]);

      if (mlRes.ok) {
        const data = await mlRes.json();
        setMlAccounts(Array.isArray(data) ? data : data.accounts || []);
      }
      if (blingRes.ok) {
        setBlingAccounts(await blingRes.json());
      }
    } catch {
      toast.error("Erro ao carregar status das integrações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const connectML = async () => {
    try {
      const response = await fetch("/api/mercadolivre/auth?action=connect");
      if (!response.ok) throw new Error();
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch {
      toast.error("Erro ao iniciar conexão com o Mercado Livre");
    }
  };

  const connectBling = async () => {
    try {
      const response = await fetch("/api/bling/auth?action=connect");
      if (!response.ok) throw new Error();
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch {
      toast.error("Erro ao iniciar conexão com o Bling");
    }
  };

  const disconnectML = async (accountId: string) => {
    try {
      const response = await fetch(
        `/api/mercadolivre/auth?accountId=${accountId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error();
      toast.success("Conta do Mercado Livre desconectada");
      loadIntegrations();
    } catch {
      toast.error("Erro ao desconectar conta do Mercado Livre");
    }
  };

  const disconnectBling = async (accountId: string) => {
    try {
      const response = await fetch(`/api/bling/auth?accountId=${accountId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      toast.success("Conta do Bling desconectada");
      loadIntegrations();
    } catch {
      toast.error("Erro ao desconectar conta do Bling");
    }
  };

  const mlAccount = mlAccounts.find((acc) => acc.isActive) ?? mlAccounts[0];
  const blingAccount =
    blingAccounts.find((acc) => acc.isActive) ?? blingAccounts[0];

  const mlStatus: IntegrationRowProps["status"] = !mlAccount
    ? "desconectado"
    : mlAccount.isActive
    ? "ativo"
    : "expirado";
  const blingStatus: IntegrationRowProps["status"] = !blingAccount
    ? "desconectado"
    : blingAccount.isActive
    ? "ativo"
    : "expirado";

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Header
        title="Configurações"
        subtitle="Conta, aparência e integrações"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Conta
          </CardTitle>
          <CardDescription>Dados do seu acesso ao Estoca</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">
                {session?.user?.name || "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium">{session?.user?.email || "—"}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair da conta
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isDarkMode ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            Aparência
          </CardTitle>
          <CardDescription>Tema da interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Modo escuro</p>
              <p className="text-sm text-muted-foreground">
                {isDarkMode ? "Ativado" : "Desativado"}
              </p>
            </div>
            <Button variant="outline" onClick={toggleDarkMode}>
              {isDarkMode ? (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  Usar tema claro
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  Usar tema escuro
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Integrações
          </CardTitle>
          <CardDescription>
            Status das conexões com marketplaces e ERPs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div>
              <IntegrationRow
                icon={<ShoppingBag className="h-5 w-5" />}
                name="Mercado Livre"
                detail={
                  mlAccount
                    ? mlAccount.userInfo?.email || mlAccount.nickname
                    : "Sincronize anúncios, estoque e vendas"
                }
                lastSync={null}
                status={mlStatus}
                onConnect={connectML}
                onDisconnect={
                  mlAccount ? () => disconnectML(mlAccount.id) : undefined
                }
                manageHref="/configuracoes"
              />
              <IntegrationRow
                icon={<Store className="h-5 w-5" />}
                name="Bling"
                detail={
                  blingAccount
                    ? `Conectado ${formatRelativeTime(blingAccount.createdAt)}`
                    : "Importe produtos e estoque do seu ERP"
                }
                lastSync={blingAccount?.lastSyncAt ?? null}
                status={blingStatus}
                onConnect={connectBling}
                onDisconnect={
                  blingAccount
                    ? () => disconnectBling(blingAccount.id)
                    : undefined
                }
                manageHref="/produtos/importar"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
