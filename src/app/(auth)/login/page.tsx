"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";

function destinoAposLogin(): string {
  if (typeof window === "undefined") return "/";
  const destino = new URLSearchParams(window.location.search).get("callbackUrl");
  if (!destino || !destino.startsWith("/") || destino.startsWith("//")) return "/";
  return destino;
}

function mensagemDeErro(codigo: string | undefined): string {
  if (codigo && /muitas tentativas|bloquead/i.test(codigo)) return codigo;
  return "E-mail ou senha inválidos";
}

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [falhas, setFalhas] = useState(0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(mensagemDeErro(result.error));
        setFalhas((atual) => atual + 1);
        return;
      }

      window.location.href = destinoAposLogin();
    } catch (error) {
      setError("Ocorreu um erro ao tentar fazer login");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn("google", { callbackUrl: destinoAposLogin() });
  };

  return (
    <div className="w-full">
      <h1 className="text-[23px] font-semibold leading-tight tracking-tight text-foreground">
        Entrar na sua conta
      </h1>
      <p className="mb-7 mt-2 text-sm text-muted-foreground">
        Estoque e reposição para quem vende no Mercado Livre.
      </p>

      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="auth-button w-full h-11 flex items-center justify-center gap-2 rounded-lg shadow-sm"
      >
        <FcGoogle size={22} />
        <span>Entrar com o Google</span>
      </button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border"></span>
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs text-muted-foreground bg-card">
            ou use seu e-mail
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-text text-sm mb-6"
        >
          {error}
          {falhas >= 2 && (
            <p className="mt-2 text-foreground/80">
              Se você criou a conta com o Google, use o botão &quot;Entrar com o Google&quot;. Esqueceu a senha?{" "}
              <Link href="/esqueci-senha" className="font-medium text-primary hover:underline">
                Crie uma nova
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground mb-1"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Seu e-mail"
            required
            className="auth-input w-full h-11 pl-3 rounded-lg border"
          />
        </div>

        <div className="space-y-1">
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Senha
            </label>
            <Link href="/esqueci-senha" className="text-xs font-medium text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            required
            className="auth-input w-full h-11 pl-3 rounded-lg border"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="auth-button w-full h-11 flex items-center justify-center rounded-lg shadow-sm"
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1">
        <div className="text-sm">
          <span className="text-muted-foreground">Não tem uma conta? </span>
          <Link
            href="/register"
            className="text-primary hover:text-primary/80 font-medium"
          >
            Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
