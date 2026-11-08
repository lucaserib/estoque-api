"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaPorVenda } from "./components/AbaPorVenda";
import { AbaPorProduto } from "./components/AbaPorProduto";

type Aba = "venda" | "produto";

function VendasShellContent() {
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<Aba>(searchParams.get("aba") === "produto" ? "produto" : "venda");

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList>
          <TabsTrigger value="venda">Por venda</TabsTrigger>
          <TabsTrigger value="produto">Por produto</TabsTrigger>
        </TabsList>
        <TabsContent value="venda" className="mt-6">
          <AbaPorVenda />
        </TabsContent>
        <TabsContent value="produto" className="mt-6">
          <AbaPorProduto />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function VendasPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <VendasShellContent />
    </Suspense>
  );
}
