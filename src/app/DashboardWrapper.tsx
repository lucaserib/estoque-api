"use client";

import React, { useEffect } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/layout/Sidebar";
import BottomNav from "./components/layout/BottomNav";
import { useLayout } from "./context/LayoutContext";
import { useTheme } from "next-themes";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isSidebarCollapsed, isDarkMode } = useLayout();
  const { setTheme } = useTheme();

  useEffect(() => {
    // Sincronizar o estado do isDarkMode do LayoutContext com o tema do next-themes
    // Isso garante que a configuração de tema seja consistente em toda a aplicação
    setTheme(isDarkMode ? "dark" : "light");

    // Também aplicamos o tema diretamente no elemento HTML para garantir
    const html = document.documentElement;
    html.classList.toggle("dark", isDarkMode);
    html.classList.toggle("light", !isDarkMode);
  }, [isDarkMode, setTheme]);

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
    </div>
  );
};

const DashboardWrapper = ({ children }: { children: React.ReactNode }) => {
  return <DashboardLayout>{children}</DashboardLayout>;
};

export default DashboardWrapper;
