"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ArmazemOption {
  id: string;
  nome: string;
}

interface InlineStockAdjustProps {
  produtoId: string;
  armazens: ArmazemOption[];
  currentTotal: number;
  onAdjusted: () => void;
}

export function InlineStockAdjust({
  produtoId,
  armazens,
  currentTotal,
  onAdjusted,
}: InlineStockAdjustProps) {
  const [editing, setEditing] = useState(false);
  const [armazemId, setArmazemId] = useState(armazens[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState(String(currentTotal));
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
        onClick={() => setEditing(true)}
        disabled={armazens.length === 0}
        title={
          armazens.length === 0
            ? "Crie um armazém antes de ajustar o estoque"
            : "Ajustar estoque"
        }
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    );
  }

  const handleConfirm = async () => {
    const valor = parseInt(quantidade, 10);
    if (Number.isNaN(valor) || valor < 0 || !armazemId) {
      toast.error("Informe um armazém e uma quantidade válida");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/estoque/ajustar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId, armazemId, quantidade: valor }),
      });

      if (!response.ok) throw new Error("Erro ao ajustar estoque");

      toast.success("Estoque ajustado");
      setEditing(false);
      onAdjusted();
    } catch {
      toast.error("Erro ao ajustar estoque");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <Select value={armazemId} onValueChange={setArmazemId}>
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue placeholder="Armazém" />
        </SelectTrigger>
        <SelectContent>
          {armazens.map((armazem) => (
            <SelectItem key={armazem.id} value={armazem.id}>
              {armazem.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        min={0}
        value={quantidade}
        onChange={(event) => setQuantidade(event.target.value)}
        className="h-7 w-16 text-xs"
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={handleConfirm}
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5 text-success" />
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => setEditing(false)}
        disabled={saving}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
