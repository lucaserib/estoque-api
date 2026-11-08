"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SLIDES_TOUR } from "@/modules/onboarding/tourSlides";

interface TourSlidesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConcluido: () => void;
}

export function TourSlides({ open, onOpenChange, onConcluido }: TourSlidesProps) {
  const router = useRouter();
  const [indice, setIndice] = useState(0);
  const slide = SLIDES_TOUR[indice];
  const Icon = slide.icon;
  const ultimo = indice === SLIDES_TOUR.length - 1;

  const fechar = (irParaComecar: boolean) => {
    onOpenChange(false);
    onConcluido();
    setIndice(0);
    if (irParaComecar) router.push("/comecar");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar(false)}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogTitle className="sr-only">Tour de introdução ao Skubo</DialogTitle>
        <div className="flex flex-col items-center gap-5 px-8 pb-6 pt-10 text-center">
          <div className="rounded-full bg-primary/10 p-4 text-primary">
            <Icon className="h-8 w-8" strokeWidth={1.75} />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-foreground">{slide.titulo}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{slide.texto}</p>
          </div>

          <div className="flex items-center gap-1.5">
            {SLIDES_TOUR.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === indice ? "w-5 bg-primary" : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button variant="ghost" size="sm" onClick={() => fechar(false)}>
            Pular
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => (ultimo ? fechar(true) : setIndice((i) => i + 1))}
          >
            {ultimo ? "Começar a configurar" : "Próximo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
