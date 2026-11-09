"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PainelAdmin({
  titulo,
  children,
  acao,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-card border border-border/80 bg-card p-5 shadow-card", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-foreground">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function TabelaAdmin({
  colunas,
  linhas,
  vazio = "Nada por aqui.",
}: {
  colunas: Array<{ titulo: string; alinhar?: "direita" }>;
  linhas: React.ReactNode[][];
  vazio?: string;
}) {
  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>;
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {colunas.map((coluna) => (
              <th key={coluna.titulo} className={cn("px-2 py-2 font-medium", coluna.alinhar === "direita" && "text-right")}>
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-b border-divider last:border-0">
              {linha.map((celula, j) => (
                <td key={j} className={cn("px-2 py-2 align-top", colunas[j]?.alinhar === "direita" && "text-right tabular-nums")}>
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function chamarAdmin<T = Record<string, unknown>>(
  url: string,
  metodo: "POST" | "PUT" | "PATCH" | "DELETE",
  corpo?: unknown
): Promise<T> {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(dados?.error ?? "Não foi possível concluir.");
  return dados as T;
}

export function DialogoAcaoAdmin({
  aberto,
  aoFechar,
  titulo,
  descricao,
  rotuloConfirmar = "Confirmar",
  perigoso = false,
  children,
  aoConfirmar,
  bloquearConfirmar = false,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  rotuloConfirmar?: string;
  perigoso?: boolean;
  children?: React.ReactNode;
  aoConfirmar: (motivo: string) => Promise<string | void>;
  bloquearConfirmar?: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (motivo.trim().length < 3) {
      toast.error("Escreva o motivo da ação.");
      return;
    }
    setEnviando(true);
    try {
      const mensagem = await aoConfirmar(motivo.trim());
      toast.success(mensagem || "Feito.");
      setMotivo("");
      aoFechar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          {children}
          <div className="space-y-1.5">
            <Label htmlFor="motivo-acao">Motivo (vai para a auditoria)</Label>
            <Textarea id="motivo-acao" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={1000} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={aoFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            onClick={confirmar}
            disabled={enviando || bloquearConfirmar}
            className={cn(perigoso && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {rotuloConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const ROTULO_SITUACAO: Record<string, { texto: string; tom: "success" | "info" | "warning" | "critical" | "neutral" }> = {
  TESTE: { texto: "Em teste", tom: "info" },
  ATIVA: { texto: "Ativa", tom: "success" },
  INADIMPLENTE: { texto: "Inadimplente", tom: "critical" },
  VENCIDA: { texto: "Vencida", tom: "warning" },
  CANCELADA: { texto: "Cancelada", tom: "neutral" },
  BLOQUEADA: { texto: "Bloqueada", tom: "critical" },
};

export function baixarArquivo(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
