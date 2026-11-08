"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, Loader2, PencilLine, Search } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ProductImage } from "@/components/ui/product-image";
import { StatusPill } from "@/components/ui/status-pill";
import { formatBRL } from "@/lib/format";

interface ResultadoBling {
  blingId: number;
  nome: string;
  sku: string;
  preco: number | null;
  precoCusto: number | null;
  ehKit: boolean;
  ativo: boolean;
  imagemUrl: string | null;
  jaCadastrado: { id: string; nome: string } | null;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onImportado: () => void;
  onCadastrarManual: () => void;
}

export function ImportarDoBlingDialog({ aberto, onFechar, onImportado, onCadastrarManual }: Props) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoBling[]>([]);
  const [localPorEan, setLocalPorEan] = useState<{ id: string; nome: string; sku: string } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [importando, setImportando] = useState(false);
  const requisicao = useRef(0);

  useEffect(() => {
    if (!aberto) {
      setTermo("");
      setResultados([]);
      setSelecionados(new Set());
      setLocalPorEan(null);
      setErro(null);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto || termo.trim().length < 2) {
      setResultados([]);
      setLocalPorEan(null);
      return;
    }
    const id = ++requisicao.current;
    const timer = setTimeout(async () => {
      setBuscando(true);
      setErro(null);
      try {
        const res = await fetch(`/api/bling/produtos/buscar?q=${encodeURIComponent(termo.trim())}`);
        const body = await res.json();
        if (id !== requisicao.current) return;
        if (!res.ok) throw new Error(body.error ?? "Erro ao buscar no Bling");
        setResultados(body.itens);
        setLocalPorEan(body.localPorEan);
      } catch (e) {
        if (id === requisicao.current) {
          setResultados([]);
          setErro(e instanceof Error ? e.message : "Erro ao buscar no Bling");
        }
      } finally {
        if (id === requisicao.current) setBuscando(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [termo, aberto]);

  const alternar = (blingId: number) =>
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(blingId)) proximo.delete(blingId);
      else proximo.add(blingId);
      return proximo;
    });

  const importar = async () => {
    if (selecionados.size === 0) return;
    setImportando(true);
    try {
      const res = await fetch("/api/bling/produtos/importar-um", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blingIds: [...selecionados] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro ao importar");
      const resultados: Array<{ criado?: boolean; erro?: string }> = body.resultados;
      const criados = resultados.filter((r) => r.criado).length;
      const atualizados = resultados.filter((r) => r.criado === false).length;
      const erros = resultados.filter((r) => r.erro);
      if (criados + atualizados > 0) {
        toast.success(
          [criados && `${criados} cadastrado(s)`, atualizados && `${atualizados} atualizado(s)`].filter(Boolean).join(" · ")
        );
      }
      erros.forEach((r) => toast.error(r.erro));
      onImportado();
      if (erros.length === 0) onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar do Bling");
    } finally {
      setImportando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar a partir do Bling</DialogTitle>
          <DialogDescription>
            Busque pelo SKU, nome ou EAN. O produto chega com custo, EAN, fornecedor, foto, composição e estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Ex.: ADP-USBC, adaptador usb-c, 7891234567890"
            className="h-9 pl-8"
          />
          {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {localPorEan && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            Esse EAN já está cadastrado aqui:{" "}
            <Link href={`/produtos/${localPorEan.id}`} className="font-medium text-primary hover:underline" onClick={onFechar}>
              {localPorEan.nome} ({localPorEan.sku})
            </Link>
          </div>
        )}

        {erro && <p className="text-sm text-destructive-text">{erro}</p>}

        <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
          {resultados.length === 0 && !buscando && termo.trim().length >= 2 && !erro && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nada encontrado no Bling. O filtro da API do Bling não busca por EAN — tente o SKU ou parte do nome.
            </p>
          )}
          {resultados.map((r) => {
            const marcado = selecionados.has(r.blingId);
            return (
              <label
                key={r.blingId}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                  marcado ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-muted"
                }`}
              >
                <Checkbox checked={marcado} onCheckedChange={() => alternar(r.blingId)} />
                <ProductImage src={r.imagemUrl} alt={r.nome} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.sku || "sem SKU"}
                    {r.precoCusto != null && ` · custo ${formatBRL(r.precoCusto)}`}
                    {r.preco != null && ` · venda ${formatBRL(r.preco)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {r.ehKit && <StatusPill tone="neutral">Kit</StatusPill>}
                  {r.jaCadastrado ? (
                    <StatusPill tone="success">
                      <Check className="mr-1 inline h-3 w-3" />
                      Já cadastrado
                    </StatusPill>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" className="gap-2" onClick={onCadastrarManual}>
            <PencilLine className="h-4 w-4" />
            Não está no Bling? Cadastrar à mão
          </Button>
          <Button onClick={importar} disabled={selecionados.size === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {selecionados.size > 1 ? `Importar ${selecionados.size}` : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
