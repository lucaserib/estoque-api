"use client";

import React, { useState } from "react";
import {
  Layout,
  Package,
  Clipboard,
  Truck,
  Warehouse,
  Menu,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Settings,
  ArrowLeftRight,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { MercadoLivreIcon } from "@/components/ui/mercado-livre-icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayout } from "../../context/LayoutContext";
import { Logo } from "@/components/brand/Logo";

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
        className={`relative cursor-pointer flex items-center ${
          isCollapsed ? "justify-center py-3" : "justify-start px-6 py-3"
        } gap-3 transition-colors ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary" />
        )}
        <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
        <span className={`${isCollapsed ? "hidden" : "block"} font-medium`}>
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
    <div>
      <div
        className={`relative cursor-pointer flex items-center ${
          isCollapsed ? "justify-center py-3" : "justify-start px-6 py-3"
        } gap-3 transition-colors ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon className="w-5 h-5" />
        {!isCollapsed && (
          <>
            <span className="font-medium">{label}</span>
            {isOpen ? (
              <ChevronUp className="ml-auto w-4 h-4" />
            ) : (
              <ChevronDown className="ml-auto w-4 h-4" />
            )}
          </>
        )}
      </div>
      {isOpen && !isCollapsed && <div className="space-y-1">{children}</div>}
    </div>
  );
};

const SidebarSubLink = ({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href}>
      <div
        className={`relative cursor-pointer flex items-center pl-12 pr-6 py-2.5 gap-3 transition-colors ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary" />
        )}
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </Link>
  );
};

const SectionLabel = ({
  children,
  isCollapsed,
}: {
  children: React.ReactNode;
  isCollapsed: boolean;
}) => {
  if (isCollapsed) return null;
  return (
    <p className="px-6 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
};

const Sidebar = () => {
  const { isSidebarCollapsed, toggleSidebar } = useLayout();
  const sidebarClassNames = `fixed flex flex-col ${
    isSidebarCollapsed ? "w-0 md:w-16" : "w-72 md:w-64"
  } bg-card border-r border-border transition-all duration-300 overflow-hidden h-full z-40`;

  return (
    <div className={sidebarClassNames}>
      {/* TOP LOGO */}
      <div
        className={`flex gap-3 justify-between md:justify-normal items-center pt-6 pb-2 ${
          isSidebarCollapsed ? "px-4" : "px-6"
        }`}
      >
        <Link href="/dashboard" aria-label="Estoca — início">
          <Logo size="md" iconOnly={isSidebarCollapsed} />
        </Link>
        <button
          className="md:hidden px-3 py-3 bg-muted rounded-full hover:bg-accent"
          onClick={toggleSidebar}
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Links */}
      <div className="flex-grow mt-4">
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
          icon={TrendingDown}
          label="Reposição"
          isCollapsed={isSidebarCollapsed}
          href="/reposicao"
        />

        <SidebarDropdown
          icon={Warehouse}
          label="Estoque"
          isCollapsed={isSidebarCollapsed}
        >
          <SidebarSubLink
            href="/estoque/armazens"
            icon={Warehouse}
            label="Gestão de Armazéns"
          />
          <SidebarSubLink
            href="/estoque/transferencias"
            icon={ArrowLeftRight}
            label="Transferências"
          />
        </SidebarDropdown>

        <SidebarLink
          icon={ClipboardPaste}
          label="Saídas"
          isCollapsed={isSidebarCollapsed}
          href="/saidas"
        />

        {/* Canais de venda — preparado para futuros marketplaces */}
        <SectionLabel isCollapsed={isSidebarCollapsed}>Canais</SectionLabel>
        <SidebarDropdown
          icon={MercadoLivreIcon}
          label="Mercado Livre"
          isCollapsed={isSidebarCollapsed}
        >
          <SidebarSubLink
            href="/mercado-livre"
            icon={Layout}
            label="Dashboard"
          />
          <SidebarSubLink
            href="/mercado-livre/vendas"
            icon={BarChart3}
            label="Análise de Vendas"
          />
          <SidebarSubLink
            href="/mercado-livre/produtos"
            icon={Package}
            label="Produtos"
          />
          <SidebarSubLink
            href="/mercado-livre/configuracoes"
            icon={Settings}
            label="Configurações"
          />
        </SidebarDropdown>
      </div>

      {/* Footer */}
      {!isSidebarCollapsed && (
        <div className="mb-8 px-6">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Estoca
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
