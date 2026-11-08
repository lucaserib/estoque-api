"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Building2, LayoutDashboard, LogOut, MessageSquareWarning } from "lucide-react";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const NAVEGACAO = [
  { href: "/admin", rotulo: "Visão geral", icone: LayoutDashboard },
  { href: "/admin/contas", rotulo: "Contas", icone: Building2 },
  { href: "/admin/ia/feedback", rotulo: "Feedback da IA", icone: MessageSquareWarning },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const caminho = usePathname();
  const ativo = (href: string) => (href === "/admin" ? caminho === "/admin" || caminho === "/" : caminho.startsWith(href));

  return (
    <div className="min-h-screen bg-background bg-app text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2" aria-label="Skubo Admin">
            <Logo size="sm" />
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              Admin
            </span>
          </Link>
          <nav className="ml-2 flex items-center gap-1 overflow-x-auto">
            {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
                  ativo(href) ? "bg-primary/10 font-semibold text-primary" : "text-fg2 hover:bg-muted hover:text-foreground"
                )}
              >
                <Icone className="h-4 w-4" />
                <span className="hidden sm:inline">{rotulo}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:inline">{email}</span>
            <a
              href={process.env.NEXT_PUBLIC_APP_URL || "/"}
              className="hidden items-center gap-1 rounded-xl px-3 py-2 text-sm text-fg2 hover:bg-muted sm:flex"
            >
              Abrir o app <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-xl p-2 text-fg2 hover:bg-muted"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
