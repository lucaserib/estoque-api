"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Link2, Loader2, Minus, Plus, Search, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/ui/product-image";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sugerirUnidadesPeloTitulo } from "@/modules/catalogo/unidadesAnuncio";

export interface AnuncioParaVincular {
  /** id da linha ProdutoMercadoLivre (preferível) */
  id?: string;
  accountId?: string;
  mlItemId: string;
  mlTitle: string;
  mlPrice?: number | null;
  mlThumbnail?: string | null;
  mlSellerSku?: string | null;
}

export interface VinculoAtual {
  produtoBaseId: string;
  produtoBaseNome: string;
  produtoBaseSku: string;
  unidadesPorVenda: number;
}

interface ProdutoOpcao {
  id: string;
  nome: string;
  sku: string;
  isKit: boolean;
  imagemUrl: string | null;
  estoqueLocal: number;
  componentes: Array<{ produtoId: string; nome: string; quantidade: number }>;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  anuncio: AnuncioParaVincular | null;
  vinculoAtual?: VinculoAtual | null;
  onSalvo?: () => void;
}

export function VincularAnuncioDialog({ aberto, onFechar, anuncio, vinculoAtual, onSalvo }: Props) {
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<ProdutoOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState<ProdutoOpcao | null>(null);
  const [unidades, setUnidades] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const requisicaoAtual = useRef(0);

  const unidadesSugeridas = useMemo(
    () => (anuncio ? sugerirUnidadesPeloTitulo(anuncio.mlTitle) : null),
    [anuncio]
  );

  // Ao abrir: parte do vínculo atual, senão do SKU do anúncio.
  useEffect(() => {
    if (!aberto || !anuncio) return;
    setEscolhido(null);
    setUnidades(vinculoAtual?.unidadesPorVenda ?? unidadesSugeridas ?? 1);
    setBusca(vinculoAtual?.produtoBaseSku ?? anuncio.mlSellerSku ?? "");
  }, [aberto, anuncio, vinculoAtual, unidadesSugeridas]);

  useEffect(() => {
    if (!aberto) return;
    const id = ++requisicaoAtual.current;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams({ tipo: "todos", status: "todos", porPagina: "8" });
        if (busca.trim()) params.set("q", busca.trim());
        const res = await fetch(`/api/produtos/lista?${params}`);
        if (!res.ok) throw new Error();
        const body: { itens: ProdutoOpcao[] } = await res.json();
        if (id !== requisicaoAtual.current) return;
        setOpcoes(body.itens);
        // SKU idêntico ao do anúncio/vínculo: já deixa escolhido.
        setEscolhido((atual) => {
          if (atual) return atual;
          const alvo = (vinculoAtual?.produtoBaseSku ?? anuncio?.mlSellerSku ?? "").trim().toUpperCase();
          return alvo ? body.itens.find((p) => p.sku.toUpperCase() === alvo) ?? null : null;
        });
      } catch {
        if (id === requisicaoAtual.current) setOpcoes([]);
      } finally {
        if (id === requisicaoAtual.current) setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, aberto, anuncio, vinculoAtual]);

  const kitMisto = escolhido?.isKit && escolhido.componentes.length > 1;
  const kitDeUmComponente = escolhido?.isKit && escolhido.componentes.length === 1;
  const unidadesEfetivas = kitMisto || kitDeUmComponente ? 1 : unidades;

  const salvar = async (desvincular = false) => {
    if (!anuncio) return;
    if (!desvincular && !escolhido) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/catalogo/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anuncioId: anuncio.id,
          accountId: anuncio.id ? undefined : anuncio.accountId,
          mlItemId: anuncio.id ? undefined : anuncio.mlItemId,
          produtoId: desvincular ? null : escolhido?.id,
          unidadesPorVenda: desvincular ? 1 : unidadesEfetivas,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erro ao salvar o vínculo");

      if (desvincular) {
        toast.success("Anúncio desvinculado");
      } else {
        const partes = [
          unidadesEfetivas > 1
            ? `Cada venda agora consome ${unidadesEfetivas}× ${escolhido?.nome}`
            : `Vinculado a ${escolhido?.nome}`,
        ];
        if (body.kitCriado) partes.push("kit criado automaticamente");
        if (body.vendasRecalculadas > 0) partes.push(`${body.vendasRecalculadas} venda(s) recalculada(s)`);
        toast.success(partes.join(" · "));
      }
      onSalvo?.();
      onFechar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Erro ao salvar o vínculo");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular anúncio ao estoque</DialogTitle>
          <DialogDescription>
            Diga qual produto sai do estoque quando este anúncio vende — e quantas unidades.
          </DialogDescription>
        </DialogHeader>

        {anuncio && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <ProductImage src={anuncio.mlThumbnail} alt={anuncio.mlTitle} size={48} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{anuncio.mlTitle}</p>
              <p className="text-xs text-muted-foreground">
                {anuncio.mlItemId}
                {anuncio.mlSellerSku ? ` · SKU ${anuncio.mlSellerSku}` : ""}
                {anuncio.mlPrice != null ? ` · ${formatBRL(anuncio.mlPrice)}` : ""}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">1. Produto que sai do estoque</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setEscolhido(null);
              }}
              placeholder="Buscar por nome, SKU ou EAN"
              className="h-9 pl-8"
            />
            {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
            {opcoes.length === 0 && !buscando ? (
              <p className="p-3 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado. Cadastre o produto (pode puxar do Bling) e volte aqui.
              </p>
            ) : (
              opcoes.map((p) => {
                const ativo = escolhido?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEscolhido(p)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                      ativo ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted"
                    )}
                  >
                    <ProductImage src={p.imagemUrl} alt={p.nome} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.sku}
                        {p.isKit
                          ? ` · kit: ${p.componentes.map((c) => `${c.quantidade}× ${c.nome}`).join(" + ")}`
                          : ` · ${p.estoqueLocal} em estoque`}
                      </p>
                    </div>
                    {ativo && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">2. Unidades por venda</p>
          {kitMisto || kitDeUmComponente ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              O produto escolhido já é um kit — a composição dele define o que sai do estoque.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setUnidades((u) => Math.max(1, u - 1))}
                    aria-label="Menos uma unidade"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={unidades}
                    onChange={(e) => setUnidades(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                    className="h-9 w-16 border-0 text-center"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setUnidades((u) => Math.min(100, u + 1))}
                    aria-label="Mais uma unidade"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  {unidades === 1 ? "unidade por venda" : `unidades por venda (kit de ${unidades})`}
                </span>
              </div>
              {unidadesSugeridas && unidadesSugeridas !== unidades && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline underline-offset-2"
                  onClick={() => setUnidades(unidadesSugeridas)}
                >
                  O título parece ser de um kit com {unidadesSugeridas} — usar {unidadesSugeridas}
                </button>
              )}
              {unidades > 1 && escolhido && (
                <p className="text-xs text-muted-foreground">
                  O app usa o kit &quot;Kit {unidades}x {escolhido.nome}&quot; (cria se não existir). Cada venda conta{" "}
                  {unidades} unidades na reposição, no custo e no Financeiro, e o estoque enviado ao anúncio é dividido
                  por {unidades}.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {vinculoAtual ? (
            <Button variant="ghost" className="gap-2 text-destructive" disabled={salvando} onClick={() => salvar(true)}>
              <Unlink className="h-4 w-4" />
              Desvincular
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={() => salvar(false)} disabled={!escolhido || salvando} className="gap-2">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Salvar vínculo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
