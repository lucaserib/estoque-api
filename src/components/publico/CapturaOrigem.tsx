"use client";

import { useEffect } from "react";
import { COOKIE_ORIGEM, DIAS_COOKIE_ORIGEM, origemDaUrl, serializarOrigem } from "@/lib/origemCadastro";

export function CapturaOrigem() {
  useEffect(() => {
    try {
      if (document.cookie.split("; ").some((parte) => parte.startsWith(`${COOKIE_ORIGEM}=`))) return;
      const origem = origemDaUrl(new URL(window.location.href), document.referrer || null);
      const segura = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${COOKIE_ORIGEM}=${serializarOrigem(origem)}; Max-Age=${DIAS_COOKIE_ORIGEM * 86400}; Path=/; SameSite=Lax${segura}`;
    } catch {}
  }, []);
  return null;
}
