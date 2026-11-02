"use client";

import React, { useCallback, useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/layout/Sidebar";
import BottomNav from "./components/layout/BottomNav";
import { useLayout } from "./context/LayoutContext";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { TourSlides } from "@/components/onboarding/TourSlides";
import { EVENTO_ABRIR_TOUR } from "@/lib/eventosCliente";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isSidebarCollapsed, isDarkMode } = useLayout();
  const { setTheme } = useTheme();
  const { status } = useSession();
  const [tourAberto, setTourAberto] = useState(false);

  useEffect(() => {
    // Sincronizar o estado do isDarkMode do LayoutContext com o tema do next-themes
    // Isso garante que a configuração de tema seja consistente em toda a aplicação
    setTheme(isDarkMode ? "dark" : "light");

    // Também aplicamos o tema diretamente no elemento HTML para garantir
    const html = document.documentElement;
    html.classList.toggle("dark", isDarkMode);
    html.classList.toggle("light", !isDarkMode);
  }, [isDarkMode, setTheme]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/onboarding/tour-visto")
      .then((res) => (res.ok ? res.json() : null))
      .then((dados) => {
        if (dados && !dados.tourVisto) setTourAberto(true);
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    const abrir = () => setTourAberto(true);
    window.addEventListener(EVENTO_ABRIR_TOUR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, abrir);
  }, []);

  const marcarTourVisto = useCallback(() => {
    fetch("/api/onboarding/tour-visto", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div
      className={`${
        isDarkMode ? "dark" : "light"
      } flex bg-background text-foreground w-full min-h-screen`}
    >
      <Sidebar />

      <main
        className={`flex min-w-0 flex-col w-full h-full py-7 px-4 pb-24 md:px-6 md:pb-7 bg-background transition-[padding] duration-300 ${
          isSidebarCollapsed ? "md:pl-24" : "md:pl-72"
        }`}
      >
        <Navbar />
        <div className="w-full min-w-0 max-w-full">{children}</div>
      </main>

      <BottomNav />

      <TourSlides open={tourAberto} onOpenChange={setTourAberto} onConcluido={marcarTourVisto} />
    </div>
  );
};

const DashboardWrapper = ({ children }: { children: React.ReactNode }) => {
  return <DashboardLayout>{children}</DashboardLayout>;
};

export default DashboardWrapper;
