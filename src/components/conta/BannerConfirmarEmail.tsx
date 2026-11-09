"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";

export function BannerConfirmarEmail() {
  const { data: sessao, status } = useSession();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  if (status !== "authenticated" || sessao?.user?.emailVerificado !== false) return null;

  const reenviar = async () => {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/email/reenviar", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error);
      setEnviado(true);
      toast.success(corpo?.mensagem ?? "Mandamos um novo link de confirmação.");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível reenviar agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      role="status"
      data-testid="banner-confirmar-email"
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/30 bg-warning/[0.08] px-3 py-2 text-sm"
    >
      <MailWarning className="h-4 w-4 shrink-0 text-warning-text" />
      <span className="min-w-0 flex-1">
        Confirme seu e-mail <strong className="font-medium">{sessao.user.email}</strong> para comprar perguntas da IA e indicar amigos.
      </span>
      <button
        type="button"
        onClick={reenviar}
        disabled={enviando || enviado}
        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-60"
      >
        {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {enviado ? "Link enviado" : "Reenviar link"}
      </button>
    </div>
  );
}
