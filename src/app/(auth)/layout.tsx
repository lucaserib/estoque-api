"use client";
import { useTheme } from "next-themes";
import { useEffect } from "react";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const { setTheme } = useTheme();

  useEffect(() => {
    // Aplicar dark mode na tela de autenticação
    setTheme("light");

    // Limpar o tema ao desmontar o componente (quando navegar para fora)
    return () => {
      // Restaurar o tema padrão ao sair da página de autenticação
      setTheme("light");
    };
  }, [setTheme]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Imagem de fundo em tela cheia */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: "url(/login-image.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Container principal */}
      <div className="flex w-full h-full relative z-10 ml-20">
        {/* Painel de autenticação à esquerda */}
        <div className="w-full md:w-[500px] lg:w-[550px] flex flex-col justify-start px-10 py-5">
          <div className="w-full max-w-[350px]">{children}</div>
        </div>

        <div className="hidden md:block flex-1"></div>
      </div>
    </div>
  );
};

export default AuthLayout;
