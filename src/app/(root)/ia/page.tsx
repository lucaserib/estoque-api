import { Suspense } from "react";
import type { Metadata } from "next";
import { PainelAssistente } from "@/components/ia/PainelAssistente";
import { RetornoCompraIa } from "@/components/ia/RetornoCompraIa";

export const metadata: Metadata = { title: "Assistente IA · Skubo" };

export default function AssistenteIaPage() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-9.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-card border border-border/80 bg-card shadow-card md:h-[calc(100dvh-7.5rem)]">
      <Suspense fallback={null}>
        <RetornoCompraIa />
      </Suspense>
      <PainelAssistente modo="pagina" />
    </div>
  );
}
