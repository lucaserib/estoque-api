"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Loader2, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatNumberBR, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Modo = "produtos" | "frete" | "nota";

interface Valores {
  pedidos: number;
  produtos: number;
  freteComprador: number;
  freteVendedor: number;
  comFrete: number;
  notasQuantidade: number;
  notasValor: number;
  notasFrete: number;
  pedidosComNota: number;
}

interface Resposta {
  totais: Valores;
  dias: Array<Valores & { dia: string }>;
  coberturaNotas: number | null;
  temNotas: boolean;
}

const CHAVE_MODO = "skubo-visao-faturamento";

const MODOS: Array<{ valor: Modo; rotulo: string; explicacao: string }> = [
  { valor: "produtos", rotulo: "Só produtos", explicacao: "Preço × quantidade, igual ao painel do Mercado Livre." },
  {
    valor: "frete",
    rotulo: "Com frete",
    explicacao: "Produtos + frete do envio (pago por você e pelo comprador), como o Bling registra o pedido.",
  },
  { valor: "nota", rotulo: "Em nota fiscal", explicacao: "Soma das notas fiscais de saída autorizadas no Bling, pela data de emissão." },
];

function valorDoModo(v: Valores, modo: Modo): number {
  if (modo === "produtos") return v.produtos;
  if (modo === "frete") return v.comFrete;
  return v.notasValor;
}

function rotuloDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

interface Props {
  periodo?: string;
  desde?: Date;
  ate?: Date;
  rotuloPeriodo?: string;
  className?: string;
}

export function FaturamentoComFreteCard({ periodo = "mes-atual", desde, ate, rotuloPeriodo, className }: Props) {
  const consulta = useMemo(
    () =>
      desde && ate
        ? `desde=${encodeURIComponent(desde.toISOString())}&ate=${encodeURIComponent(ate.toISOString())}`
        : `periodo=${encodeURIComponent(periodo)}`,
    [desde, ate, periodo]
  );
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [modo, setModo] = useState<Modo>("frete");
  const [verDias, setVerDias] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_MODO);
      if (salvo === "produtos" || salvo === "frete" || salvo === "nota") setModo(salvo);
    } catch {}
  }, []);

  const escolherModo = (novo: Modo) => {
    setModo(novo);
    try {
      localStorage.setItem(CHAVE_MODO, novo);
    } catch {}
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/financeiro/faturamento-com-frete?${consulta}`);
      if (resposta.ok) setDados(await resposta.json());
    } finally {
      setCarregando(false);
    }
  }, [consulta]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const trazerNotas = async () => {
    setSincronizando(true);
    try {
      const resposta = await fetch("/api/financeiro/notas-fiscais/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(desde && ate ? { desde: desde.toISOString(), ate: ate.toISOString() } : { periodo }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(corpo?.error ?? "Não foi possível trazer as notas do Bling agora.");
        return;
      }
      toast.success(
        corpo.gravadas > 0
          ? `${corpo.gravadas} nota(s) atualizada(s)${corpo.completo ? "" : " — clique de novo para continuar"}.`
          : "Notas fiscais já estão em dia."
      );
      await carregar();
    } finally {
      setSincronizando(false);
    }
  };

  const hoje = dados?.dias[dados.dias.length - 1];
  const diasComMovimento = useMemo(
    () => (dados?.dias ?? []).filter((d) => d.pedidos > 0 || d.notasQuantidade > 0).slice().reverse(),
    [dados]
  );
  const modoAtual = MODOS.find((m) => m.valor === modo) ?? MODOS[1];

  return (
    <section
      className={cn("overflow-hidden rounded-card border border-border/80 bg-card shadow-card", className)}
      aria-labelledby="faturamento-com-frete-titulo"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-divider px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Truck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 id="faturamento-com-frete-titulo" className="text-[15px] font-semibold text-foreground">
              Quanto foi faturado de verdade
            </h2>
            <p className="text-xs text-muted-foreground">{modoAtual.explicacao}</p>
          </div>
        </div>
        <div role="tablist" aria-label="Como somar o faturamento" className="flex rounded-xl bg-muted p-1">
          {MODOS.map((m) => (
            <button
              key={m.valor}
              role="tab"
              type="button"
              aria-selected={modo === m.valor}
              onClick={() => escolherModo(m.valor)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                modo === m.valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando && !dados ? (
        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !dados ? (
        <p className="p-6 text-sm text-muted-foreground">Não foi possível carregar o faturamento agora.</p>
      ) : (
        <>
          <div className="grid gap-4 p-5 sm:grid-cols-[1.2fr_1fr_1fr] sm:p-6">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
              <p className="text-xs font-medium text-muted-foreground">{rotuloPeriodo ?? "Período"}</p>
              <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-foreground">
                {formatBRL(valorDoModo(dados.totais, modo))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {modo === "nota"
                  ? `${formatNumberBR(dados.totais.notasQuantidade)} nota(s) emitida(s)`
                  : `${formatNumberBR(dados.totais.pedidos)} pedido(s)`}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">Hoje</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {formatBRL(hoje ? valorDoModo(hoje, modo) : 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hoje && modo !== "produtos"
                  ? `${formatBRL(hoje.produtos)} em produtos + ${formatBRL(hoje.freteComprador + hoje.freteVendedor)} de frete`
                  : `${formatNumberBR(hoje?.pedidos ?? 0)} pedido(s)`}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">Frete no período</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {formatBRL(dados.totais.freteComprador + dados.totais.freteVendedor)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBRL(dados.totais.freteVendedor)} pago por você · {formatBRL(dados.totais.freteComprador)} pelo comprador
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {dados.temNotas ? (
                <span>
                  Notas fiscais: {formatBRL(dados.totais.notasValor)}
                  {dados.coberturaNotas !== null && ` · ${formatPercent(dados.coberturaNotas * 100, 0)} dos pedidos com nota`}
                </span>
              ) : (
                <span>Nenhuma nota fiscal do Bling no período ainda.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setVerDias((v) => !v)} className="gap-1.5">
                Ver por dia
                <ChevronDown className={cn("h-4 w-4 transition-transform", verDias && "rotate-180")} />
              </Button>
              <Button variant="outline" size="sm" onClick={trazerNotas} disabled={sincronizando} className="gap-1.5">
                {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Trazer notas do Bling
              </Button>
            </div>
          </div>

          {verDias && (
            <div className="max-h-[360px] overflow-auto border-t border-divider">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Dia</th>
                    <th className="px-3 py-2 text-right font-medium">Pedidos</th>
                    <th className="px-3 py-2 text-right font-medium">Produtos</th>
                    <th className="px-3 py-2 text-right font-medium">Frete</th>
                    <th className="px-3 py-2 text-right font-medium">Com frete</th>
                    <th className="px-5 py-2 text-right font-medium">Em nota</th>
                  </tr>
                </thead>
                <tbody>
                  {diasComMovimento.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">
                        Sem vendas no período.
                      </td>
                    </tr>
                  ) : (
                    diasComMovimento.map((d) => (
                      <tr key={d.dia} className="border-t border-divider tabular-nums">
                        <td className="px-5 py-2 capitalize text-foreground">{rotuloDia(d.dia)}</td>
                        <td className="px-3 py-2 text-right">{formatNumberBR(d.pedidos)}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(d.produtos)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {formatBRL(d.freteComprador + d.freteVendedor)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{formatBRL(d.comFrete)}</td>
                        <td className="px-5 py-2 text-right">
                          {d.notasQuantidade > 0 ? formatBRL(d.notasValor) : <span className="text-faint">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
