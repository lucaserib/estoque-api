"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  ArrowRight,
  ShoppingBag,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLayout, type TemaPreferencia } from "@/app/context/LayoutContext";
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
}

const IntegrationRow = ({
  icon,
  name,
  detail,
  lastSync,
  status,
}: IntegrationRowProps) => {
  return (
    <div className="flex items-center justify-between gap-3 py-4 border-b last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{name}</p>
            {status === "ativo" && (
              <Badge className="bg-success/15 text-success-text">Ativo</Badge>
            )}
            {status === "expirado" && (
              <Badge className="bg-warning/15 text-warning-text">Expirado</Badge>
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
    </div>
  );
};

export default function ConfiguracoesGeraisPage() {
  const { data: session } = useSession();
  const {
    isDarkMode,
    tema,
    setTema,
    nomeLoja: nomeLojaConta,
    logoUrl: logoUrlConta,
    atualizarBranding,
  } = useLayout();

  const [loading, setLoading] = useState(true);
  const [mlAccounts, setMlAccounts] = useState<MLAccountInfo[]>([]);
  const [blingAccounts, setBlingAccounts] = useState<BlingAccountInfo[]>([]);
  const [aliquotaImposto, setAliquotaImposto] = useState(0);
  const [salvandoAliquota, setSalvandoAliquota] = useState(false);
  const [nomeLoja, setNomeLoja] = useState("");
  const [salvandoNomeLoja, setSalvandoNomeLoja] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);

  const podeVerCusto =
    session?.user?.role === "ADMIN" || session?.user?.role === "COMPRAS";

  useEffect(() => {
    if (!podeVerCusto) return;
    fetch("/api/configuracoes-gerais")
      .then((res) => res.json())
      .then((data) => setAliquotaImposto((data.aliquotaImposto ?? 0) * 100))
      .catch(() => toast.error("Erro ao carregar configurações financeiras"));
  }, [podeVerCusto]);

  useEffect(() => {
    setNomeLoja(nomeLojaConta ?? "");
  }, [nomeLojaConta]);

  const salvarNomeLoja = useCallback(async () => {
    setSalvandoNomeLoja(true);
    try {
      const res = await fetch("/api/configuracoes-gerais", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeLoja: nomeLoja.trim() || null }),
      });
      if (!res.ok) throw new Error();
      atualizarBranding({ nomeLoja: nomeLoja.trim() || null });
      toast.success("Nome da loja atualizado");
    } catch {
      toast.error("Erro ao salvar nome da loja");
    } finally {
      setSalvandoNomeLoja(false);
    }
  }, [nomeLoja, atualizarBranding]);

  const enviarLogo = useCallback(async (file: File) => {
    setEnviandoLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/configuracoes-gerais/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar logo");
      atualizarBranding({ logoUrl: data.logoUrl });
      toast.success("Logo da loja atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar logo");
    } finally {
      setEnviandoLogo(false);
    }
  }, [atualizarBranding]);

  const salvarAliquota = useCallback(async () => {
    setSalvandoAliquota(true);
    try {
      const res = await fetch("/api/configuracoes-gerais", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aliquotaImposto: aliquotaImposto / 100 }),
      });
      if (!res.ok) throw new Error();
      toast.success("Alíquota de imposto atualizada");
    } catch {
      toast.error("Erro ao salvar alíquota de imposto");
    } finally {
      setSalvandoAliquota(false);
    }
  }, [aliquotaImposto]);

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
      <PageHeader
        title="Configurações"
        subtitle="Conta, aparência e integrações"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Conta
          </CardTitle>
          <CardDescription>Dados do seu acesso ao Skubo</CardDescription>
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
          <CardDescription>Tema da interface — vale para sua conta, não só este aparelho</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Tema</p>
              <p className="text-sm text-muted-foreground">
                {tema === "SISTEMA"
                  ? "Segue o sistema do aparelho"
                  : isDarkMode
                  ? "Escuro"
                  : "Claro"}
              </p>
            </div>
            <Select value={tema} onValueChange={(valor) => setTema(valor as TemaPreferencia)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLARO">Claro</SelectItem>
                <SelectItem value="ESCURO">Escuro</SelectItem>
                <SelectItem value="SISTEMA">Seguir o sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Marca da loja
          </CardTitle>
          <CardDescription>
            Nome e logo aparecem no menu lateral e no cabeçalho dos PDFs — a marca do app continua
            sendo Skubo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="nome-loja">Nome da loja</Label>
              <Input
                id="nome-loja"
                value={nomeLoja}
                onChange={(e) => setNomeLoja(e.target.value)}
                maxLength={80}
                placeholder="Ex.: Minha Loja"
              />
            </div>
            <Button onClick={salvarNomeLoja} disabled={salvandoNomeLoja}>
              {salvandoNomeLoja ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="logo-loja">Logo da loja</Label>
            <div className="flex items-center gap-3">
              {logoUrlConta && (
                <Image
                  src={logoUrlConta}
                  alt="Logo atual da loja"
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded border border-border object-contain"
                />
              )}
              <Input
                id="logo-loja"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={enviandoLogo}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) enviarLogo(file);
                  e.target.value = "";
                }}
                className="max-w-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP, até 2 MB.</p>
          </div>
        </CardContent>
      </Card>

      {podeVerCusto && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Financeiro
            </CardTitle>
            <CardDescription>
              Alíquota de imposto usada no cálculo de margem (Simples Nacional
              etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="aliquota-imposto">Alíquota de imposto (%)</Label>
                <Input
                  id="aliquota-imposto"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={aliquotaImposto}
                  onChange={(e) =>
                    setAliquotaImposto(Number(e.target.value))
                  }
                  className="w-32"
                />
              </div>
              <Button onClick={salvarAliquota} disabled={salvandoAliquota}>
                {salvandoAliquota ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Padrão: 0%. Se não configurada, a margem é calculada sem desconto
              de imposto — ajuste aqui para refletir o regime tributário real.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Integrações
              </CardTitle>
              <CardDescription>
                Status das conexões com marketplaces e ERPs
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link href="/integracoes">
                Gerenciar
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
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
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
