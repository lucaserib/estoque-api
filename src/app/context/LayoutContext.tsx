"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

interface LayoutContextProps {
  isSidebarCollapsed: boolean;
  isDarkMode: boolean;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
}

const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

const THEME_STORAGE_KEY = "leap-store-theme";

export const LayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) setIsDarkMode(stored === "dark");
  }, []);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  };

  return (
    <LayoutContext.Provider
      value={{ isSidebarCollapsed, isDarkMode, toggleSidebar, toggleDarkMode }}
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
