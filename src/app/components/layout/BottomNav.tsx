"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Layout, Package, Megaphone, Wallet, Menu } from "lucide-react";
import { useLayout } from "../../context/LayoutContext";
import { podeVer } from "@/lib/permissoes";

function rotaAtiva(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Barra inferior do celular: Início, Vendas, Estoque, Anúncios e "Mais" (abre a sidebar como folha). Sidebar fica só no desktop. */
const BottomNav = () => {
  const pathname = usePathname();
  const { toggleSidebar } = useLayout();
  const { data: session } = useSession();
  const podeVerFinanceiro = session?.user?.role ? podeVer(session.user.role, "FINANCEIRO_VER") : false;

  const itens = [
    { href: "/", icon: Layout, label: "Início" },
    { href: podeVerFinanceiro ? "/financeiro" : "/mercado-livre/vendas", icon: Wallet, label: "Vendas" },
    { href: "/produtos", icon: Package, label: "Estoque" },
    { href: "/mercado-livre/produtos", icon: Megaphone, label: "Anúncios" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {itens.map((item) => {
        const ativo = rotaAtiva(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] ${
              ativo ? "text-primary" : "text-fg2"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-fg2"
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} />
        Mais
      </button>
    </nav>
  );
};

export default BottomNav;
