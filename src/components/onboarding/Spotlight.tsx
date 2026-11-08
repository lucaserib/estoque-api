"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PASSOS_SPOTLIGHT } from "@/modules/onboarding/tourSpotlight";

interface SpotlightProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MARGEM = 8;

export function Spotlight({ open, onOpenChange }: SpotlightProps) {
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  const passo = PASSOS_SPOTLIGHT[indice];

  useEffect(() => {
    if (!open) return;
    setIndice(0);
  }, [open]);

  useEffect(() => {
    if (!open || !passo) return;

    const alvo = document.querySelector<HTMLElement>(`[data-tour="${passo.seletor}"]`);
    if (!alvo) {
      if (indice < PASSOS_SPOTLIGHT.length - 1) setIndice((i) => i + 1);
      else onOpenChange(false);
      return;
    }

    alvo.scrollIntoView({ block: "center", behavior: "smooth" });

    const atualizar = () => setRect(alvo.getBoundingClientRect());
    const timeout = setTimeout(atualizar, 300);
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, indice]);

  if (!montado || !open || !rect || !passo) return null;

  const espacoAbaixo = window.innerHeight - rect.bottom;
  const balaoEmbaixo = espacoAbaixo > 180;
  const ultimo = indice === PASSOS_SPOTLIGHT.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-x-0 top-0 bg-black/60" style={{ height: Math.max(0, rect.top - MARGEM) }} />
      <div
        className="absolute inset-x-0 bottom-0 bg-black/60"
        style={{ top: rect.bottom + MARGEM }}
      />
      <div
        className="absolute bg-black/60"
        style={{ top: rect.top - MARGEM, height: rect.height + MARGEM * 2, left: 0, width: Math.max(0, rect.left - MARGEM) }}
      />
      <div
        className="absolute bg-black/60"
        style={{ top: rect.top - MARGEM, height: rect.height + MARGEM * 2, left: rect.right + MARGEM, right: 0 }}
      />
      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-primary"
        style={{
          top: rect.top - MARGEM,
          left: rect.left - MARGEM,
          width: rect.width + MARGEM * 2,
          height: rect.height + MARGEM * 2,
        }}
      />

      <div
        className="absolute w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-card p-4 shadow-lift"
        style={{
          top: balaoEmbaixo ? rect.bottom + MARGEM * 2 : undefined,
          bottom: balaoEmbaixo ? undefined : window.innerHeight - rect.top + MARGEM * 2,
          left: Math.min(Math.max(rect.left, 16), window.innerWidth - 288 - 16),
        }}
      >
        <p className="font-display text-sm font-semibold text-foreground">{passo.titulo}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{passo.texto}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-faint">
            {indice + 1}/{PASSOS_SPOTLIGHT.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Pular
            </Button>
            <Button
              size="sm"
              onClick={() => (ultimo ? onOpenChange(false) : setIndice((i) => i + 1))}
            >
              {ultimo ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
