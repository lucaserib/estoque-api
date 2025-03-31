"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import Logo from "../../../../public/logo-bco.svg";
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
    <div className="w-full">
      {/* Logo */}

      <div className="mt-5">
        <div className="flex flex-col space-x-3">
          <Logo className="w-[250px] h-[250px]" />
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="auth-button w-full h-12 flex items-center justify-center gap-2 rounded-lg shadow-md"
      >
        <FcGoogle size={24} />
        <span>Entrar com o Google</span>
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
            autoComplete="email"
            placeholder="Seu email"
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
            autoComplete="current-password"
            placeholder="Sua senha"
            required
            className="auth-input w-full h-11 pl-3 rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="auth-button w-full h-11 flex items-center justify-center rounded-lg shadow-md"
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center justify-between">
        <div className="text-sm">
          <span className="text-gray-400">Não tem uma conta? </span>
          <Link
            href="/register"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Cadastre-se
          </Link>
        </div>
        <div className="text-sm">
          <Link
            href="#"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <div className="flex flex-col space-x-3 mt-10 justify-end">
          <h2 className="text-white text-6xl font-bold mb-2 ">Olá, seja</h2>
          <h2 className="text-white text-6xl font-bold mb-10">Bem vindo!</h2>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
