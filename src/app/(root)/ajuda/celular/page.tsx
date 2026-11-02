"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Share, MoreVertical, CheckCircle2, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plataforma = "ios" | "android" | "outro";

function detectarPlataforma(): Plataforma {
  if (typeof navigator === "undefined") return "outro";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "outro";
}

function jaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export default function AjudaCelularPage() {
  const router = useRouter();
  const [plataforma, setPlataforma] = useState<Plataforma>("outro");
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    setPlataforma(detectarPlataforma());
    setInstalado(jaInstalado());
  }, []);

  const confirmarInstalado = async () => {
    await fetch("/api/onboarding/pular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marcador: "12_instalado" }),
    }).catch(() => {});
    router.push("/comecar");
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <PageHeader
        title="Instalar o Skubo no celular"
        subtitle="Abre em tela cheia, com ícone próprio — sem barra do navegador."
      />

      {instalado ? (
        <SectionCard>
          <div className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success-text" />
            <p className="text-sm text-foreground">
              Parece que você já está usando o Skubo instalado — nada a fazer aqui.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="iPhone (Safari)"
            className={cn(plataforma !== "ios" && "opacity-70")}
          >
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                <span>
                  Abra <span className="font-mono text-xs">estoque-api-4iqj.vercel.app</span> no Safari (precisa ser o Safari, não outro navegador).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                <span className="flex items-center gap-1.5">
                  Toque no botão Compartilhar <Share className="inline h-4 w-4" strokeWidth={1.75} /> na barra de baixo.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                <span>Role e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>
                <span>Toque em <strong>Adicionar</strong>, no canto superior.</span>
              </li>
            </ol>
          </SectionCard>

          <SectionCard
            title="Android (Chrome)"
            className={cn(plataforma !== "android" && "opacity-70")}
          >
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                <span>
                  Abra <span className="font-mono text-xs">estoque-api-4iqj.vercel.app</span> no Chrome.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                <span className="flex items-center gap-1.5">
                  Toque no menu <MoreVertical className="inline h-4 w-4" strokeWidth={1.75} /> no canto superior direito.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                <span>
                  Toque em <strong>&quot;Instalar app&quot;</strong> (ou &quot;Adicionar à tela inicial&quot;, dependendo da versão do Chrome).
                </span>
              </li>
            </ol>
          </SectionCard>

          <div className="flex justify-center">
            <Button onClick={confirmarInstalado} className="gap-2">
              <Smartphone className="h-4 w-4" />
              Já instalei
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
