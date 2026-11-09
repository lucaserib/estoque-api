"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperacao } from "@/components/operacao/OperacaoContexto";

export default function QuadrosPage() {
  const router = useRouter();
  const { quadroPadrao } = useOperacao();

  useEffect(() => {
    if (quadroPadrao) router.replace(`/operacao/quadros/${quadroPadrao.id}`);
  }, [quadroPadrao, router]);

  return <Skeleton className="h-80 w-full rounded-2xl" />;
}
