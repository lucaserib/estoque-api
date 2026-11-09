"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ItemChecklistDto } from "@/modules/operacao/tipos";
import { chamarOperacao } from "./api";

export function ChecklistTarefa({
  tarefaId,
  itens,
  podeEditar,
  aoMudar,
}: {
  tarefaId: string;
  itens: ItemChecklistDto[];
  podeEditar: boolean;
  aoMudar: (itens: ItemChecklistDto[]) => void;
}) {
  const [novo, setNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const feitos = itens.filter((i) => i.concluido).length;

  const adicionar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const texto = novo.trim();
    if (!texto) return;
    setSalvando(true);
    try {
      const { item } = await chamarOperacao<{ item: ItemChecklistDto }>(`/tarefas/${tarefaId}/checklist`, { corpo: { texto } });
      aoMudar([...itens, item]);
      setNovo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar.");
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (item: ItemChecklistDto) => {
    const anteriores = itens;
    aoMudar(itens.map((i) => (i.id === item.id ? { ...i, concluido: !i.concluido } : i)));
    try {
      const { item: atualizado } = await chamarOperacao<{ item: ItemChecklistDto }>(`/checklist/${item.id}`, {
        metodo: "PATCH",
        corpo: { concluido: !item.concluido },
      });
      aoMudar(anteriores.map((i) => (i.id === item.id ? atualizado : i)));
    } catch (e) {
      aoMudar(anteriores);
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar.");
    }
  };

  const apagar = async (item: ItemChecklistDto) => {
    const anteriores = itens;
    aoMudar(itens.filter((i) => i.id !== item.id));
    try {
      await chamarOperacao(`/checklist/${item.id}`, { metodo: "DELETE" });
    } catch (e) {
      aoMudar(anteriores);
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar.");
    }
  };

  return (
    <div className="space-y-2" data-testid="checklist-tarefa">
      {itens.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(feitos / itens.length) * 100}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {feitos}/{itens.length}
          </span>
        </div>
      )}
      <ul className="space-y-0.5">
        {itens.map((item) => (
          <li key={item.id} className="group flex items-center gap-1 rounded-lg hover:bg-muted/60">
            <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2.5 px-1.5 py-1">
              <input
                type="checkbox"
                checked={item.concluido}
                onChange={() => alternar(item)}
                disabled={!podeEditar}
                className="h-[18px] w-[18px] shrink-0 accent-[hsl(var(--success))]"
              />
              <span className={cn("text-sm", item.concluido && "text-muted-foreground line-through")}>{item.texto}</span>
            </label>
            {podeEditar && (
              <button
                type="button"
                onClick={() => apagar(item)}
                aria-label={`Apagar ${item.texto}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive-text sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {podeEditar && (
        <form onSubmit={adicionar} className="flex items-center gap-2">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Adicionar item"
            aria-label="Novo item do checklist"
            maxLength={300}
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <button
            type="submit"
            disabled={!novo.trim() || salvando}
            aria-label="Adicionar item"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-fg2 hover:bg-muted disabled:opacity-50"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </form>
      )}
    </div>
  );
}
