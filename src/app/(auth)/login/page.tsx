"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import Image from "next/image";
import "../../../../styles/global.css";

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
    <div className="w-full auth-container bg-indigo-950/30 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-indigo-500/20">
      {/* Logo */}
      <div className="mb-10">
        <div className="flex items-center space-x-3">
          <Image
            src="/vendexy-logo-white.svg"
            alt="Vendexy Gestão"
            width={50}
            height={50}
            className="w-12 h-12"
          />
          <h1 className="text-white text-2xl font-bold">vendexy gestão</h1>
        </div>
      </div>

      {/* Títulos grandes */}
      <div className="mb-10">
        <h2 className="text-white text-5xl font-bold mb-2">Olá, seja</h2>
        <h2 className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text text-5xl font-bold mb-10">
          Bem-vindo
        </h2>
      </div>

      {/* Botão Google */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="auth-button w-full h-12 flex items-center justify-center gap-2 rounded-lg shadow-md hover:scale-[1.02] transition-all duration-200"
      >
        <FcGoogle size={24} />
        <span>Entrar com o Google</span>
      </button>

      {/* Separador */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-indigo-400/30"></span>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 text-white text-sm bg-indigo-800/50 rounded-full backdrop-blur-sm">
            Ou use seu e-mail
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-900/50 border border-red-500/50 text-white text-sm mb-6 backdrop-blur-sm">
          {error}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-blue-100 mb-1"
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
            className="auth-input w-full h-12 pl-4 rounded-lg bg-indigo-900/40 border-indigo-500/30 focus:border-blue-400 focus:ring-blue-400/50"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-blue-100 mb-1"
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
            className="auth-input w-full h-12 pl-4 rounded-lg bg-indigo-900/40 border-indigo-500/30 focus:border-blue-400 focus:ring-blue-400/50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="auth-button w-full h-12 flex items-center justify-center rounded-lg shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all duration-300 hover:shadow-blue-500/20 hover:scale-[1.02]"
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-8 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-indigo-200">Não tem uma conta? </span>
          <Link
            href="/register"
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Cadastre-se
          </Link>
        </div>
        <div className="text-sm">
          <Link
            href="#"
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Esqueceu a senha?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
