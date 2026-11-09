"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const SENHA_MINIMA = 8;

export function FormularioRedefinirSenha() {
  const token = useSearchParams().get("token") ?? "";
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(token ? null : "Link inválido. Peça um novo.");

  const enviar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const senha = String(dados.get("senha") ?? "");
    const confirmacao = String(dados.get("confirmacao") ?? "");
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/auth/senha/redefinir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível trocar a senha.");
      setConcluido(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível trocar a senha.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-[23px] font-semibold leading-tight tracking-tight text-foreground">Criar nova senha</h1>
      <p className="mb-7 mt-2 text-sm text-muted-foreground">Depois da troca, os outros aparelhos saem da sua conta.</p>

      {concluido ? (
        <div className="space-y-4">
          <div role="status" className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
            Senha alterada. Entre com a nova senha.
          </div>
          <Link href="/login" className="auth-button flex h-11 w-full items-center justify-center rounded-lg shadow-sm">
            Entrar
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={enviar}>
          {erro && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-text">
              {erro}{" "}
              {/expirou|inválido|usado/i.test(erro) && (
                <Link href="/esqueci-senha" className="font-medium text-primary hover:underline">
                  Pedir outro link
                </Link>
              )}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="senha" className="mb-1 block text-sm font-medium text-foreground">
              Nova senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={SENHA_MINIMA}
              required
              className="auth-input h-11 w-full rounded-lg border pl-3"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="confirmacao" className="mb-1 block text-sm font-medium text-foreground">
              Repita a nova senha
            </label>
            <input
              id="confirmacao"
              name="confirmacao"
              type="password"
              autoComplete="new-password"
              minLength={SENHA_MINIMA}
              required
              className="auth-input h-11 w-full rounded-lg border pl-3"
            />
          </div>
          <button
            type="submit"
            disabled={enviando || !token}
            className="auth-button flex h-11 w-full items-center justify-center rounded-lg shadow-sm"
          >
            {enviando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}
    </div>
  );
}
