"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const { error } = await res.json();
        setError(error);
        return;
      }

      router.push("/login");
    } catch (error) {
      setError("Ocorreu um erro ao criar sua conta. Tente novamente.");
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
            Crie sua conta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece a controlar seu estoque em minutos
          </p>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="auth-button w-full h-11 flex items-center justify-center gap-2 rounded-lg shadow-sm"
      >
        <FcGoogle size={22} />
        <span>Cadastrar com o Google</span>
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
            placeholder="Seu email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="auth-input w-full h-11 pl-3 rounded-lg border"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Nome completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Seu nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            placeholder="Sua senha"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className="auth-input w-full h-11 pl-3 rounded-lg border"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="auth-button w-full h-11 flex items-center justify-center rounded-lg shadow-sm"
        >
          {isLoading ? "Criando conta..." : "Criar Conta"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1">
        <div className="text-sm">
          <span className="text-muted-foreground">Já tem uma conta? </span>
          <Link
            href="/login"
            className="text-primary hover:text-primary/80 font-medium"
          >
            Faça login
          </Link>
        </div>
      </div>
    </div>
  );
}
