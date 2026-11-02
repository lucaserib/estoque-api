"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Layout,
  Package,
  Clipboard,
  Truck,
  Warehouse,
  X,
  ChevronDown,
  ClipboardPaste,
  Settings,
  ArrowLeftRight,
  TrendingDown,
  BarChart3,
  Zap,
  Users,
  Wallet,
  FileBarChart,
  CreditCard,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
  HeartPulse,
  Megaphone,
  Compass,
} from "lucide-react";
import { MercadoLivreIcon } from "@/components/ui/mercado-livre-icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLayout } from "../../context/LayoutContext";
import { Logo } from "@/components/brand/Logo";
import { podeVer } from "@/lib/permissoes";

type Icone = React.ComponentType<{ className?: string }>;

interface ItemMenu {
  href: string;
  icon: Icone;
  label: string;
  visivel?: boolean;
  dataTour?: string;
}

/** Agrupa itens relacionados dentro de um SidebarGrupo já aberto (ex.: Financeiro → "Caixa"). */
interface ClusterMenu {
  cluster: string;
  itens: ItemMenu[];
  visivel?: boolean;
}

type EntradaMenu = ItemMenu | ClusterMenu;

function isCluster(entrada: EntradaMenu): entrada is ClusterMenu {
  return "cluster" in entrada;
}

function achatarItens(entradas: EntradaMenu[]): ItemMenu[] {
  return entradas.flatMap((entrada) => (isCluster(entrada) ? entrada.itens : [entrada]));
}

/** Rota ativa: igual, ou um sub-caminho (ex.: /produtos/123 acende Produtos). */
function rotaAtiva(pathname: string, href: string, exata = false): boolean {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  if (pathname === href) return true;
  return !exata && pathname.startsWith(`${href}/`);
}

const classeItem = (ativo: boolean, recolhida: boolean) =>
  `mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg transition-colors ${
    recolhida ? "justify-center py-2.5" : "px-2.5 py-2"
  } ${
    ativo
      ? "bg-primary/10 font-medium text-primary"
      : "font-normal text-fg2 hover:bg-muted hover:text-foreground"
  }`;

const SidebarLink = ({
  item,
  recolhida,
  onNavegar,
}: {
  item: ItemMenu;
  recolhida: boolean;
  onNavegar: () => void;
}) => {
  const pathname = usePathname();
  const ativo = rotaAtiva(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavegar}
      title={recolhida ? item.label : undefined}
      data-tour={item.dataTour}
    >
      <div className={classeItem(ativo, recolhida)}>
        <Icon className="h-[17px] w-[17px] shrink-0 opacity-90" />
        {!recolhida && <span className="truncate text-[13.5px]">{item.label}</span>}
      </div>
    </Link>
  );
};

const SubItemLink = ({ item, pathname }: { item: ItemMenu; pathname: string }) => {
  const ativo = rotaAtiva(pathname, item.href, true);
  const SubIcon = item.icon;
  return (
    <Link href={item.href}>
      <div
        className={`mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pl-8 pr-2.5 transition-colors ${
          ativo
            ? "bg-primary/10 font-medium text-primary"
            : "font-normal text-fg2 hover:bg-muted hover:text-foreground"
        }`}
      >
        <SubIcon className="h-4 w-4 shrink-0 opacity-90" />
        <span className="truncate text-[13px]">{item.label}</span>
      </div>
    </Link>
  );
};

const SidebarGrupo = ({
  icon: Icon,
  label,
  itens,
  recolhida,
  onNavegar,
}: {
  icon: Icone;
  label: string;
  itens: EntradaMenu[];
  recolhida: boolean;
  onNavegar: () => void;
}) => {
  const pathname = usePathname();
  const visiveis = itens.filter((i) => i.visivel !== false);
  const folhas = achatarItens(visiveis);
  const algumFilhoAtivo = folhas.some((i) => rotaAtiva(pathname, i.href));
  const [aberto, setAberto] = useState(algumFilhoAtivo);

  // Abre sozinho quando o usuário chega numa rota do grupo por outro caminho (link, busca, notificação).
  useEffect(() => {
    if (algumFilhoAtivo) setAberto(true);
  }, [algumFilhoAtivo]);

  if (visiveis.length === 0 || folhas.length === 0) return null;

  // Recolhida (desktop): não há espaço para submenu — o ícone leva direto à primeira tela do grupo.
  if (recolhida) {
    return (
      <Link href={folhas[0].href} onClick={onNavegar} title={label}>
        <div className={classeItem(algumFilhoAtivo, true)}>
          <Icon className="h-[17px] w-[17px] shrink-0 opacity-90" />
        </div>
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={aberto}
        className={`${classeItem(algumFilhoAtivo && !aberto, false)} w-[calc(100%-1rem)] text-left`}
        onClick={() => setAberto((v) => !v)}
      >
        <Icon className="h-[17px] w-[17px] shrink-0 opacity-90" />
        <span className="truncate text-[13.5px]">{label}</span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 opacity-60 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>
      {aberto && (
        <div className="mt-0.5 space-y-2">
          {visiveis.map((entrada) =>
            isCluster(entrada) ? (
              <div key={entrada.cluster}>
                <p className="mx-2 px-6 pb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
                  {entrada.cluster}
                </p>
                <div className="space-y-0.5">
                  {entrada.itens
                    .filter((i) => i.visivel !== false)
                    .map((item) => (
                      <SubItemLink key={item.href} item={item} pathname={pathname} />
                    ))}
                </div>
              </div>
            ) : (
              <SubItemLink key={entrada.href} item={entrada} pathname={pathname} />
            )
          )}
        </div>
      )}
    </div>
  );
};

const SectionLabel = ({ children, recolhida }: { children: React.ReactNode; recolhida: boolean }) => {
  if (recolhida) return <div className="mx-4 my-3 h-px bg-border" />;
  return (
    <p className="px-4 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
      {children}
    </p>
  );
};

const Sidebar = () => {
  const { isSidebarCollapsed: recolhida, toggleSidebar, closeSidebarOnMobile, nomeLoja, logoUrl } =
    useLayout();
  const { data: session } = useSession();
  const papel = session?.user?.role;
  const isAdmin = papel === "ADMIN";
  const podeVerFinanceiro = papel ? podeVer(papel, "FINANCEIRO_VER") : false;

  return (
    <>
      {/* Fundo escurecido só no celular, quando a sidebar está aberta por cima do conteúdo */}
      {!recolhida && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r border-border bg-card transition-[width,transform] duration-300 ${
          recolhida
            ? "w-72 -translate-x-full md:w-16 md:translate-x-0"
            : "w-72 translate-x-0 md:w-64"
        }`}
      >
        {/* Topo fixo */}
        <div
          className={`flex shrink-0 items-center justify-between gap-3 pb-2 pt-6 ${
            recolhida ? "px-4 md:justify-center" : "px-5"
          }`}
        >
          <Link href="/dashboard" aria-label="Skubo — início" onClick={closeSidebarOnMobile} data-tour="logo">
            <div className="flex items-center gap-2">
              <Logo size="md" variant={recolhida ? "mark" : "full"} />
              {!recolhida && logoUrl && (
                <>
                  <div className="h-5 w-px bg-border" />
                  <Image
                    src={logoUrl}
                    alt={nomeLoja ?? "Logo da loja"}
                    width={28}
                    height={28}
                    unoptimized
                    className="h-6 w-6 rounded object-contain"
                  />
                </>
              )}
              {!recolhida && nomeLoja && (
                <span className="max-w-[90px] truncate text-[13px] font-medium text-muted-foreground">
                  {nomeLoja}
                </span>
              )}
            </div>
          </Link>
          <button
            className="rounded-full bg-muted p-2 hover:bg-accent md:hidden"
            onClick={toggleSidebar}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista rola sozinha: com grupos abertos em tela baixa nada some */}
        <nav className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          <SectionLabel recolhida={recolhida}>Início</SectionLabel>
          <SidebarLink item={{ href: "/", icon: Layout, label: "Visão geral" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/comecar", icon: Compass, label: "Configurar minha loja", dataTour: "comecar" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />

          <SectionLabel recolhida={recolhida}>Vendas e lucro</SectionLabel>
          <SidebarGrupo
            icon={MercadoLivreIcon}
            label="Mercado Livre"
            recolhida={recolhida}
            onNavegar={closeSidebarOnMobile}
            itens={[
              { href: "/mercado-livre", icon: Layout, label: "Painel" },
              { href: "/mercado-livre/vendas", icon: BarChart3, label: "Vendas" },
            ]}
          />
          {podeVerFinanceiro && (
            <SidebarGrupo
              icon={Wallet}
              label="Financeiro"
              recolhida={recolhida}
              onNavegar={closeSidebarOnMobile}
              itens={[
                {
                  cluster: "Resultado/DRE",
                  itens: [
                    { href: "/financeiro", icon: Layout, label: "Visão geral" },
                    { href: "/financeiro/dre", icon: FileBarChart, label: "DRE" },
                  ],
                },
                {
                  cluster: "Vendas",
                  itens: [
                    { href: "/financeiro/vendas", icon: BarChart3, label: "Lucro por venda" },
                    { href: "/financeiro/produtos", icon: Package, label: "Lucro por produto" },
                  ],
                },
                {
                  cluster: "Caixa",
                  itens: [
                    { href: "/financeiro/fluxo-de-caixa", icon: ArrowLeftRight, label: "Fluxo de caixa" },
                    { href: "/financeiro/lancamentos", icon: ClipboardPaste, label: "Lançamentos" },
                    { href: "/financeiro/cartoes", icon: CreditCard, label: "Cartões" },
                  ],
                },
                { href: "/financeiro/conferencia", icon: ClipboardCheck, label: "Conferência", visivel: isAdmin },
                { href: "/financeiro/configuracoes", icon: Settings, label: "Ajustes do financeiro" },
              ]}
            />
          )}

          <SectionLabel recolhida={recolhida}>Estoque e compras</SectionLabel>
          <SidebarLink item={{ href: "/produtos", icon: Package, label: "Produtos" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/reposicao", icon: TrendingDown, label: "Reposição" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/saidas", icon: ClipboardPaste, label: "Saídas" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/gestao-pedidos", icon: Clipboard, label: "Pedidos de compra" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/fornecedores", icon: Truck, label: "Fornecedores" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarGrupo
            icon={Warehouse}
            label="Estoque"
            recolhida={recolhida}
            onNavegar={closeSidebarOnMobile}
            itens={[
              { href: "/estoque/armazens", icon: Warehouse, label: "Armazéns" },
              { href: "/estoque/transferencias", icon: ArrowLeftRight, label: "Transferências" },
            ]}
          />

          <SectionLabel recolhida={recolhida}>Anúncios</SectionLabel>
          <SidebarLink item={{ href: "/mercado-livre/produtos", icon: Megaphone, label: "Anúncios e vínculos" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/mercado-livre/configuracoes", icon: Settings, label: "Configurações do ML" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />

          <SectionLabel recolhida={recolhida}>Ajustes</SectionLabel>
          <SidebarLink item={{ href: "/integracoes", icon: Zap, label: "Integrações" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/saude-dados", icon: HeartPulse, label: "Saúde dos dados" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          <SidebarLink item={{ href: "/configuracoes-gerais", icon: Settings, label: "Configurações" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          {isAdmin && (
            <SidebarLink item={{ href: "/usuarios", icon: Users, label: "Usuários" }} recolhida={recolhida} onNavegar={closeSidebarOnMobile} />
          )}
        </nav>

        {/* Rodapé fixo: recolher/expandir no desktop */}
        <div className="hidden shrink-0 border-t border-border p-2 md:block">
          <button
            type="button"
            onClick={toggleSidebar}
            className={`flex w-full items-center gap-2.5 rounded-lg py-2 text-fg2 hover:bg-muted hover:text-foreground ${
              recolhida ? "justify-center" : "px-2.5"
            }`}
            aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
            title={recolhida ? "Expandir menu" : "Recolher menu"}
          >
            {recolhida ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!recolhida && <span className="text-[13px]">Recolher menu</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
