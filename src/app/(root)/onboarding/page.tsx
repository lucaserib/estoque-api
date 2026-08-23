"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Store,
  Upload,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Header from "@/app/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StepDefinition {
  id: number;
  title: string;
  description: string;
  icon: typeof Store;
  href: string;
  actionLabel: string;
  completed: boolean;
}

export default function OnboardingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mlConnected, setMlConnected] = useState(false);
  const [hasProdutos, setHasProdutos] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const loadStatus = async () => {
      try {
        const [accountsRes, produtosRes] = await Promise.all([
          fetch("/api/mercadolivre/auth?action=accounts"),
          fetch("/api/produtos"),
        ]);

        if (accountsRes.ok) {
          const data = await accountsRes.json();
          const list = Array.isArray(data) ? data : data.accounts || [];
          setMlConnected(
            list.some((acc: { isActive: boolean }) => acc.isActive)
          );
        }

        if (produtosRes.ok) {
          const produtos = await produtosRes.json();
          setHasProdutos(Array.isArray(produtos) && produtos.length > 0);
        }
      } catch (error) {
        console.error("Erro ao carregar status do onboarding:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, [status]);

  const handleConnect = async () => {
    try {
      const response = await fetch("/api/mercadolivre/auth?action=connect");
      if (!response.ok) throw new Error();
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch {
      router.push("/configuracoes");
    }
  };

  const steps: StepDefinition[] = [
    {
      id: 1,
      title: "Conectar Mercado Livre",
      description:
        "Autorize o acesso à sua conta para sincronizar produtos, preços e vendas automaticamente.",
      icon: Store,
      href: "#",
      actionLabel: mlConnected ? "Conectado" : "Conectar",
      completed: mlConnected,
    },
    {
      id: 2,
      title: "Importar produtos e estoque",
      description:
        "Traga seu catálogo do Bling ou suba uma planilha com SKU, quantidade e custo médio.",
      icon: Upload,
      href: "/produtos/importar",
      actionLabel: "Importar",
      completed: hasProdutos,
    },
    {
      id: 3,
      title: "Ver reposição",
      description:
        "Com produtos e vendas sincronizados, veja quais itens precisam de reposição prioritária.",
      icon: TrendingUp,
      href: "/reposicao",
      actionLabel: "Ver reposição",
      completed: false,
    },
  ];

  if (loading || status === "loading") {
    return (
      <div className="container mx-auto max-w-3xl p-6 space-y-6">
        <Header title="Comece por aqui" subtitle="Configuração inicial da conta" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <Header
        title="Comece por aqui"
        subtitle="3 passos para deixar o Leap Store pronto para uso"
      />

      <div className="space-y-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Card
              key={step.id}
              className={cn(
                "border-border",
                step.completed && "border-success/40 bg-success/5"
              )}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                    step.completed
                      ? "border-success bg-success/10 text-success"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    Passo {step.id} — {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                <Button
                  variant={step.completed ? "outline" : "default"}
                  onClick={() =>
                    step.id === 1 ? handleConnect() : router.push(step.href)
                  }
                  disabled={step.id === 1 && step.completed}
                >
                  {step.actionLabel}
                  {!step.completed && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          Pular e ir para o Dashboard
        </Button>
      </div>
    </div>
  );
}
