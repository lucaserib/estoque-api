import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CapturaOrigem } from "@/components/publico/CapturaOrigem";
import { ConsentimentoCookies } from "@/components/publico/ConsentimentoCookies";

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <CapturaOrigem />
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/planos" aria-label="Skubo">
            <Logo size="sm" />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-muted">
              Entrar
            </Link>
            <Link href="/register" className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90">
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Skubo</span>
          <Link href="/planos" className="hover:text-foreground">Planos</Link>
          <Link href="/termos" className="hover:text-foreground">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
          <Link href="/indique/regulamento" className="hover:text-foreground">Regulamento do Indique e ganhe</Link>
        </div>
      </footer>
      <ConsentimentoCookies />
    </div>
  );
}
