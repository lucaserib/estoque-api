"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Link2, CheckCircle2, AlertCircle, Loader2, Package, Store } from "lucide-react";
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

export default function ImportarProdutosPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [blingConnected, setBlingConnected] = useState(false);
  const [mlConnected, setMlConnected] = useState(false);
  const [blingAccount, setBlingAccount] = useState<{ id: string } | null>(null);
  const [mlAccount, setMlAccount] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [matchingResults, setMatchingResults] = useState<{
    summary: {
      byType: { ean: number; sku: number; fuzzy: number };
      byStatus: { matched: number; pendingReview: number };
    };
  } | null>(null);

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
      icon: <Store className="h-5 w-5 text-yellow-500" />,
    },
    {
      id: "match",
      title: "Vincular Produtos",
      description: "Vincular produtos locais com anúncios do ML",
      status: "pending",
      icon: <Link2 className="h-5 w-5" />,
    },
  ]);

  useEffect(() => {
    if (status === "authenticated") {
      checkConnections();
    }
  }, [status]);

  const checkConnections = async () => {
    setLoading(true);
    try {
      // Verificar Bling
      const blingRes = await fetch("/api/bling/auth?action=accounts");
      if (blingRes.ok) {
        const blingAccounts = await blingRes.json();
        if (blingAccounts.length > 0) {
          setBlingConnected(true);
          setBlingAccount(blingAccounts[0]);
          updateStepStatus("bling", "completed");
        }
      }

      // Verificar ML
      const mlRes = await fetch("/api/mercadolivre/auth?action=accounts");
      if (mlRes.ok) {
        const mlAccounts = await mlRes.json();
        const activeML = Array.isArray(mlAccounts)
          ? mlAccounts.find((acc: { isActive: boolean }) => acc.isActive)
          : mlAccounts.accounts?.find((acc: { isActive: boolean }) => acc.isActive);

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
  };

  const updateStepStatus = (stepId: string, status: ImportStep["status"]) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

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
    if (!blingAccount) {
      toast.error("Conecte o Bling primeiro");
      return;
    }

    setImporting(true);
    updateStepStatus("import", "in_progress");

    try {
      const response = await fetch("/api/bling/produtos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: blingAccount.id }),
      });

      if (!response.ok) throw new Error("Erro na importação");

      const result = await response.json();

      updateStepStatus("import", "completed");
      toast.success(`${result.summary.new} produtos importados!`);

      // Próximo passo automático: Sync ML
      if (mlConnected) {
        await syncMercadoLivre();
      }
    } catch (error) {
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

      // Próximo passo automático: Matching
      await executeMatching();
    } catch (error) {
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
          autoApply: true, // Aplicar matches automáticos
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
    } catch (error) {
      updateStepStatus("match", "error");
      toast.error("Erro ao fazer matching");
    }
  };

  const startFullImport = async () => {
    await importFromBling();
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

      {/* Progress Card */}
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

      {/* Steps */}
      <div className="grid gap-4">
        {steps.map((step, index) => (
          <Card
            key={step.id}
            className={`${
              step.status === "completed"
                ? "border-green-500"
                : step.status === "in_progress"
                ? "border-blue-500"
                : step.status === "error"
                ? "border-red-500"
                : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      step.status === "completed"
                        ? "bg-green-100 text-green-600"
                        : step.status === "in_progress"
                        ? "bg-blue-100 text-blue-600"
                        : step.status === "error"
                        ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-600"
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
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  )}
                  {step.status === "in_progress" && (
                    <Badge className="bg-blue-100 text-blue-700">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Em andamento
                    </Badge>
                  )}
                  {step.status === "error" && (
                    <Badge className="bg-red-100 text-red-700">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Erro
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {step.id === "bling" && !blingConnected && (
                <Button onClick={connectBling}>
                  <Store className="h-4 w-4 mr-2" />
                  Conectar Bling
                </Button>
              )}
              {step.id === "import" && blingConnected && step.status === "pending" && (
                <Button onClick={startFullImport} disabled={importing}>
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

      {/* Results Summary */}
      {matchingResults && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do Matching</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {matchingResults.summary.byType.ean}
                </div>
                <div className="text-sm text-gray-600">Por EAN</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {matchingResults.summary.byType.sku}
                </div>
                <div className="text-sm text-gray-600">Por SKU</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {matchingResults.summary.byType.fuzzy}
                </div>
                <div className="text-sm text-gray-600">Por Similaridade</div>
              </div>
            </div>

            {matchingResults.summary.byStatus.pendingReview > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/produtos")}
              >
                <Package className="h-4 w-4 mr-2" />
                Revisar {matchingResults.summary.byStatus.pendingReview} Produtos
                Pendentes
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
