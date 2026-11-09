"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DetalheAbrirAssistente, EVENTO_ABRIR_ASSISTENTE, EVENTO_ABRIR_VENDA_IA } from "./eventos";
import { PainelAssistente, type PerguntaInicial } from "./PainelAssistente";
import { useAcessoIa } from "./useAcessoIa";

const PAGINAS_COM_FAB = new Set(["/produtos", "/gestao-pedidos"]);

export function AssistenteIa() {
  const pathname = usePathname();
  const { visivel } = useAcessoIa();
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState<PerguntaInicial | null>(null);

  useEffect(() => {
    const abrir = (evento: Event) => {
      const detalhe = (evento as CustomEvent<DetalheAbrirAssistente>).detail ?? {};
      if (detalhe.pergunta) setPergunta({ texto: detalhe.pergunta, enviar: detalhe.enviar, chave: Date.now() });
      setAberto(true);
    };
    const abrirVenda = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_ASSISTENTE, abrir);
    window.addEventListener(EVENTO_ABRIR_VENDA_IA, abrirVenda);
    return () => {
      window.removeEventListener(EVENTO_ABRIR_ASSISTENTE, abrir);
      window.removeEventListener(EVENTO_ABRIR_VENDA_IA, abrirVenda);
    };
  }, []);

  useEffect(() => {
    if (!visivel) return;
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, [visivel]);

  if (!visivel || pathname === "/ia") return null;

  const comFabDaPagina = PAGINAS_COM_FAB.has(pathname) || pathname === "/operacao" || pathname.startsWith("/operacao/");

  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={setAberto}>
      {!aberto && (
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Abrir Skubo IA (Ctrl+J)"
            title="Skubo IA (Ctrl+J)"
            className={cn(
              "fixed z-30 flex h-12 w-12 items-center justify-center rounded-full bg-hero text-white shadow-lift transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6 md:h-14 md:w-14",
              comFabDaPagina ? "bottom-[5.25rem] right-[5.5rem]" : "bottom-[5.25rem] right-4"
            )}
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:bg-black/20" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col border-l border-border bg-background shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right md:inset-y-0 md:left-auto md:right-0 md:w-[440px]"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <DialogPrimitive.Title className="sr-only">Skubo IA</DialogPrimitive.Title>
          <PainelAssistente
            modo="lateral"
            perguntaInicial={pergunta}
            aoFechar={() => setAberto(false)}
            aoNavegar={() => {
              if (window.matchMedia("(max-width: 767px)").matches) setAberto(false);
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
