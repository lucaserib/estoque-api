"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { recarregarAcessoIa } from "./useAcessoIa";

const INTERVALO_MS = 3000;
const LIMITE_MS = 60_000;

export function useComprarCreditos(aoAprovar?: () => void) {
  const [comprando, setComprando] = useState<string | null>(null);
  const [acompanhando, setAcompanhando] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setAcompanhando(null);
  }, []);

  const acompanhar = useCallback(
    (compraId: string) => {
      const inicio = Date.now();
      setAcompanhando(compraId);
      const verificar = async () => {
        try {
          const resposta = await fetch(`/api/ia/creditos/compras/${compraId}`);
          const corpo = await resposta.json().catch(() => null);
          const status = corpo?.compra?.status;
          if (status === "APROVADA") {
            parar();
            toast.success(`Pronto! ${corpo.compra.perguntas} perguntas entraram na conta. Saldo: ${corpo.saldo}.`);
            await recarregarAcessoIa();
            aoAprovar?.();
            return;
          }
          if (status === "RECUSADA" || status === "EXPIRADA") {
            parar();
            toast.error("O pagamento não foi aprovado. Tente de novo ou use outro meio.");
            return;
          }
        } catch {}
        if (Date.now() - inicio >= LIMITE_MS) {
          parar();
          toast.info("Ainda não recebemos a confirmação. Assim que o pagamento cair, as perguntas aparecem aqui.");
          return;
        }
        temporizador.current = setTimeout(verificar, INTERVALO_MS);
      };
      verificar();
    },
    [aoAprovar, parar]
  );

  useEffect(() => parar, [parar]);

  const comprar = useCallback(
    async (pacoteId: string, cupom?: string | null) => {
      setComprando(pacoteId);
      const aba = window.open("about:blank", "_blank");
      try {
        const resposta = await fetch("/api/ia/creditos/comprar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pacoteId, cupom: cupom || null }),
        });
        const corpo = await resposta.json().catch(() => null);
        if (!resposta.ok || !corpo?.checkoutUrl) {
          aba?.close();
          toast.error(corpo?.error ?? "Não foi possível abrir o pagamento agora.");
          return;
        }
        if (aba && !aba.closed) {
          aba.location.href = corpo.checkoutUrl;
          acompanhar(corpo.compraId);
        } else {
          window.location.href = corpo.checkoutUrl;
        }
      } catch {
        aba?.close();
        toast.error("Não foi possível abrir o pagamento agora.");
      } finally {
        setComprando(null);
      }
    },
    [acompanhar]
  );

  return { comprar, comprando, acompanhar, acompanhando };
}
