"use client";

import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, Equal, Repeat } from "lucide-react";
import type { PrioridadeTarefa } from "@prisma/client";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { ROTULOS_PRIORIDADE } from "@/modules/operacao/dominio/esquemas";
import type { SituacaoPrazo } from "@/modules/operacao/dominio/prazo";
import type { EtiquetaDto, PessoaResumo } from "@/modules/operacao/tipos";
import { CLASSES_COR } from "./cores";
import { classeSituacao, rotuloPrazo } from "./formato";

export function ChipEtiqueta({ etiqueta, className }: { etiqueta: EtiquetaDto; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium", CLASSES_COR[etiqueta.cor].chip, className)}>
      {etiqueta.nome}
    </span>
  );
}

const ICONE_PRIORIDADE: Record<PrioridadeTarefa, { icone: typeof ArrowUp; classe: string }> = {
  URGENTE: { icone: AlertTriangle, classe: "text-destructive-text" },
  ALTA: { icone: ArrowUp, classe: "text-warning-text" },
  MEDIA: { icone: Equal, classe: "text-muted-foreground" },
  BAIXA: { icone: ArrowDown, classe: "text-muted-foreground" },
};

export function IconePrioridade({ prioridade, mostrarMedia = false }: { prioridade: PrioridadeTarefa; mostrarMedia?: boolean }) {
  if (prioridade === "MEDIA" && !mostrarMedia) return null;
  const { icone: Icone, classe } = ICONE_PRIORIDADE[prioridade];
  return (
    <span className={cn("inline-flex items-center", classe)} title={`Prioridade ${ROTULOS_PRIORIDADE[prioridade].toLowerCase()}`}>
      <Icone className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">Prioridade {ROTULOS_PRIORIDADE[prioridade].toLowerCase()}</span>
    </span>
  );
}

export function SeloPrioridade({ prioridade }: { prioridade: PrioridadeTarefa }) {
  const { icone: Icone, classe } = ICONE_PRIORIDADE[prioridade];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", classe)}>
      <Icone className="h-3.5 w-3.5" aria-hidden="true" />
      {ROTULOS_PRIORIDADE[prioridade]}
    </span>
  );
}

export function PrazoTarefa({
  data,
  hora,
  situacao,
  recorrente,
  className,
}: {
  data: string | null;
  hora: string | null;
  situacao: SituacaoPrazo;
  recorrente?: boolean;
  className?: string;
}) {
  const texto = rotuloPrazo(data, hora, situacao);
  if (!texto && !recorrente) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", classeSituacao(situacao), className)}>
      {texto && <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {texto}
      {recorrente && <Repeat className="h-3 w-3 shrink-0" aria-label="Rotina que se repete" />}
    </span>
  );
}

export function AvatarPessoa({ pessoa, tamanho = 22, className }: { pessoa: PessoaResumo | null; tamanho?: number; className?: string }) {
  if (!pessoa) return null;
  return (
    <span title={pessoa.nome} className={cn("inline-flex", className)}>
      <UserAvatar name={pessoa.nome} image={pessoa.imagem} size={tamanho} className="text-[10px]" />
    </span>
  );
}
