"use client";
import { useTheme } from "next-themes";
import { useEffect } from "react";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("dark");
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

      {/* Overlay gradiente para melhorar a legibilidade */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-950/80 via-indigo-900/70 to-transparent" />

      {/* Padrão decorativo (opcional) */}
      <div
        className="absolute inset-0 w-full h-full opacity-10"
        style={{
          backgroundImage:
            'url(\'data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%239C92AC" fill-opacity="0.4" fill-rule="evenodd"%3E%3Cpath d="M0 40L40 0H20L0 20M40 40V20L20 40"/%3E%3C/g%3E%3C/svg%3E\')',
          backgroundSize: "30px 30px",
        }}
      />

      {/* Container principal */}
      <div className="flex w-full h-full relative z-10">
        {/* Painel de autenticação à esquerda */}
        <div className="w-full md:w-[500px] lg:w-[550px] flex flex-col justify-center items-center px-6 py-10 md:px-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        {/* Área à direita com mensagem de boas-vindas (visível apenas em telas maiores) */}
        <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-10">
          <div className="max-w-lg text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Bem-vindo ao <span className="text-blue-400">Vendexy Gestão</span>
            </h2>
            <p className="text-lg text-blue-100/80">
              Gerencie seu estoque e vendas de forma simples e intuitiva.
              Aumente a produtividade e tomada de decisões do seu negócio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
