"use client";

import {
  Menu,
  Moon,
  Sun,
  Settings,
  LogOut,
  ChevronDown,
  User,
  HelpCircle,
  Smartphone,
} from "lucide-react";
import { useLayout } from "../context/LayoutContext";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import NotificationsBell from "./NotificationsBell";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CommandPalette } from "@/components/command-palette";
import { EVENTO_ABRIR_TOUR } from "@/lib/eventosCliente";

const Navbar = () => {
  const { isDarkMode, toggleSidebar, toggleDarkMode } = useLayout();

  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  return (
    <div className="mb-6 flex h-[60px] w-full min-w-0 items-center gap-2 border-b border-border bg-card px-1 sm:gap-3.5">
      <button
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-fg2 hover:bg-muted md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </button>

      <CommandPalette />

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
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {status === "loading" ? (
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <UserAvatar
                    name={session?.user?.name}
                    email={session?.user?.email}
                    image={session?.user?.image}
                    size={28}
                  />
                  <span className="text-[13px] font-medium text-foreground">
                    {session?.user?.name || session?.user?.email || "Convidado"}
                  </span>
                </>
              )}
              <ChevronDown
                className={`h-4 w-4 text-faint transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-card shadow-lift">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {session?.user?.name || "Usuário"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session?.user?.email}
                  </p>
                </div>
                <Link
                  href="/perfil"
                  className="flex items-center gap-2 px-4 py-3 text-left text-sm text-fg2 hover:bg-muted"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <User className="h-4 w-4" />
                  Meu perfil
                </Link>
                <Link
                  href="/configuracoes-gerais"
                  className="flex items-center gap-2 px-4 py-3 text-left text-sm text-fg2 hover:bg-muted"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </Link>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    window.dispatchEvent(new Event(EVENTO_ABRIR_TOUR));
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-fg2 hover:bg-muted"
                >
                  <HelpCircle className="h-4 w-4" />
                  Ajuda — Ver tour
                </button>
                <Link
                  href="/ajuda/celular"
                  className="flex items-center gap-2 px-4 py-3 text-left text-sm text-fg2 hover:bg-muted"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Smartphone className="h-4 w-4" />
                  Instalar no celular
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
