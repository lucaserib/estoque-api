"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  Link2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Package,
  Store,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImportStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "error";
  icon: React.ReactNode;
}

interface BlingAccountStatus {
  id: string;
  isActive: boolean;
}

interface ImportResumo {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
}

export default function ImportarProdutosPage() {
  const router = useRouter();
  const { status } = useSession();

  const [blingAccount, setBlingAccount] = useState<BlingAccountStatus | null>(
    null
  );
  const [mlConnected, setMlConnected] = useState(false);
  const [mlAccount, setMlAccount] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResumo, setImportResumo] = useState<ImportResumo | null>(null);
  const [matchingResults, setMatchingResults] = useState<{
    summary: {
      byType: { ean: number; sku: number; fuzzy: number };
      byStatus: { matched: number; pendingReview: number };
    };
  } | null>(null);

  const blingConnected = blingAccount?.isActive === true;
  const blingExpired = blingAccount !== null && !blingAccount.isActive;

  const [steps, setSteps] = useState<ImportStep[]>([
    {
      id: "bling",
      title: "Conectar Bling",
      description: "Conecte sua conta do Bling para importar produtos",
      status: "pending",
      icon: <Store className="h-5 w-5" />,
    },
    {
      id: "import",
      title: "Importar Produtos",
      description: "Importar produtos do Bling para o sistema",
      status: "pending",
      icon: <Download className="h-5 w-5" />,
    },
    {
      id: "ml",
      title: "Sincronizar ML",
      description: "Buscar anúncios do Mercado Livre",
      status: "pending",
      icon: <Store className="h-5 w-5 text-warning" />,
    },
    {
      id: "match",
      title: "Vincular Produtos",
      description: "Vincular produtos locais com anúncios do ML",
      status: "pending",
      icon: <Link2 className="h-5 w-5" />,
    },
  ]);

  const updateStepStatus = (stepId: string, status: ImportStep["status"]) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  const checkConnections = useCallback(async () => {
    setLoading(true);
    try {
      const blingRes = await fetch("/api/bling/auth?action=accounts");
      if (blingRes.ok) {
        const blingAccounts: BlingAccountStatus[] = await blingRes.json();
        const active = blingAccounts.find((acc) => acc.isActive);
        const first = blingAccounts[0] ?? null;
        setBlingAccount(active ?? first);
        if (active) {
          updateStepStatus("bling", "completed");
        } else if (first) {
          updateStepStatus("bling", "error");
        }
      }

      const mlRes = await fetch("/api/mercadolivre/auth?action=accounts");
      if (mlRes.ok) {
        const mlAccounts = await mlRes.json();
        const activeML = Array.isArray(mlAccounts)
          ? mlAccounts.find((acc: { isActive: boolean }) => acc.isActive)
          : mlAccounts.accounts?.find(
              (acc: { isActive: boolean }) => acc.isActive
            );

        if (activeML) {
          setMlConnected(true);
          setMlAccount(activeML);
          updateStepStatus("ml", "completed");
        }
      }
    } catch (error) {
      console.error("Erro ao verificar conexões:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      checkConnections();
    }
  }, [status, checkConnections]);

  const connectBling = async () => {
    try {
      const response = await fetch("/api/bling/auth?action=connect");
      if (!response.ok) throw new Error("Erro ao conectar Bling");

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao conectar com Bling");
    }
  };

  const importFromBling = async () => {
    if (!blingAccount || !blingConnected) {
      toast.error("Conecte o Bling primeiro");
      return;
    }

    setImporting(true);
    setImportResumo(null);
    updateStepStatus("import", "in_progress");

    try {
      const response = await fetch("/api/bling/produtos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: blingAccount.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData?.code === "BLING_RECONNECT_REQUIRED") {
          updateStepStatus("import", "error");
          setBlingAccount((prev) =>
            prev ? { ...prev, isActive: false } : prev
          );
          updateStepStatus("bling", "error");
          return;
        }
        throw new Error(errorData?.error || "Erro na importação");
      }

      const result: ImportResumo = await response.json();
      setImportResumo(result);

      updateStepStatus("import", "completed");
      toast.success(
        `Importação concluída: ${result.criados} criados, ${result.atualizados} atualizados`
      );

      if (mlConnected) {
        await syncMercadoLivre();
      }
    } catch {
      updateStepStatus("import", "error");
      toast.error("Erro ao importar produtos do Bling");
    } finally {
      setImporting(false);
    }
  };

  const syncMercadoLivre = async () => {
    if (!mlAccount) {
      toast.error("Conecte o Mercado Livre primeiro");
      return;
    }

    updateStepStatus("ml", "in_progress");

    try {
      const response = await fetch("/api/mercadolivre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: mlAccount.id,
          syncType: "products",
        }),
      });

      if (!response.ok) throw new Error("Erro na sincronização ML");

      const result = await response.json();

      updateStepStatus("ml", "completed");
      toast.success(`${result.syncedCount} anúncios sincronizados!`);

      await executeMatching();
    } catch {
      updateStepStatus("ml", "error");
      toast.error("Erro ao sincronizar Mercado Livre");
    }
  };

  const executeMatching = async () => {
    if (!mlAccount) return;

    updateStepStatus("match", "in_progress");

    try {
      const response = await fetch("/api/produtos/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mlAccountId: mlAccount.id,
          autoApply: true,
        }),
      });

      if (!response.ok) throw new Error("Erro no matching");

      const result = await response.json();
      setMatchingResults(result);

      updateStepStatus("match", "completed");
      toast.success(`${result.summary.byStatus.matched} produtos vinculados!`);

      if (result.summary.byStatus.pendingReview > 0) {
        toast.info(
          `${result.summary.byStatus.pendingReview} produtos precisam de revisão manual`
        );
      }
    } catch {
      updateStepStatus("match", "error");
      toast.error("Erro ao fazer matching");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto p-6">
        <Header
          title="Importar Produtos"
          subtitle="Bling → Sistema → Mercado Livre"
        />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Header
        title="Importar Produtos"
        subtitle="Integração Bling → Sistema → Mercado Livre"
      >
        <Button variant="outline" onClick={() => router.push("/produtos")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </Header>

      {blingExpired && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-semibold">Conexão com o Bling expirou</p>
                <p className="text-sm text-muted-foreground">
                  Reconecte sua conta para voltar a importar produtos e
                  sincronizar estoque.
                </p>
              </div>
            </div>
            <Button onClick={connectBling}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconectar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Progresso da Importação</CardTitle>
          <CardDescription>
            {completedSteps} de {steps.length} etapas concluídas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {steps.map((step) => (
          <Card
            key={step.id}
            className={
              step.status === "completed"
                ? "border-success"
                : step.status === "in_progress"
                ? "border-info"
                : step.status === "error"
                ? "border-destructive"
                : ""
            }
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      step.status === "completed"
                        ? "bg-success/15 text-success"
                        : step.status === "in_progress"
                        ? "bg-info/15 text-info"
                        : step.status === "error"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                </div>
                <div>
                  {step.status === "completed" && (
                    <Badge className="bg-success/15 text-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  )}
                  {step.status === "in_progress" && (
                    <Badge className="bg-info/15 text-info">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Em andamento
                    </Badge>
                  )}
                  {step.status === "error" && (
                    <Badge className="bg-destructive/15 text-destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {step.id === "bling" ? "Expirado" : "Erro"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {step.id === "bling" && !blingConnected && !blingExpired && (
                <Button onClick={connectBling}>
                  <Store className="h-4 w-4 mr-2" />
                  Conectar Bling
                </Button>
              )}
              {step.id === "import" &&
                blingConnected &&
                step.status === "pending" && (
                  <Button onClick={importFromBling} disabled={importing}>
                    {importing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Iniciar Importação
                  </Button>
                )}
            </CardContent>
          </Card>
        ))}
      </div>

      {importResumo && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-success">
                  {importResumo.criados}
                </div>
                <div className="text-sm text-muted-foreground">Criados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-info">
                  {importResumo.atualizados}
                </div>
                <div className="text-sm text-muted-foreground">
                  Atualizados
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-muted-foreground">
                  {importResumo.ignorados}
                </div>
                <div className="text-sm text-muted-foreground">Ignorados</div>
              </div>
            </div>
            {importResumo.erros.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive mb-1">
                  {importResumo.erros.length} erros na importação
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                  {importResumo.erros.slice(0, 20).map((erro) => (
                    <li key={erro}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {matchingResults && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do Matching</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-success">
                  {matchingResults.summary.byType.ean}
                </div>
                <div className="text-sm text-muted-foreground">Por EAN</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-info">
                  {matchingResults.summary.byType.sku}
                </div>
                <div className="text-sm text-muted-foreground">Por SKU</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-warning">
                  {matchingResults.summary.byType.fuzzy}
                </div>
                <div className="text-sm text-muted-foreground">
                  Por Similaridade
                </div>
              </div>
            </div>

            {matchingResults.summary.byStatus.pendingReview > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/produtos")}
              >
                <Package className="h-4 w-4 mr-2" />
                Revisar {matchingResults.summary.byStatus.pendingReview}{" "}
                Produtos Pendentes
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
