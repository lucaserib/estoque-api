"use client";

import { useEffect } from "react";

const MARCA = "__skuboInterceptadorAssinatura";

function chamadaDaApi(entrada: RequestInfo | URL): boolean {
  const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  try {
    const destino = new URL(url, window.location.origin);
    return destino.origin === window.location.origin && destino.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function InterceptadorAssinatura() {
  useEffect(() => {
    const janela = window as typeof window & { [MARCA]?: boolean };
    if (janela[MARCA]) return;
    janela[MARCA] = true;
    const original = window.fetch.bind(window);

    window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const resposta = await original(entrada, init);
      if (resposta.status === 402 && chamadaDaApi(entrada) && window.location.pathname !== "/assinatura") {
        const corpo = await resposta
          .clone()
          .json()
          .catch(() => null);
        if (corpo?.codigo === "ASSINATURA_INATIVA") window.location.assign("/assinatura");
      }
      return resposta;
    };

    return () => {
      window.fetch = original;
      janela[MARCA] = false;
    };
  }, []);

  return null;
}
