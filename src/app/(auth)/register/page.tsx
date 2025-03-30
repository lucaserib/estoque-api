"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import Image from "next/image";
import "../../../../styles/global.css";

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
      {/* Logo */}
      <div className="mb-12">
        <div className="flex items-center space-x-3">
          <Image
            src="/vendexy-logo-white.svg"
            alt="Vendexy Gestão"
            width={50}
            height={50}
            className="w-10 h-10"
          />
          <h1 className="text-white text-2xl font-bold">vendexy gestão</h1>
        </div>
      </div>

      {/* Títulos grandes */}
      <div className="mb-12">
        <h2 className="text-white text-5xl font-bold mb-2">Crie sua</h2>
        <h2 className="text-white text-5xl font-bold mb-10">Conta</h2>
      </div>

      {/* Botão Google */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="auth-button w-full h-12 flex items-center justify-center gap-2 rounded-lg shadow-md"
      >
        <FcGoogle size={24} />
        <span>Cadastrar com o Google</span>
      </button>

      {/* Separador */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-indigo-700"></span>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 text-white text-sm bg-indigo-900 rounded">
            Ou use seu e-mail
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-800 border border-red-600 text-white text-sm mb-6">
          {error}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-200 mb-1"
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
            className="auth-input w-full h-11 pl-3 rounded-lg"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-200 mb-1"
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
            className="auth-input w-full h-11 pl-3 rounded-lg"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-200 mb-1"
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
            className="auth-input w-full h-11 pl-3 rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="auth-button w-full h-11 flex items-center justify-center rounded-lg shadow-md"
        >
          {isLoading ? "Criando conta..." : "Criar Conta"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-gray-400">Já tem uma conta? </span>
        <Link
          href="/login"
          className="text-red-400 hover:text-red-300 font-medium"
        >
          Faça login
        </Link>
      </div>
    </div>
  );
}
