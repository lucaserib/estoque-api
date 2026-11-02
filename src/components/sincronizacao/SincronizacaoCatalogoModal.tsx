"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type EtapaCatalogo = "BLING_PRODUTOS" | "BLING_ESTOQUE" | "ML_ANUNCIOS" | "FULL_ESTOQUE";

interface ProgressoEtapa {
  feitos: number;
  total: number;
  erros: number;
  ultimoErro?: string;
}

interface StatusCatalogo {
  emAndamento: boolean;
  etapa: EtapaCatalogo | null;
  progresso: Partial<Record<EtapaCatalogo, ProgressoEtapa>>;
  concluidoEm: string | null;
  erro: string | null;
  bling: { conectado: boolean; ultimaSincronizacaoProdutos: string | null; ultimaSincronizacaoEstoque: string | null } | null;
  mercadoLivre: { conectado: boolean; anuncios: number; anunciosComErro: number; ultimaSincronizacao: string | null } | null;
}

const ETAPAS: { chave: EtapaCatalogo; rotulo: string }[] = [
  { chave: "BLING_PRODUTOS", rotulo: "Produtos do Bling" },
  { chave: "BLING_ESTOQUE", rotulo: "Estoque do Bling" },
  { chave: "ML_ANUNCIOS", rotulo: "Anúncios do Mercado Livre" },
  { chave: "FULL_ESTOQUE", rotulo: "Estoque Full" },
];

const RODADAS_MAXIMAS = 40;

function fraseEncontrados(chave: EtapaCatalogo, progresso: ProgressoEtapa, status: StatusCatalogo): string | null {
  if (progresso.total === 0) return null;
  if (chave === "ML_ANUNCIOS" && status.mercadoLivre) {
    return `Encontramos ${status.mercadoLivre.anuncios} anúncio(s)${
      status.mercadoLivre.anunciosComErro > 0 ? `, ${status.mercadoLivre.anunciosComErro} com erro de sincronização` : ""
    }`;
  }
  return `${progresso.feitos} de ${progresso.total}${progresso.erros > 0 ? ` (${progresso.erros} com erro)` : ""}`;
}

interface SincronizacaoCatalogoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConcluido?: () => void;
}

/** Tela de carregamento com o progresso real da sincronização de catálogo (Bling + Mercado Livre). */
export function SincronizacaoCatalogoModal({ open, onOpenChange, onConcluido }: SincronizacaoCatalogoModalProps) {
  const [status, setStatus] = useState<StatusCatalogo | null>(null);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const emExecucao = useRef(false);

  const executar = useCallback(async () => {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setErroRede(null);
    try {
      for (let rodada = 0; rodada < RODADAS_MAXIMAS; rodada++) {
        const resposta = await fetch("/api/catalogo/sincronizacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forcar: rodada === 0 }),
        });
        const corpo = await resposta.json().catch(() => null);
        if (!resposta.ok) {
          setErroRede(corpo?.error ?? "Não foi possível sincronizar agora.");
          break;
        }
        setStatus(corpo);
        if (!corpo.emAndamento) {
          if (corpo.concluidoEm) onConcluido?.();
          break;
        }
      }
    } finally {
      emExecucao.current = false;
    }
  }, [onConcluido]);

  useEffect(() => {
    if (open) executar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const indiceAtual = status?.etapa ? ETAPAS.findIndex((e) => e.chave === status.etapa) : status?.concluidoEm ? ETAPAS.length : -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Trazendo seu catálogo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {ETAPAS.map((etapa, i) => {
            const progresso = status?.progresso[etapa.chave];
            const feita = indiceAtual > i || !!status?.concluidoEm;
            const emAndamento = status?.etapa === etapa.chave;
            const frase = progresso ? fraseEncontrados(etapa.chave, progresso, status!) : null;

            return (
              <div key={etapa.chave} className="flex items-start gap-3">
                {feita ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
                ) : emAndamento ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <div className="min-w-0">
                  <p className={feita || emAndamento ? "text-sm text-foreground" : "text-sm text-muted-foreground"}>
                    {etapa.rotulo}
                  </p>
                  {frase && <p className="text-xs text-muted-foreground">{frase}</p>}
                  {progresso?.ultimoErro && (
                    <p className="text-xs text-warning-text">{progresso.ultimoErro}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(erroRede || status?.erro) && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive-text" />
            <div className="min-w-0 text-sm">
              <p className="text-destructive-text">{erroRede ?? status?.erro}</p>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => executar()}>
                Tentar de novo
              </Button>
            </div>
          </div>
        )}

        {status?.concluidoEm && !status.emAndamento && (
          <p className="text-sm text-success-text">Catálogo sincronizado. Pode fechar e continuar usando.</p>
        )}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {status?.emAndamento ? "Fechar e continuar depois" : "Fechar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
