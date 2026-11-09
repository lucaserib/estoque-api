import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { RespostaCancelamento } from "./RespostaCancelamento";

export const metadata: Metadata = { title: "Por que cancelou? · Skubo", robots: { index: false } };

export default function PesquisaCancelamentoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-10">
        <Logo size="sm" />
        <Suspense fallback={null}>
          <RespostaCancelamento />
        </Suspense>
      </div>
    </div>
  );
}
