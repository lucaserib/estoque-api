"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface Estado {
  email: string;
  categoria: "CICLO_DE_VIDA" | "MARKETING" | "TUDO";
  cicloDeVida: boolean;
  marketing: boolean;
}

const DESLIGADO: Record<Estado["categoria"], string> = {
  CICLO_DE_VIDA: "as dicas e lembretes sobre o uso do Skubo",
  MARKETING: "as novidades e ofertas",
  TUDO: "todos os e-mails que não são essenciais",
};

export function PainelDescadastro() {
  const token = useSearchParams().get("t") ?? "";
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const aplicado = useRef(false);

  useEffect(() => {
    if (aplicado.current) return;
    aplicado.current = true;
    if (!token) {
      setErro("Link de descadastro inválido.");
      return;
    }
    fetch("/api/descadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token }),
    })
      .then(async (resposta) => {
        const corpo = await resposta.json().catch(() => null);
        if (!resposta.ok) throw new Error(corpo?.error ?? "Link de descadastro inválido.");
        setEstado(corpo);
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Link de descadastro inválido."));
  }, [token]);

  const salvar = async () => {
    if (!estado) return;
    setSalvando(true);
    try {
      const resposta = await fetch("/api/descadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, cicloDeVida: estado.cicloDeVida, marketing: estado.marketing }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error);
      setEstado(corpo);
      toast.success("Preferências salvas.");
    } catch {
      toast.error("Não foi possível salvar agora.");
    } finally {
      setSalvando(false);
    }
  };

  if (erro) {
    return (
      <Card>
        <CardContent className="p-6 text-sm">{erro} Se precisar, responda qualquer e-mail nosso pedindo o descadastro.</CardContent>
      </Card>
    );
  }

  if (!estado) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-text" />
          <div>
            <h1 className="text-lg font-semibold">Pronto, desligamos {DESLIGADO[estado.categoria]}.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Para {estado.email}. Ajuste abaixo o que quer continuar recebendo.</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Dicas para usar o Skubo</span>
              <span className="block text-xs text-muted-foreground">Lembretes de configuração, teste e uso da IA.</span>
            </span>
            <Switch
              checked={estado.cicloDeVida}
              onCheckedChange={(valor) => setEstado({ ...estado, cicloDeVida: valor })}
              aria-label="Dicas para usar o Skubo"
            />
          </label>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Novidades e ofertas</span>
              <span className="block text-xs text-muted-foreground">Lançamentos, promoções e conteúdo para vender mais.</span>
            </span>
            <Switch
              checked={estado.marketing}
              onCheckedChange={(valor) => setEstado({ ...estado, marketing: valor })}
              aria-label="Novidades e ofertas"
            />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          E-mails essenciais, como recibos, redefinição de senha e avisos da sua assinatura, continuam chegando.
        </p>

        <Button onClick={salvar} disabled={salvando} className="w-full sm:w-auto">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar preferências"}
        </Button>
      </CardContent>
    </Card>
  );
}
