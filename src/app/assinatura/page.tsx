"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { CheckCircle2, Loader2, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRLReais, formatDateBR } from "@/lib/format";

interface SubscriptionStatus {
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  plan: "MONTHLY" | "ANNUAL" | null;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  active: boolean;
  paymentsConfigured: boolean;
}

export default function AssinaturaPage() {
  const { status: sessionStatus } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<"MONTHLY" | "ANNUAL" | null>(
    null
  );
  const [cancelling, setCancelling] = useState(false);

  const loadStatus = () => {
    fetch("/api/mercadopago/status")
      .then((response) => response.json())
      .then(setSubscription)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  const handleCancel = async () => {
    if (!window.confirm("Cancelar sua assinatura? Você perde o acesso ao final do período já pago.")) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch("/api/mercadopago/cancel", { method: "POST" });
      if (!response.ok) throw new Error();
      loadStatus();
    } catch {
      console.error("Erro ao cancelar assinatura");
    } finally {
      setCancelling(false);
    }
  };

  const handleSubscribe = async (plan: "MONTHLY" | "ANNUAL") => {
    setRedirecting(plan);
    try {
      const response = await fetch("/api/mercadopago/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Erro ao iniciar assinatura");
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      setRedirecting(null);
      console.error("Erro ao assinar:", error);
    }
  };

  if (loading || sessionStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Assinatura</h1>
            <p className="text-muted-foreground">
              Escolha um plano para continuar usando o Leap Stock.
            </p>
          </div>
          <Button variant="ghost" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {subscription?.status === "TRIALING" && (
          <Card className="border-info bg-info/5">
            <CardContent className="p-4 text-sm">
              Seu período de teste termina em{" "}
              {formatDateBR(subscription.trialEndsAt)}.
            </CardContent>
          </Card>
        )}

        {subscription?.status === "ACTIVE" && (
          <Card className="border-success bg-success/5">
            <CardContent className="p-4 flex items-center justify-between gap-4 text-sm">
              <span>
                Assinatura ativa
                {subscription.currentPeriodEnd &&
                  ` · renova em ${formatDateBR(subscription.currentPeriodEnd)}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Cancelar assinatura"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {subscription?.status === "PAST_DUE" && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 text-sm">
              Não conseguimos confirmar seu último pagamento. Escolha um plano
              abaixo para reativar o acesso.
            </CardContent>
          </Card>
        )}

        {!subscription?.paymentsConfigured && (
          <Card className="border-warning bg-warning/5">
            <CardContent className="p-4 text-sm">
              Pagamentos ainda não estão configurados nesta conta. Fale com o
              suporte.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Mensal
                {subscription?.plan === "MONTHLY" && subscription.active && (
                  <Badge>Atual</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {formatBRLReais(19.7)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    no primeiro mês
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Depois {formatBRLReais(37.9)}/mês
                </p>
              </div>
              <Button
                className="w-full"
                disabled={
                  !subscription?.paymentsConfigured || redirecting !== null
                }
                onClick={() => handleSubscribe("MONTHLY")}
              >
                {redirecting === "MONTHLY" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Assinar mensal"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Anual
                {subscription?.plan === "ANNUAL" && subscription.active && (
                  <Badge>Atual</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {formatBRLReais(389.7)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    /ano
                  </span>
                </p>
                <p className="text-sm text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Economize vs. plano mensal
                </p>
              </div>
              <Button
                className="w-full"
                disabled={
                  !subscription?.paymentsConfigured || redirecting !== null
                }
                onClick={() => handleSubscribe("ANNUAL")}
              >
                {redirecting === "ANNUAL" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Assinar anual"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
