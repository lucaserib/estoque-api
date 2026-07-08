"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
        setError("Email ou senha inválidos");
        return;
      }

      window.location.href = "/";
    } catch (error) {
      setError("Ocorreu um erro ao tentar fazer login");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="w-full">
      {/* Logo + título */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <Logo size="lg" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Bem-vindo de volta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estoque e reposição para quem vende no Mercado Livre
          </p>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="auth-button w-full h-11 flex items-center justify-center gap-2 rounded-lg shadow-sm"
      >
        <FcGoogle size={22} />
        <span>Entrar com o Google</span>
      </button>

      {/* Separador */}
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
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-6">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Seu email"
            required
            className="auth-input w-full h-11 pl-3 rounded-lg border"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Senha
          </label>
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
