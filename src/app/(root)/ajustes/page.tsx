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
  TrendingDown,
  Wallet,
  Users,
  Sparkles,
  Trash2,
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

const IntegrationRow = ({ icon, name, detail, lastSync, status }: IntegrationRowProps) => {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-4 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="shrink-0 rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{name}</p>
            {status === "ativo" && <Badge className="bg-success/15 text-success-text">Ativo</Badge>}
            {status === "expirado" && <Badge className="bg-warning/15 text-warning-text">Expirado</Badge>}
            {status === "desconectado" && <Badge variant="outline">Desconectado</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">{detail}</p>
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

const SECOES = [
  { id: "conta", label: "Conta" },
  { id: "marca", label: "Loja e marca" },
  { id: "financeiro", label: "Impostos e faturamento" },
  { id: "reposicao", label: "Reposição" },
  { id: "integracoes", label: "Mercado Livre e Bling" },
  { id: "financeiro-link", label: "Financeiro" },
  { id: "usuarios", label: "Usuários" },
  { id: "ia", label: "Skubo IA" },
  { id: "aparencia", label: "Aparência" },
] as const;

export default function AjustesPage() {
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
  const [leadTimePadrao, setLeadTimePadrao] = useState(7);
  const [salvandoLeadTime, setSalvandoLeadTime] = useState(false);
  const [nomeLoja, setNomeLoja] = useState("");
  const [salvandoNomeLoja, setSalvandoNomeLoja] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [apagandoConversas, setApagandoConversas] = useState(false);

  const papel = session?.user?.role;
  const podeVerCusto = papel === "ADMIN" || papel === "COMPRAS";
  const isAdmin = papel === "ADMIN";
  const donoDaConta = Boolean(session?.user?.id && session.user.contaId === session.user.id);

  const apagarConversasDaConta = async () => {
    if (!window.confirm("Apagar todas as conversas com o Skubo IA de todas as pessoas da conta? Não dá para desfazer.")) return;
    setApagandoConversas(true);
    try {
      const resposta = await fetch("/api/ia/conversas?escopo=conta", { method: "DELETE" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(corpo?.error ?? "Não foi possível apagar as conversas.");
        return;
      }
      toast.success(`${corpo?.apagadas ?? 0} conversa(s) apagada(s).`);
    } finally {
      setApagandoConversas(false);
    }
  };

  useEffect(() => {
    fetch("/api/configuracoes-gerais")
      .then((res) => res.json())
      .then((data) => {
        if (podeVerCusto) setAliquotaImposto((data.aliquotaImposto ?? 0) * 100);
        setLeadTimePadrao(data.avgDeliveryDaysPadrao ?? 7);
      })
      .catch(() => toast.error("Erro ao carregar configurações gerais"));
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

  const enviarLogo = useCallback(
    async (file: File) => {
      setEnviandoLogo(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/configuracoes-gerais/logo", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao enviar logo");
        atualizarBranding({ logoUrl: data.logoUrl });
        toast.success("Logo da loja atualizada");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao enviar logo");
      } finally {
        setEnviandoLogo(false);
      }
    },
    [atualizarBranding]
  );

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

  const salvarLeadTime = useCallback(async () => {
    setSalvandoLeadTime(true);
    try {
      const res = await fetch("/api/configuracoes-gerais", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avgDeliveryDaysPadrao: leadTimePadrao }),
      });
      if (!res.ok) throw new Error();
      toast.success("Prazo padrão de reposição atualizado");
    } catch {
      toast.error("Erro ao salvar prazo padrão");
    } finally {
      setSalvandoLeadTime(false);
    }
  }, [leadTimePadrao]);

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
      if (blingRes.ok) setBlingAccounts(await blingRes.json());
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
  const blingAccount = blingAccounts.find((acc) => acc.isActive) ?? blingAccounts[0];

  const mlStatus: IntegrationRowProps["status"] = !mlAccount ? "desconectado" : mlAccount.isActive ? "ativo" : "expirado";
  const blingStatus: IntegrationRowProps["status"] = !blingAccount ? "desconectado" : blingAccount.isActive ? "ativo" : "expirado";

  const secoesVisiveis = SECOES.filter((s) => s.id !== "usuarios" || isAdmin);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Ajustes" subtitle="Loja, impostos, reposição, integrações e aparência" />

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="hidden shrink-0 lg:block lg:w-48">
          <ul className="sticky top-6 space-y-1 text-sm">
            {secoesVisiveis.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <Card id="conta" className="scroll-mt-6">
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
                  <p className="font-medium">{session?.user?.name || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{session?.user?.email || "—"}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair da conta
              </Button>
            </CardContent>
          </Card>

          <Card id="marca" className="scroll-mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Loja e marca
              </CardTitle>
              <CardDescription>
                Nome e logo aparecem no menu lateral e no cabeçalho dos PDFs — a marca do app continua sendo
                Skubo
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
            <Card id="financeiro" className="scroll-mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Impostos e faturamento
                </CardTitle>
                <CardDescription>Alíquota de imposto usada no cálculo de margem (Simples Nacional etc.)</CardDescription>
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
                      onChange={(e) => setAliquotaImposto(Number(e.target.value))}
                      className="w-32"
                    />
                  </div>
                  <Button onClick={salvarAliquota} disabled={salvandoAliquota}>
                    {salvandoAliquota ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Padrão: 0%. Se não configurada, a margem é calculada sem desconto de imposto — ajuste aqui
                  para refletir o regime tributário real. Os três modos de faturamento ficam em{" "}
                  <Link href="/financeiro/configuracoes" className="text-primary hover:underline">
                    Ajustes do financeiro
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          )}

          <Card id="reposicao" className="scroll-mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Reposição
              </CardTitle>
              <CardDescription>
                Prazo de entrega usado quando o fornecedor principal de um produto não tem prazo cadastrado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="lead-time-padrao">Prazo padrão (dias)</Label>
                  <Input
                    id="lead-time-padrao"
                    type="number"
                    min={1}
                    max={365}
                    value={leadTimePadrao}
                    onChange={(e) => setLeadTimePadrao(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
                <Button onClick={salvarLeadTime} disabled={salvandoLeadTime}>
                  {salvandoLeadTime ? "Salvando..." : "Salvar"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Padrão: 7 dias.</p>
            </CardContent>
          </Card>

          <Card id="integracoes" className="scroll-mt-6">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Mercado Livre e Bling
                  </CardTitle>
                  <CardDescription>Status das conexões com marketplace e ERP</CardDescription>
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
                    detail={mlAccount ? mlAccount.userInfo?.email || mlAccount.nickname : "Sincronize anúncios, estoque e vendas"}
                    lastSync={null}
                    status={mlStatus}
                  />
                  <IntegrationRow
                    icon={<Store className="h-5 w-5" />}
                    name="Bling"
                    detail={blingAccount ? `Conectado ${formatRelativeTime(blingAccount.createdAt)}` : "Importe produtos e estoque do seu ERP"}
                    lastSync={blingAccount?.lastSyncAt ?? null}
                    status={blingStatus}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="financeiro-link" className="scroll-mt-6">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Financeiro
                  </CardTitle>
                  <CardDescription>
                    Modo de faturamento, rateio de custo fixo, cobertura de fretes e liberação de pagamentos
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/financeiro/configuracoes">
                    Abrir
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
          </Card>

          {isAdmin && (
            <Card id="usuarios" className="scroll-mt-6">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Usuários
                    </CardTitle>
                    <CardDescription>Quem tem acesso à conta e com qual papel</CardDescription>
                  </div>
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link href="/usuarios">
                      Abrir
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          <Card id="ia" className="scroll-mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Skubo IA
              </CardTitle>
              <CardDescription>Assistente, explicações nas telas e resumo semanal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1.5 text-sm text-fg2">
                <li>Cada conversa é de quem perguntou: ninguém da equipe vê a conversa do outro.</li>
                <li>As conversas ficam guardadas por 90 dias e depois são apagadas sozinhas. Você pode apagar qualquer uma antes.</li>
                <li>
                  Para responder, os números da loja são enviados à Anthropic, a empresa do modelo de IA, sem dados pessoais de
                  compradores. Pelos termos comerciais da Anthropic, esses dados não são usados para treinar modelos.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href="/ia">
                    Abrir o assistente
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                {isAdmin && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/assinatura?recurso=ia">Contratar ou gerenciar</Link>
                  </Button>
                )}
                {donoDaConta && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={apagarConversasDaConta}
                    disabled={apagandoConversas}
                    className="gap-2 text-destructive-text"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar todas as conversas da conta
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="aparencia" className="scroll-mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Aparência
              </CardTitle>
              <CardDescription>Tema da interface — vale para sua conta, não só este aparelho</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Tema</p>
                  <p className="text-sm text-muted-foreground">
                    {tema === "SISTEMA" ? "Segue o sistema do aparelho" : isDarkMode ? "Escuro" : "Claro"}
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
        </div>
      </div>
    </div>
  );
}
