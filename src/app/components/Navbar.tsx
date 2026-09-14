"use client";

import {
  Menu,
  Moon,
  Sun,
  Settings,
  Search,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useLayout } from "../context/LayoutContext";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import NotificationsBell from "./NotificationsBell";

const Navbar = () => {
  const { isDarkMode, toggleSidebar, toggleDarkMode } = useLayout();

  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  return (
    <div className="flex h-[60px] w-full items-center gap-3.5 border-b border-border bg-card px-1 mb-6">
      <button
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-fg2 hover:bg-muted md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex min-w-[220px] max-w-[420px] flex-1 items-center gap-2.5 rounded-full border border-border bg-accent px-3.5 py-2">
        <Search className="h-[15px] w-[15px] shrink-0 text-faint" />
        <input
          type="search"
          placeholder="Buscar SKU, produto, pedido ou anúncio"
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint"
        />
        <span className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-faint sm:inline-block">
          ⌘K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationsBell />

        <button
          onClick={toggleDarkMode}
          aria-label="Alternar tema"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-card text-fg2 hover:bg-muted"
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="hidden items-center gap-2 md:flex">
          <div className="mx-1 h-7 w-px bg-border" />

          <div className="relative" ref={dropdownRef}>
            <div
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-muted"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {status === "loading" ? (
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              ) : (
                <span className="text-[13px] font-medium text-foreground">
                  {session?.user?.name || session?.user?.email || "Convidado"}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-faint transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-border bg-card shadow-lift">
                <Link
                  href="/configuracoes-gerais"
                  className="flex items-center gap-2 rounded-t-lg px-4 py-3 text-left text-sm text-fg2 hover:bg-muted"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2 rounded-b-lg px-4 py-3 text-left text-sm text-fg2 hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
