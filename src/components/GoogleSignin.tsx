"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import React from "react";

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
      className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg"
    >
      Sign in with Google
    </Button>
  );
};

export default GoogleSignin;
