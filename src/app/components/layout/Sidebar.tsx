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
  Zap,
  Users,
  Wallet,
} from "lucide-react";
import { MercadoLivreIcon } from "@/components/ui/mercado-livre-icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLayout } from "../../context/LayoutContext";
import { Logo } from "@/components/brand/Logo";
import { podeVer } from "@/lib/permissoes";

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
        className={`mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg transition-colors ${
          isCollapsed ? "justify-center py-2.5" : "px-2.5 py-2"
        } ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "font-normal text-fg2 hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon className="h-[17px] w-[17px] shrink-0 opacity-90" />
        <span className={`${isCollapsed ? "hidden" : "block"} text-[13.5px]`}>
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
        className={`mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg transition-colors ${
          isCollapsed ? "justify-center py-2.5" : "px-2.5 py-2"
        } ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "font-normal text-fg2 hover:bg-muted hover:text-foreground"
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon className="h-[17px] w-[17px] shrink-0 opacity-90" />
        {!isCollapsed && (
          <>
            <span className="text-[13.5px]">{label}</span>
            {isOpen ? (
              <ChevronUp className="ml-auto h-4 w-4 opacity-60" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 opacity-60" />
            )}
          </>
        )}
      </div>
      {isOpen && !isCollapsed && <div className="mt-0.5 space-y-0.5">{children}</div>}
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
        className={`mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg py-2 pl-8 pr-2.5 transition-colors ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "font-normal text-fg2 hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-90" />
        <span className="text-[13px]">{label}</span>
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
    <p className="px-4 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
      {children}
    </p>
  );
};

const Sidebar = () => {
  const { isSidebarCollapsed, toggleSidebar } = useLayout();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const papel = session?.user?.role;
  const podeVerFinanceiro = papel ? podeVer(papel, "FINANCEIRO_VER") : false;
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
        <Link href="/dashboard" aria-label="Leap Stock — início">
          <Logo size="md" variant={isSidebarCollapsed ? "mark" : "full"} />
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
        <SectionLabel isCollapsed={isSidebarCollapsed}>Operação</SectionLabel>
        <SidebarLink
          href="/"
          icon={Layout}
          label="Visão geral"
          isCollapsed={isSidebarCollapsed}
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
        <SidebarLink
          icon={ClipboardPaste}
          label="Saídas"
          isCollapsed={isSidebarCollapsed}
          href="/saidas"
        />
        <SidebarLink
          href="/gestao-pedidos"
          isCollapsed={isSidebarCollapsed}
          label="Pedidos de compra"
          icon={Clipboard}
        />
        <SidebarLink
          href="/fornecedores"
          isCollapsed={isSidebarCollapsed}
          label="Fornecedores"
          icon={Truck}
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

        <SectionLabel isCollapsed={isSidebarCollapsed}>Canais</SectionLabel>
        <SidebarDropdown
          icon={MercadoLivreIcon}
          label="Mercado Livre"
          isCollapsed={isSidebarCollapsed}
        >
          <SidebarSubLink
            href="/mercado-livre"
            icon={Layout}
            label="Painel"
          />
          <SidebarSubLink
            href="/mercado-livre/vendas"
            icon={BarChart3}
            label="Vendas"
          />
          <SidebarSubLink
            href="/mercado-livre/produtos"
            icon={Package}
            label="Anúncios e vínculos"
          />
          <SidebarSubLink
            href="/mercado-livre/configuracoes"
            icon={Settings}
            label="Configurações"
          />
        </SidebarDropdown>

        {podeVerFinanceiro && (
          <>
            <SectionLabel isCollapsed={isSidebarCollapsed}>
              Financeiro
            </SectionLabel>
            <SidebarLink
              href="/financeiro"
              icon={Wallet}
              label="Financeiro"
              isCollapsed={isSidebarCollapsed}
            />
          </>
        )}

        <SectionLabel isCollapsed={isSidebarCollapsed}>Sistema</SectionLabel>
        <SidebarLink
          href="/integracoes"
          icon={Zap}
          label="Integrações"
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href="/configuracoes"
          icon={Settings}
          label="Configurações"
          isCollapsed={isSidebarCollapsed}
        />
        {isAdmin && (
          <SidebarLink
            href="/usuarios"
            icon={Users}
            label="Usuários"
            isCollapsed={isSidebarCollapsed}
          />
        )}
      </div>

      {/* Footer */}
      {!isSidebarCollapsed && (
        <div className="mb-8 px-6">
          <p className="text-xs text-faint text-center">
            &copy; {new Date().getFullYear()} Leap Stock
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
