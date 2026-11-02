"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type TemaPreferencia = "CLARO" | "ESCURO" | "SISTEMA";

interface LayoutContextProps {
  isSidebarCollapsed: boolean;
  isDarkMode: boolean;
  tema: TemaPreferencia;
  setTema: (tema: TemaPreferencia) => void;
  nomeLoja: string | null;
  logoUrl: string | null;
  atualizarBranding: (dados: { nomeLoja?: string | null; logoUrl?: string | null }) => void;
  toggleSidebar: () => void;
  /** Fecha a sidebar só quando ela está sobreposta ao conteúdo (telas < md). */
  closeSidebarOnMobile: () => void;
  toggleDarkMode: () => void;
}

const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

const THEME_STORAGE_KEY = "skubo-theme";
const SIDEBAR_STORAGE_KEY = "leap-sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 767px)";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

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

function temaValido(valor: string | null): TemaPreferencia | null {
  return valor === "CLARO" || valor === "ESCURO" || valor === "SISTEMA" ? valor : null;
}

export const LayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const { status } = useSession();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tema, setTemaState] = useState<TemaPreferencia>("SISTEMA");
  const [segueSistemaEscuro, setSegueSistemaEscuro] = useState(false);
  const [nomeLoja, setNomeLoja] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const temaSalvo = temaValido(lerStorage(THEME_STORAGE_KEY));
    if (temaSalvo) setTemaState(temaSalvo);

    const media = window.matchMedia(DARK_SCHEME_QUERY);
    setSegueSistemaEscuro(media.matches);
    const ouvirMudancaSistema = (e: MediaQueryListEvent) => setSegueSistemaEscuro(e.matches);
    media.addEventListener("change", ouvirMudancaSistema);

    // No celular a sidebar sobrepõe o conteúdo: começa sempre fechada.
    // No desktop respeita a última escolha do usuário.
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(lerStorage(SIDEBAR_STORAGE_KEY) === "1");
    }

    return () => media.removeEventListener("change", ouvirMudancaSistema);
  }, []);

  useEffect(() => {
    // Páginas sem sessão (login, registro) não têm conta pra buscar tema/marca — evita 401 à toa.
    if (status !== "authenticated") return;

    fetch("/api/configuracoes-gerais")
      .then((res) => (res.ok ? res.json() : null))
      .then((dados) => {
        if (!dados) return;
        const temaServidor = temaValido(dados.tema);
        if (temaServidor) {
          setTemaState(temaServidor);
          gravarStorage(THEME_STORAGE_KEY, temaServidor);
        }
        setNomeLoja(dados.nomeLoja ?? null);
        setLogoUrl(dados.logoUrl ?? null);
      })
      .catch(() => {
        // falha de rede: fica no padrão local
      });
  }, [status]);

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

  const setTema = useCallback((novoTema: TemaPreferencia) => {
    setTemaState(novoTema);
    gravarStorage(THEME_STORAGE_KEY, novoTema);
    fetch("/api/configuracoes-gerais", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tema: novoTema }),
    }).catch(() => {
      // preferência já aplicada no cliente; só não foi sincronizada com a conta
    });
  }, []);

  const isDarkMode = tema === "SISTEMA" ? segueSistemaEscuro : tema === "ESCURO";

  const toggleDarkMode = useCallback(() => {
    setTema(isDarkMode ? "CLARO" : "ESCURO");
  }, [isDarkMode, setTema]);

  const atualizarBranding = useCallback(
    (dados: { nomeLoja?: string | null; logoUrl?: string | null }) => {
      if (dados.nomeLoja !== undefined) setNomeLoja(dados.nomeLoja);
      if (dados.logoUrl !== undefined) setLogoUrl(dados.logoUrl);
    },
    []
  );

  return (
    <LayoutContext.Provider
      value={{
        isSidebarCollapsed,
        isDarkMode,
        tema,
        setTema,
        nomeLoja,
        logoUrl,
        atualizarBranding,
        toggleSidebar,
        closeSidebarOnMobile,
        toggleDarkMode,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = (): LayoutContextProps => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout deve ser usado dentro de um LayoutProvider");
  }
  return context;
};
