"use client";

import { useState } from "react";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    const email = String(new FormData(evento.currentTarget).get("email") ?? "");
    try {
      const resposta = await fetch("/api/auth/senha/esqueci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível enviar agora.");
      setMensagem(corpo.mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-[23px] font-semibold leading-tight tracking-tight text-foreground">Esqueci minha senha</h1>
      <p className="mb-7 mt-2 text-sm text-muted-foreground">
        Informe o e-mail da sua conta. Mandamos um link para você criar uma nova senha.
      </p>

      {mensagem ? (
        <div role="status" className="mb-6 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
          {mensagem}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={enviar}>
          {erro && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-text">
              {erro}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Seu e-mail"
              required
              className="auth-input h-11 w-full rounded-lg border pl-3"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="auth-button flex h-11 w-full items-center justify-center rounded-lg shadow-sm"
          >
            {enviando ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:text-primary/80">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
