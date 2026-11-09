"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, KanbanSquare, Lightbulb, List, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/operacao", rotulo: "Meu dia", icone: Sun, exata: true },
  { href: "/operacao/quadros", rotulo: "Quadros", icone: KanbanSquare },
  { href: "/operacao/lista", rotulo: "Lista", icone: List },
  { href: "/operacao/calendario", rotulo: "Calendário", icone: CalendarDays },
  { href: "/operacao/ideias", rotulo: "Ideias e notas", icone: Lightbulb },
];

export function NavegacaoOperacao() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções da operação" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {ABAS.map((aba) => {
          const ativa = aba.exata ? pathname === aba.href : pathname === aba.href || pathname.startsWith(`${aba.href}/`);
          const Icone = aba.icone;
          return (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={ativa ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                  ativa ? "border-primary text-primary" : "border-transparent text-fg2 hover:text-foreground"
                )}
              >
                <Icone className="h-4 w-4" aria-hidden="true" />
                {aba.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
