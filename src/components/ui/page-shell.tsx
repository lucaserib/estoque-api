"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PageShellAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  variant?: ButtonProps["variant"];
}

interface PageShellProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  updatedAt?: Date | string | null;
  actions?: PageShellAction[];
  filters?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

function BotaoAcao({ acao }: { acao: PageShellAction }) {
  const Icon = acao.icon;
  const conteudo = (
    <>
      {Icon && <Icon className="h-4 w-4" />}
      {acao.label}
    </>
  );
  if (acao.href) {
    return (
      <Button asChild variant={acao.variant ?? "outline"} size="sm" className="gap-2">
        <Link href={acao.href}>{conteudo}</Link>
      </Button>
    );
  }
  return (
    <Button variant={acao.variant ?? "outline"} size="sm" className="gap-2" onClick={acao.onClick}>
      {conteudo}
    </Button>
  );
}

export function PageShell({
  title,
  eyebrow,
  subtitle,
  updatedAt,
  actions,
  filters,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 flex items-center gap-1.5 text-xs">
              <span className="text-faint">{eyebrow}</span>
              <span className="text-border">/</span>
              <span className="text-muted-foreground">{title}</span>
            </div>
          )}
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {(subtitle || updatedAt) && (
            <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
              {subtitle}
              {subtitle && updatedAt && " · "}
              {updatedAt && `atualizado ${formatRelativeTime(updatedAt)}`}
            </p>
          )}
        </div>

        {actions && actions.length > 0 && (
          <>
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              {actions.map((acao) => (
                <BotaoAcao key={acao.label} acao={acao} />
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="sm:hidden">
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((acao) => (
                  <DropdownMenuItem
                    key={acao.label}
                    onClick={acao.href ? undefined : acao.onClick}
                    asChild={!!acao.href}
                  >
                    {acao.href ? (
                      <Link href={acao.href} className="flex items-center gap-2">
                        {acao.icon && <acao.icon className="h-4 w-4" />}
                        {acao.label}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2">
                        {acao.icon && <acao.icon className="h-4 w-4" />}
                        {acao.label}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}

      {children}
    </div>
  );
}
