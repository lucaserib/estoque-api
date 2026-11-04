"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DESTINO_APOS_CONECTAR = "/mercado-livre/configuracoes";

/**
 * Landing de retorno do OAuth do Mercado Livre — mantém a URL registrada em
 * ML_REDIRECT_URI (env.example, docs/BLING_API.md). A gestão de contas em si
 * vive em /mercado-livre/configuracoes; esta página só termina a troca do
 * código por token e manda o usuário pra lá.
 */
export default function MercadoLivreCallbackPage() {
  const { status } = useSession();
  const router = useRouter();
  const [processando, setProcessando] = useState(true);

  const isNgrokUrl = useCallback(
    (url: string = window.location.hostname) =>
      url.includes(".ngrok") || url.includes(".ngrok.io") || url.includes(".ngrok-free.app"),
    []
  );

  const getLocalhostUrl = useCallback((path: string) => {
    const porta = window.location.port || "3000";
    return `http://localhost:${porta}${path}`;
  }, []);

  const processarCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const mlConnected = params.get("ml_connected");
    const mlError = params.get("ml_error");
    const isFromNgrok = isNgrokUrl();

    if (mlConnected) {
      const salvo = localStorage.getItem("mlAuthSuccess");
      if (salvo) {
        try {
          const dados = JSON.parse(salvo);
          if (Date.now() - dados.timestamp < 120000) {
            toast.success(`Conta ${dados.account.nickname} conectada com sucesso!`);
          }
        } catch {
          // ignora payload inválido
        } finally {
          localStorage.removeItem("mlAuthSuccess");
        }
      }
      router.replace(DESTINO_APOS_CONECTAR);
      return;
    }

    if (mlError) {
      const salvo = localStorage.getItem("mlAuthError");
      if (salvo) {
        try {
          const dados = JSON.parse(salvo);
          if (Date.now() - dados.timestamp < 120000) {
            toast.error(`Erro ao conectar conta: ${dados.error}`);
          }
        } catch {
          // ignora payload inválido
        } finally {
          localStorage.removeItem("mlAuthError");
        }
      }
      router.replace(DESTINO_APOS_CONECTAR);
      return;
    }

    if (error) {
      if (isFromNgrok) {
        localStorage.setItem("mlAuthError", JSON.stringify({ error, timestamp: Date.now() }));
        window.location.href = getLocalhostUrl("/configuracoes?ml_error=true");
        return;
      }
      toast.error(`Erro na autorização: ${error}`);
      router.replace(DESTINO_APOS_CONECTAR);
      return;
    }

    if (code && state) {
      try {
        const response = await fetch("/api/mercadolivre/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });
        const data = await response.json();

        if (data.success) {
          if (isFromNgrok) {
            localStorage.setItem(
              "mlAuthSuccess",
              JSON.stringify({ success: true, account: data.account, timestamp: Date.now() })
            );
            window.location.href = getLocalhostUrl("/configuracoes?ml_connected=true");
            return;
          }
          toast.success(`Conta ${data.account.nickname} conectada com sucesso!`);
        } else {
          if (isFromNgrok) {
            localStorage.setItem(
              "mlAuthError",
              JSON.stringify({ error: data.error || "Erro ao conectar conta", timestamp: Date.now() })
            );
            window.location.href = getLocalhostUrl("/configuracoes?ml_error=true");
            return;
          }
          toast.error(data.error || "Erro ao conectar conta");
        }
      } catch {
        if (isFromNgrok) {
          localStorage.setItem(
            "mlAuthError",
            JSON.stringify({ error: "Erro ao processar callback", timestamp: Date.now() })
          );
          window.location.href = getLocalhostUrl("/configuracoes?ml_error=true");
          return;
        }
        toast.error("Erro ao conectar conta");
      }

      router.replace(DESTINO_APOS_CONECTAR);
      return;
    }

    // Visita direta, sem nenhum parâmetro de callback (link antigo/favorito).
    router.replace(DESTINO_APOS_CONECTAR);
  }, [isNgrokUrl, getLocalhostUrl, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    processarCallback().finally(() => setProcessando(false));
  }, [status, processarCallback]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p>{processando ? "Conectando sua conta do Mercado Livre…" : "Redirecionando…"}</p>
    </div>
  );
}
