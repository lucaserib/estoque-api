"use client";

import { useMemo, useState } from "react";
import { CornerDownLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { interpretarCaptura } from "@/modules/operacao/dominio/capturaRapida";
import type { CartaoTarefa } from "@/modules/operacao/tipos";
import { chamarOperacao } from "./api";
import { avisarTarefasMudaram } from "./eventos";
import { rotuloPrazo } from "./formato";
import { useOperacao } from "./OperacaoContexto";
import { ChipEtiqueta, SeloPrioridade } from "./Pecas";

interface CapturaRapidaProps {
  quadroId?: string;
  colunaId?: string;
  aoCriar?: (tarefa: CartaoTarefa) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compacta?: boolean;
  className?: string;
  responsavelPadrao?: string | null;
}

export function CapturaRapida({
  quadroId,
  colunaId,
  aoCriar,
  placeholder = "Anote uma tarefa… ex.: Cobrar fornecedor amanhã @ana #compras !alta",
  autoFocus,
  compacta,
  className,
  responsavelPadrao,
}: CapturaRapidaProps) {
  const { inicio, membro, etiqueta } = useOperacao();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const leitura = useMemo(
    () =>
      interpretarCaptura(texto, {
        pessoas: (inicio?.membros ?? []).filter((m) => m.podeEditar).map((m) => ({ id: m.id, nome: m.nome, email: m.email })),
        etiquetas: inicio?.etiquetas ?? [],
      }),
    [texto, inicio]
  );

  if (!inicio?.usuario.podeEditar) return null;

  const temExtras = Boolean(leitura.responsavelId || leitura.etiquetaIds.length || leitura.prioridade || leitura.prazo);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!leitura.titulo || salvando) return;
    setSalvando(true);
    try {
      const { tarefa } = await chamarOperacao<{ tarefa: CartaoTarefa }>("/tarefas", {
        corpo: {
          titulo: leitura.titulo,
          quadroId,
          colunaId,
          origem: "CAPTURA_RAPIDA",
          responsavelId: leitura.responsavelId ?? responsavelPadrao ?? undefined,
          etiquetaIds: leitura.etiquetaIds,
          prioridade: leitura.prioridade ?? undefined,
          prazo: leitura.prazo ?? undefined,
        },
      });
      setTexto("");
      toast.success(`Tarefa #${tarefa.numero} criada`);
      aoCriar?.(tarefa);
      avisarTarefasMudaram();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    } finally {
      setSalvando(false);
    }
  };

  const pessoa = membro(leitura.responsavelId);
  const prazo = leitura.prazo ? rotuloPrazo(leitura.prazo.data, leitura.prazo.hora, "futura") : null;

  return (
    <form onSubmit={enviar} className={cn("space-y-1.5", className)} data-testid="captura-rapida">
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-xl border border-input bg-card pl-3 pr-1.5 shadow-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          compacta ? "h-10" : "h-12"
        )}
      >
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          aria-label="Nova tarefa"
          autoFocus={autoFocus}
          maxLength={300}
          enterKeyHint="done"
          className="h-full min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          disabled={!leitura.titulo || salvando}
          aria-label="Criar tarefa"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground",
            compacta ? "h-8 w-8" : "h-9 w-9"
          )}
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
        </button>
      </div>
      {texto && (temExtras || leitura.avisos.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs" aria-live="polite">
          {pessoa && <span className="rounded-full bg-muted px-2 py-0.5 text-fg2">@{pessoa.nome}</span>}
          {leitura.etiquetaIds.map((id) => {
            const encontrada = etiqueta(id);
            return encontrada ? <ChipEtiqueta key={id} etiqueta={encontrada} /> : null;
          })}
          {leitura.prioridade && <SeloPrioridade prioridade={leitura.prioridade} />}
          {prazo && <span className="rounded-full bg-muted px-2 py-0.5 text-fg2">{prazo}</span>}
          {leitura.avisos.map((aviso) => (
            <span key={aviso} className="text-warning-text">
              {aviso}
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
