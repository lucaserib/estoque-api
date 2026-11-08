"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBRLReais, formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type AcessoIaCliente, recarregarAcessoIa } from "./useAcessoIa";

const BENEFICIOS = [
  "Pergunte em português: “o que preciso comprar esta semana?”",
  "Respostas com os números reais da Reposição, do Financeiro e dos Anúncios",
  "“Por que essa sugestão?” e “Explicar variação” direto nas telas",
  "Resumo semanal da loja toda segunda de manhã",
];

export function CartaoVendaIa({ acesso, className }: { acesso: AcessoIaCliente; className?: string }) {
  const [acao, setAcao] = useState<"teste" | "assinar" | null>(null);

  const iniciarTeste = async () => {
    setAcao("teste");
    try {
      const resposta = await fetch("/api/assinatura/ia/teste", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(corpo?.error ?? "Não foi possível iniciar o teste agora.");
        return;
      }
      toast.success("Teste grátis liberado por 7 dias. Pode perguntar!");
      await recarregarAcessoIa();
    } finally {
      setAcao(null);
    }
  };

  const assinar = async () => {
    setAcao("assinar");
    try {
      const resposta = await fetch("/api/assinatura/ia/assinar", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (resposta.ok && corpo?.checkoutUrl) {
        window.location.href = corpo.checkoutUrl;
        return;
      }
      if (resposta.status === 503) {
        const pedido = await fetch("/api/assinatura/ia", { method: "POST" });
        if (pedido.ok) {
          toast.success("Pedido enviado. Avisamos assim que o Skubo IA estiver ativo.");
          return;
        }
      }
      toast.error(corpo?.error ?? "Não foi possível abrir o pagamento agora.");
    } finally {
      setAcao(null);
    }
  };

  const testeEncerrado = !acesso.testeDisponivel && acesso.testeAteEm && acesso.origem === null;

  return (
    <div className={cn("overflow-hidden rounded-card border border-border/80 bg-card shadow-card", className)}>
      <div className="bg-hero px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <p className="text-sm font-semibold">Skubo IA</p>
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
            {formatBRLReais(acesso.precoMensal)}/mês
          </span>
        </div>
        <p className="mt-1 text-xs text-white/80">Um analista de e-commerce que conhece os números da sua loja.</p>
      </div>
      <div className="space-y-4 p-5">
        <ul className="space-y-2">
          {BENEFICIOS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-fg2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
              {b}
            </li>
          ))}
        </ul>

        {testeEncerrado && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-fg2">
            Seu teste grátis terminou em {formatDateBR(acesso.testeAteEm!)}. Assine para continuar usando.
          </p>
        )}
        {acesso.status === "PENDENTE" && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-text">
            O último pagamento do Skubo IA não foi aprovado. Atualize o cartão no Mercado Pago ou assine de novo.
          </p>
        )}

        {acesso.podeAssinar ? (
          <div className="flex flex-col gap-2">
            {acesso.testeDisponivel && (
              <Button onClick={iniciarTeste} disabled={acao !== null} className="w-full gap-2">
                {acao === "teste" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Testar grátis por 7 dias
              </Button>
            )}
            <Button
              onClick={assinar}
              disabled={acao !== null}
              variant={acesso.testeDisponivel ? "outline" : "default"}
              className="w-full gap-2"
            >
              {acao === "assinar" && <Loader2 className="h-4 w-4 animate-spin" />}
              Assinar por {formatBRLReais(acesso.precoMensal)}/mês
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Peça ao administrador da sua conta para ativar o Skubo IA.</p>
        )}
      </div>
    </div>
  );
}
