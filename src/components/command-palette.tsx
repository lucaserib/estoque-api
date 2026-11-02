"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  FileBarChart,
  Link2,
  Package,
  Plus,
  ShoppingCart,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ResultadoBusca {
  tipo: "produto" | "pedido" | "anuncio";
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}

const ROTULO_TIPO: Record<ResultadoBusca["tipo"], string> = {
  produto: "Produtos",
  pedido: "Pedidos de compra",
  anuncio: "Anúncios",
};

const ACOES = [
  { label: "Nova compra", icon: ShoppingCart, href: "/gestao-pedidos?nova=1" },
  { label: "Vincular anúncios", icon: Link2, href: "/mercado-livre/produtos" },
  { label: "Ir para DRE", icon: FileBarChart, href: "/financeiro/dre" },
  { label: "Transferir estoque", icon: ArrowLeftRight, href: "/estoque/transferencias" },
  { label: "Novo produto", icon: Plus, href: "/produtos?novo=1" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const [resultados, setResultados] = React.useState<ResultadoBusca[]>([]);
  const [carregando, setCarregando] = React.useState(false);

  React.useEffect(() => {
    const ouvirAtalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", ouvirAtalho);
    return () => document.removeEventListener("keydown", ouvirAtalho);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setBusca("");
      setResultados([]);
      return;
    }
  }, [open]);

  React.useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultados([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`);
        const dados = await res.json();
        setResultados(res.ok ? dados.resultados : []);
      } catch {
        setResultados([]);
      } finally {
        setCarregando(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [busca]);

  const irPara = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const grupos = React.useMemo(() => {
    const porTipo = new Map<ResultadoBusca["tipo"], ResultadoBusca[]>();
    for (const item of resultados) {
      const lista = porTipo.get(item.tipo) ?? [];
      lista.push(item);
      porTipo.set(item.tipo, lista);
    }
    return porTipo;
  }, [resultados]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-full border border-border bg-accent px-3.5 py-2 text-left sm:flex"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[15px] w-[15px] shrink-0 text-faint"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-[13px] text-faint">
          Buscar SKU, produto, pedido ou anúncio
        </span>
        <span className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-faint sm:inline-block">
          ⌘K
        </span>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar produto, SKU, pedido, anúncio ou uma ação..."
          value={busca}
          onValueChange={setBusca}
        />
        <CommandList>
          {busca.trim().length >= 2 && !carregando && resultados.length === 0 && (
            <CommandEmpty>Nada encontrado para &quot;{busca}&quot;.</CommandEmpty>
          )}

          {(["produto", "anuncio", "pedido"] as const).map((tipo) => {
            const itens = grupos.get(tipo);
            if (!itens || itens.length === 0) return null;
            return (
              <CommandGroup key={tipo} heading={ROTULO_TIPO[tipo]}>
                {itens.map((item) => (
                  <CommandItem key={`${item.tipo}-${item.id}`} onSelect={() => irPara(item.href)}>
                    <Package className="h-4 w-4" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{item.titulo}</span>
                      <span className="truncate text-xs text-muted-foreground">{item.subtitulo}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          <CommandGroup heading="Ações">
            {ACOES.map((acao) => (
              <CommandItem key={acao.href} onSelect={() => irPara(acao.href)}>
                <acao.icon className="h-4 w-4" />
                <span>{acao.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
