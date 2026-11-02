"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Smartphone } from "lucide-react";

const CHAVE_STORAGE = "skubo-convite-instalar-visto";
const LARGURA_MOBILE = 767;
const ROTA_GUIA_INSTALACAO = "/ajuda/celular";

function jaInstalado(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Convite discreto pra instalar o Skubo — só na primeira visita pelo celular, nunca se já estiver instalado. */
export function InstalarCelularBanner() {
  const pathname = usePathname();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (pathname === ROTA_GUIA_INSTALACAO) {
        setVisivel(false);
        return;
      }
      if (window.innerWidth > LARGURA_MOBILE) return;
      if (jaInstalado()) return;
      if (localStorage.getItem(CHAVE_STORAGE)) return;
      setVisivel(true);
    } catch {
      // modo privado / storage bloqueado: não mostra, não quebra a tela
    }
  }, [pathname]);

  const dispensar = () => {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE_STORAGE, "1");
    } catch {
      // ignora
    }
  };

  if (!visivel) return null;

  return (
    <div className="fixed inset-x-3 bottom-36 z-20 flex items-center gap-3 rounded-card border border-border bg-card p-3 shadow-lift md:hidden">
      <div className="rounded-full bg-primary/10 p-2 text-primary">
        <Smartphone className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Instale o Skubo no seu celular</p>
        <Link href="/ajuda/celular" className="text-xs text-primary hover:underline" onClick={dispensar}>
          Ver como →
        </Link>
      </div>
      <button type="button" onClick={dispensar} aria-label="Dispensar" className="shrink-0 p-1 text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
