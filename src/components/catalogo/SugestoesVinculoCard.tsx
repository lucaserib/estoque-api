"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";

interface SugestaoVinculo {
  anuncioId: string;
  mlItemId: string;
  mlTitle: string;
  mlSellerSku: string | null;
  produtoId: string;
  produtoNome: string;
  produtoSku: string;
  confianca: "alta" | "media" | "baixa";
  motivo: string;
  unidadesSugeridas: number;
}

const TOM_CONFIANCA: Record<SugestaoVinculo["confianca"], "success" | "warning"> = {
  alta: "success",
  media: "warning",
  baixa: "warning",
};

interface Props {
  recarregarGatilho?: unknown;
  onAplicado?: () => void;
}

export function SugestoesVinculoCard({ recarregarGatilho, onAplicado }: Props) {
  const [sugestoes, setSugestoes] = useState<SugestaoVinculo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/catalogo/vinculos/sugestoes");
      if (!res.ok) throw new Error();
      const body: { sugestoes: SugestaoVinculo[] } = await res.json();
      setSugestoes(body.sugestoes);
      setSelecionados(new Set(body.sugestoes.filter((s) => s.confianca === "alta").map((s) => s.anuncioId)));
    } catch {
      setSugestoes(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega quando o gatilho do pai muda
  }, [recarregarGatilho]);

  const aplicar = async () => {
    if (!sugestoes || selecionados.size === 0) return;
    setAplicando(true);
    try {
      const itens = sugestoes
        .filter((s) => selecionados.has(s.anuncioId))
        .map((s) => ({ anuncioId: s.anuncioId, produtoId: s.produtoId, unidadesPorVenda: s.unidadesSugeridas }));

      const res = await fetch("/api/catalogo/vinculos/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erro ao aplicar sugestões");

      toast.success(
        body.falhas > 0
          ? `${body.sucessos} vínculo(s) aplicado(s), ${body.falhas} falharam`
          : `${body.sucessos} vínculo(s) aplicado(s)`
      );
      onAplicado?.();
      carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Erro ao aplicar sugestões");
    } finally {
      setAplicando(false);
    }
  };

  if (!carregando && (!sugestoes || sugestoes.length === 0)) return null;

  return (
    <SectionCard
      title="Sugestões de vínculo"
      description="SKU do anúncio igual ao do produto vem marcado — confira o resto antes de aplicar."
      actions={
        sugestoes && sugestoes.length > 0 ? (
          <Button size="sm" className="gap-2" disabled={selecionados.size === 0 || aplicando} onClick={aplicar}>
            {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
            Aplicar selecionadas ({selecionados.size})
          </Button>
        ) : undefined
      }
    >
      {carregando ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando sugestões…
        </div>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {sugestoes?.map((s) => (
            <label
              key={s.anuncioId}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
            >
              <Checkbox
                checked={selecionados.has(s.anuncioId)}
                onCheckedChange={(v) =>
                  setSelecionados((atual) => {
                    const novo = new Set(atual);
                    if (v) novo.add(s.anuncioId);
                    else novo.delete(s.anuncioId);
                    return novo;
                  })
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.mlTitle}</p>
                <p className="text-xs text-muted-foreground">
                  → {s.produtoNome} ({s.produtoSku})
                  {s.unidadesSugeridas > 1 ? ` · kit de ${s.unidadesSugeridas}` : ""} · {s.motivo}
                </p>
              </div>
              <StatusPill tone={TOM_CONFIANCA[s.confianca]}>{s.confianca}</StatusPill>
            </label>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
