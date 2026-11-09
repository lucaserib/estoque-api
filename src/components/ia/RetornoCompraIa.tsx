"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useComprarCreditos } from "./useComprarCreditos";

export function RetornoCompraIa() {
  const compraId = useSearchParams().get("compra");
  const router = useRouter();
  const { acompanhar } = useComprarCreditos();
  const iniciado = useRef(false);

  useEffect(() => {
    if (!compraId || iniciado.current) return;
    iniciado.current = true;
    acompanhar(compraId);
    router.replace("/ia");
  }, [compraId, acompanhar, router]);

  return null;
}
