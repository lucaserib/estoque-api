"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRLReais, formatDateBR } from "@/lib/format";
import { type AcessoIaCliente, useAcessoIa } from "./useAcessoIa";

const INCLUSO = [
  "Assistente que responde com os números da sua loja (Ctrl+J em qualquer tela)",
  "“Por que essa sugestão?” na Reposição e “Explicar variação” no Financeiro",
  "Análise da Central de controle e resumo semanal toda segunda",
  "Consumo justo: limite mensal para você nunca ter surpresa",
];

function situacao(acesso: AcessoIaCliente): { texto: string; tom: "sucesso" | "info" | "alerta" | "neutro" } {
  if (acesso.origem === "MANUAL" || acesso.origem === "ENV") return { texto: "Liberado pela equipe Skubo", tom: "sucesso" };
  if (acesso.status === "ATIVA") return { texto: "Ativo", tom: "sucesso" };
  if (acesso.origem === "TESTE") return { texto: `Teste grátis até ${formatDateBR(acesso.testeAteEm!)}`, tom: "info" };
  if (acesso.status === "PENDENTE") return { texto: "Pagamento pendente", tom: "alerta" };
  if (acesso.status === "CANCELADA" && acesso.liberada && acesso.periodoFim) {
    return { texto: `Cancelado · acesso até ${formatDateBR(acesso.periodoFim)}`, tom: "neutro" };
  }
  return { texto: "Não contratado", tom: "neutro" };
}

export function CartaoSkuboIaAssinatura() {
  const { acesso, recarregar } = useAcessoIa();
  const [acao, setAcao] = useState<"teste" | "assinar" | "cancelar" | null>(null);

  const executar = async (tipo: "teste" | "assinar" | "cancelar") => {
    if (tipo === "cancelar" && !window.confirm("Cancelar o Skubo IA? Você continua com acesso até o fim do período pago.")) return;
    setAcao(tipo);
    try {
      const rota = tipo === "teste" ? "teste" : tipo === "assinar" ? "assinar" : "cancelar";
      const resposta = await fetch(`/api/assinatura/ia/${rota}`, { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (tipo === "assinar" && resposta.ok && corpo?.checkoutUrl) {
        window.location.href = corpo.checkoutUrl;
        return;
      }
      if (tipo === "assinar" && resposta.status === 503) {
        const pedido = await fetch("/api/assinatura/ia", { method: "POST" });
        if (pedido.ok) toast.success("Pedido enviado. Avisamos assim que o Skubo IA estiver ativo.");
        else toast.error("Não foi possível registrar o pedido.");
        return;
      }
      if (!resposta.ok) {
        toast.error(corpo?.error ?? "Não foi possível concluir agora.");
        return;
      }
      toast.success(tipo === "teste" ? "Teste grátis liberado por 7 dias." : "Skubo IA cancelado.");
      await recarregar();
    } finally {
      setAcao(null);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/30" data-testid="cartao-skubo-ia">
      <div className="bg-hero px-6 py-5 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <p className="text-lg font-semibold">Skubo IA</p>
          {acesso && (
            <span
              data-tom={situacao(acesso).tom}
              className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/25"
            >
              {situacao(acesso).texto}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/85">Um analista de e-commerce que conversa com os dados da sua loja.</p>
      </div>
      <CardContent className="grid gap-5 pt-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <ul className="space-y-1.5 text-sm text-fg2">
          {INCLUSO.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
              {item}
            </li>
          ))}
        </ul>
        {!acesso ? (
          <Skeleton className="h-24 w-48" />
        ) : (
          <div className="space-y-3 sm:min-w-[220px] sm:text-right">
            <p className="text-2xl font-bold tabular-nums">
              + {formatBRLReais(acesso.precoMensal)}
              <span className="text-sm font-normal text-muted-foreground"> /mês</span>
            </p>
            {acesso.liberada && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, acesso.consumo.percentual)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {acesso.consumo.percentual}% do uso {acesso.origem === "TESTE" ? "do teste" : "do mês"} · renova em{" "}
                  {formatDateBR(acesso.consumo.renovaEm)}
                </p>
              </div>
            )}
            {acesso.podeAssinar ? (
              <div className="flex flex-col gap-2 sm:items-end">
                {acesso.testeDisponivel && (
                  <Button onClick={() => executar("teste")} disabled={acao !== null} className="w-full gap-2 sm:w-auto">
                    {acao === "teste" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Testar grátis por 7 dias
                  </Button>
                )}
                {acesso.status !== "ATIVA" && acesso.origem !== "MANUAL" && acesso.origem !== "ENV" && (
                  <Button
                    onClick={() => executar("assinar")}
                    disabled={acao !== null}
                    variant={acesso.testeDisponivel ? "outline" : "default"}
                    className="w-full gap-2 sm:w-auto"
                  >
                    {acao === "assinar" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Assinar o Skubo IA
                  </Button>
                )}
                {(acesso.status === "ATIVA" || acesso.status === "PENDENTE") && (
                  <Button onClick={() => executar("cancelar")} disabled={acao !== null} variant="outline" size="sm" className="w-full sm:w-auto">
                    {acao === "cancelar" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar Skubo IA"}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Só o administrador da conta pode contratar.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
