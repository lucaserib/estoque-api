"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { COOKIE_CONSENTIMENTO } from "@/lib/origemCadastro";

type Escolha = "todos" | "essenciais";
const EVENTO = "skubo:cookies";

function lerEscolha(): Escolha | null {
  const valor = document.cookie
    .split("; ")
    .find((parte) => parte.startsWith(`${COOKIE_CONSENTIMENTO}=`))
    ?.split("=")[1];
  return valor === "todos" || valor === "essenciais" ? valor : null;
}

export function rastrearMeta(evento: string, idEvento: string, dados: Record<string, unknown> = {}) {
  const fbq = (window as typeof window & { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq === "function") fbq("track", evento, dados, { eventID: idEvento });
}

export function ConsentimentoCookies() {
  const [escolha, setEscolha] = useState<Escolha | null | "carregando">("carregando");
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  useEffect(() => {
    setEscolha(lerEscolha());
    const atualizar = () => setEscolha(lerEscolha());
    window.addEventListener(EVENTO, atualizar);
    return () => window.removeEventListener(EVENTO, atualizar);
  }, []);

  const escolher = (valor: Escolha) => {
    const segura = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_CONSENTIMENTO}=${valor}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax${segura}`;
    setEscolha(valor);
    window.dispatchEvent(new Event(EVENTO));
  };

  return (
    <>
      {pixelId && escolha === "todos" && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId.replace(/[^0-9]/g, "")}');fbq('track','PageView');`}
        </Script>
      )}
      {escolha === null && <div aria-hidden className="h-52 w-full flex-none sm:h-36" />}
      {escolha === null && (
        <div
          role="dialog"
          aria-label="Aviso de cookies"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-border bg-card p-4 text-sm shadow-lift sm:inset-x-6"
        >
          <p className="text-foreground">
            Usamos cookies essenciais para o Skubo funcionar e, se você aceitar, cookies de marketing para medir nossos
            anúncios. Detalhes na{" "}
            <Link href="/privacidade" className="font-medium text-primary hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => escolher("essenciais")}
              className="rounded-lg border border-border px-3 py-2 font-medium text-foreground hover:bg-muted"
            >
              Só essenciais
            </button>
            <button
              type="button"
              onClick={() => escolher("todos")}
              className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Aceitar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
