import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { PainelDescadastro } from "./PainelDescadastro";

export const metadata: Metadata = { title: "Preferências de e-mail · Skubo", robots: { index: false } };

export default function DescadastroPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-10">
        <Logo size="sm" />
        <Suspense fallback={null}>
          <PainelDescadastro />
        </Suspense>
      </div>
    </div>
  );
}
