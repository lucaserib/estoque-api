"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

export function ConfirmacaoEmail() {
  const token = useSearchParams().get("token") ?? "";
  const { status, update } = useSession();
  const [estado, setEstado] = useState<"confirmando" | "ok" | "erro">("confirmando");
  const [mensagem, setMensagem] = useState("");
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    if (!token) {
      setEstado("erro");
      setMensagem("Link inválido. Peça um novo.");
      return;
    }
    fetch("/api/auth/email/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (resposta) => {
        const corpo = await resposta.json().catch(() => null);
        if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível confirmar.");
        setEstado("ok");
      })
      .catch((e: unknown) => {
        setEstado("erro");
        setMensagem(e instanceof Error ? e.message : "Não foi possível confirmar.");
      });
  }, [token]);

  useEffect(() => {
    if (estado === "ok" && status === "authenticated") update({ recarregar: true }).catch(() => {});
  }, [estado, status, update]);

  return (
    <div className="w-full">
      <h1 className="text-[23px] font-semibold leading-tight tracking-tight text-foreground">Confirmar e-mail</h1>
      <div className="mt-6 space-y-4">
        {estado === "confirmando" && <p className="text-sm text-muted-foreground">Confirmando...</p>}
        {estado === "ok" && (
          <div role="status" className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
            Pronto! Seu e-mail está confirmado.
          </div>
        )}
        {estado === "erro" && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-text">
            {mensagem} Entre na sua conta e use &quot;Reenviar link&quot; no aviso do topo.
          </div>
        )}
        {estado !== "confirmando" && (
          <Link
            href={status === "authenticated" ? "/" : "/login"}
            className="auth-button flex h-11 w-full items-center justify-center rounded-lg shadow-sm"
          >
            {status === "authenticated" ? "Ir para o Skubo" : "Entrar"}
          </Link>
        )}
      </div>
    </div>
  );
}
