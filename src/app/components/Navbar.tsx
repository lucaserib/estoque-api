"use client";

import {
  Bell,
  Menu,
  Moon,
  Sun,
  Settings,
  BellIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useLayout } from "../context/LayoutContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

const Navbar = () => {
  const { isSidebarCollapsed, isDarkMode, toggleSidebar, toggleDarkMode } =
    useLayout();

  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  return (
    <div className="flex justify-between items-center w-full mb-7">
      {/*Left Side */}
      <div className="flex justify-between items-center gap-5">
        <button
          className="px-3 py-3 bg-gray-100 rounded-full hover:bg-blue-100"
          onClick={toggleSidebar}
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative">
          <input
            type="search"
            placeholder="Start type to search groups & products"
            className="pl-10 pr-4 py-2 w-50 md:w-60 border-2 border-gray-300 bg-white rounded-lg focus:outline-none focus:border-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <BellIcon className="text-gray-500 " size={20} />
          </div>
        </div>
      </div>

      {/* {RIGHT SIDE} */}

      <div className="flex justify-between items-center gap-5">
        <div className="hidden md:flex justify-between items-center gap-5">
          <div>
            <button onClick={toggleDarkMode}>
              {isDarkMode ? (
                <Sun className="cursor-pointer text-gray-500" size={24} />
              ) : (
                <Moon className="cursor-pointer text-gray-500" size={24} />
              )}
            </button>
          </div>
          <div className="relative">
            <Bell className="cursor-pointer text-gray-500" size={24} />
            <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-[0.4rem] py-1 text-xs font-semibold leading-none text-red-100 bg-red-400 rounded-full">
              3
            </span>
          </div>

          <hr className="w-0 h-7 border border-solid border-l border-gray-300 mx-3" />

          {/* Área do usuário com dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded-lg"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="w-9 h-9 relative rounded-full overflow-hidden">
                {/* ... conteúdo da imagem do usuário ... */}
              </div>

              <div className="flex items-center gap-1">
                {status === "loading" ? (
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                ) : (
                  <span className="font-semibold dark:text-white">
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

            {/* Dropdown de Logout com seta */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50">
                {/* Seta do dropdown */}
                <div className="absolute -top-2 right-3 w-4 h-4 bg-white dark:bg-gray-800 border-t border-l dark:border-gray-700 rotate-45"></div>

                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>

        <Link href="/settings">
          <Settings className="cursor-pointer text-gray-500" size={24} />
        </Link>
      </div>
    </div>
  );
};

export default Navbar;
