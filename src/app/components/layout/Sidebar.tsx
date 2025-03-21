"use client";

import React, { useState } from "react";
import {
  Layout,
  Package,
  Clipboard,
  Truck,
  Warehouse,
  Box,
  Menu,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayout } from "../../context/LayoutContext";
import Image from "next/image";
import vendexyLogo from "@/assets/vendexy.png";

interface SidebarLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isCollapsed: boolean;
}
const SidebarLink = ({
  href,
  icon: Icon,
  label,
  isCollapsed,
}: SidebarLinkProps) => {
  const pathname = usePathname();
  const isActive =
    pathname === href || (pathname === "/" && href === "/dashboard");

  return (
    <Link href={href}>
      <div
        className={`cursor-pointer flex items-center ${
          isCollapsed ? "justify-center py-4" : "justify-start px-8 py-4"
        }
          hover:text-blue-500 hover:bg-blue-100 gap-3 transition-colors ${
            isActive ? "bg-blue-200 text-white" : ""
          }
        `}
      >
        <Icon className="w-6 h-6 !text-gray-700" />
        <span
          className={`${
            isCollapsed ? "hidden" : "block"
          } font-medium text-gray-700`}
        >
          {label}
        </span>
      </div>
    </Link>
  );
};
const SidebarDropdown = ({
  href,
  icon: Icon,
  label,
  isCollapsed,
  children,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isCollapsed: boolean;
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const isActive =
    pathname === href || (pathname === "/" && href === "/dashboard");

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="">
      <div
        className={`cursor-pointer flex items-center ${
          isCollapsed ? "justify-center py-4" : "justify-start px-8 py-4"
        }
          hover:text-blue-500 hover:bg-blue-100 gap-3 transition-colors ${
            isActive ? "bg-blue-200 text-white" : ""
          }
        `}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon className="w-6 h-6 !text-gray-700" />
        {!isCollapsed && (
          <>
            <span className="font-medium text-gray-700">{label}</span>
            {isOpen ? (
              <ChevronUp className="ml-auto" />
            ) : (
              <ChevronDown className="ml-auto" />
            )}
          </>
        )}
      </div>
      {isOpen && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
};

const Sidebar = () => {
  const { isSidebarCollapsed, toggleSidebar } = useLayout();
  const sidebarClassNames = `fixed flex flex-col ${
    isSidebarCollapsed ? "w-0 md:w-16" : "w-72 md:w-64"
  } bg-white transition-all duration-300 overflow-hidden h-full shadow-md z-40`;

  return (
    <div className={sidebarClassNames}>
      {/* TOP LOGO */}
      <div
        className={`flex gap-3 justify-between md:justify-normal items-center pt-8 ${
          isSidebarCollapsed ? "px-5 " : "px-8"
        }`}
      >
        <div>
          <Image
            src={vendexyLogo}
            alt="Logo"
            width={120}
            height={120}
            className="rounded-full"
          />
        </div>
        <button
          className="md:hidden px-3 py-3 bg-gray-100 rounded-full hover:bg-blue-100"
          onClick={toggleSidebar}
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
      {/* Links */}

      <div className="flex-grow mt-8">
        <SidebarLink
          href="/"
          icon={Layout}
          label="Home"
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href="/gestao-pedidos"
          isCollapsed={isSidebarCollapsed}
          label="Pedidos de Compra"
          icon={Clipboard}
        />
        <SidebarLink
          href="/fornecedores"
          isCollapsed={isSidebarCollapsed}
          label="Fornecedor"
          icon={Truck}
        />

        <SidebarLink
          icon={Package}
          label="Produtos"
          isCollapsed={isSidebarCollapsed}
          href="/produtos"
        />
        <SidebarLink
          href="/estoque/armazens"
          icon={Warehouse}
          label="Estoque"
          isCollapsed={isSidebarCollapsed}
        />

        <SidebarLink
          icon={ClipboardPaste}
          label="Saídas"
          isCollapsed={isSidebarCollapsed}
          href="/saidas"
        />
      </div>

      {/* Footer */}
      {!isSidebarCollapsed && (
        <div className="mb-10 px-8">
          <p className="text-xs text-gray-500 text-center">
            &copy; 2024 PStock
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
