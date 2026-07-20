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
    <div className="flex justify-between items-center w-full mb-7">
      <div className="flex justify-between items-center gap-5">
        <button
          className="px-3 py-3 bg-muted rounded-full hover:bg-accent"
          onClick={toggleSidebar}
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative">
          <input
            type="search"
            placeholder="Buscar produtos, pedidos…"
            className="pl-10 pr-4 py-2 w-50 md:w-60 border border-input bg-card rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-ring"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="text-muted-foreground" size={18} />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center gap-5">
        <div className="hidden md:flex justify-between items-center gap-5">
          <div>
            <button onClick={toggleDarkMode} aria-label="Alternar tema">
              {isDarkMode ? (
                <Sun
                  className="cursor-pointer text-muted-foreground"
                  size={24}
                />
              ) : (
                <Moon
                  className="cursor-pointer text-muted-foreground"
                  size={24}
                />
              )}
            </button>
          </div>

          <NotificationsBell />

          <hr className="w-0 h-7 border border-solid border-l border-input mx-3" />

          <div className="relative" ref={dropdownRef}>
            <div
              className="flex items-center gap-3 cursor-pointer hover:bg-muted px-3 py-1 rounded-lg"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="flex items-center gap-1">
                {status === "loading" ? (
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                ) : (
                  <span className="font-semibold">
                    {session?.user?.name || session?.user?.email || "Convidado"}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-xl border z-50">
                <div className="absolute -top-2 right-3 w-4 h-4 bg-card border-t border-l rotate-45"></div>

                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>

        <Link href="/configuracoes-gerais" aria-label="Configurações">
          <Settings
            className="cursor-pointer text-muted-foreground"
            size={24}
          />
        </Link>
      </div>
    </div>
  );
};

export default Navbar;
