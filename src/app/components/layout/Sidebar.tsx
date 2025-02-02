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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayout } from "../../context/LayoutContext";

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
        <div>Logo</div>
        <h1
          className={`${
            isSidebarCollapsed ? "hidden" : "block"
          } font-extrabold text-2xl
          `}
        >
          PStock
        </h1>

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
        <SidebarDropdown
          icon={Clipboard}
          label="Pedidos de Compra"
          isCollapsed={isSidebarCollapsed}
        >
          <SidebarLink
            href="/pedidos/novo"
            icon={Box}
            label="Novo Pedido"
            isCollapsed={false}
          />
          <SidebarLink
            href="/pedidos/pendentes"
            icon={Box}
            label="Pedidos Pendentes"
            isCollapsed={false}
          />
          <SidebarLink
            href="/pedidos/concluidos"
            icon={Box}
            label="Pedidos Concluídos"
            isCollapsed={false}
          />
        </SidebarDropdown>
        <SidebarDropdown
          icon={Truck}
          label="Fornecedores"
          isCollapsed={isSidebarCollapsed}
        >
          <SidebarLink
            href="/fornecedores/exibirFornecedores"
            icon={Box}
            label="Listar Fornecedores"
            isCollapsed={false}
          />
          <SidebarLink
            href="/fornecedores/fornecedores"
            icon={Box}
            label="Cadastrar Fornecedor"
            isCollapsed={false}
          />
        </SidebarDropdown>
        <SidebarDropdown
          icon={Package}
          label="Produtos"
          isCollapsed={isSidebarCollapsed}
        >
          <SidebarLink
            href="/produtos/cadastrarProdutos"
            icon={Box}
            label="Cadastrar Produto"
            isCollapsed={false}
          />
          <SidebarLink
            href="/produtos/listarProdutos"
            icon={Box}
            label="Listar Produtos"
            isCollapsed={false}
          />
          <SidebarLink
            href="/produtos/listarKits"
            icon={Box}
            label="Listar Kits"
            isCollapsed={false}
          />
        </SidebarDropdown>
        <SidebarLink
          href="/estoque/armazens"
          icon={Layout}
          label="Home"
          isCollapsed={isSidebarCollapsed}
        />

        <SidebarDropdown
          icon={Box}
          label="Saídas"
          isCollapsed={isSidebarCollapsed}
        >
          <SidebarLink
            href="/saidas/novaSaida"
            icon={Box}
            label="Nova Saída"
            isCollapsed={false}
          />
          <SidebarLink
            href="/saidas/registroSaidas"
            icon={Box}
            label="Registro de Saídas"
            isCollapsed={false}
          />
        </SidebarDropdown>
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
