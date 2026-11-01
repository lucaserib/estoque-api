"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface LayoutContextProps {
  isSidebarCollapsed: boolean;
  isDarkMode: boolean;
  toggleSidebar: () => void;
  /** Fecha a sidebar só quando ela está sobreposta ao conteúdo (telas < md). */
  closeSidebarOnMobile: () => void;
  toggleDarkMode: () => void;
}

const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

const THEME_STORAGE_KEY = "leap-store-theme";
const SIDEBAR_STORAGE_KEY = "leap-sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 767px)";

function lerStorage(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarStorage(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // modo privado / storage bloqueado: preferência só não persiste
  }
}

export const LayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const tema = lerStorage(THEME_STORAGE_KEY);
    if (tema) setIsDarkMode(tema === "dark");

    // No celular a sidebar sobrepõe o conteúdo: começa sempre fechada.
    // No desktop respeita a última escolha do usuário.
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(lerStorage(SIDEBAR_STORAGE_KEY) === "1");
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((atual) => {
      const proximo = !atual;
      if (!window.matchMedia(MOBILE_QUERY).matches) {
        gravarStorage(SIDEBAR_STORAGE_KEY, proximo ? "1" : "0");
      }
      return proximo;
    });
  }, []);

  const closeSidebarOnMobile = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setIsSidebarCollapsed(true);
  }, []);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    gravarStorage(THEME_STORAGE_KEY, next ? "dark" : "light");
  };

  return (
    <LayoutContext.Provider
      value={{ isSidebarCollapsed, isDarkMode, toggleSidebar, closeSidebarOnMobile, toggleDarkMode }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
};
