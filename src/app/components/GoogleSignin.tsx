"use client";

import { Button } from "@/app/components/ui/button";
import { signIn } from "next-auth/react";
import React from "react";
import { FaGoogle } from "react-icons/fa";

const GoogleSignin = () => {
  const handleGoogleSignin = async () => {
    try {
      // Redireciona para a página de autenticação do Google
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error("Erro ao autenticar com o Google:", error);
    }
  };

  return (
    <Button
      onClick={handleGoogleSignin}
      className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 active:scale-95"
    >
      <FaGoogle className="w-5 h-5 text-white" />
      Entrar com Google
    </Button>
  );
};

export default GoogleSignin;
