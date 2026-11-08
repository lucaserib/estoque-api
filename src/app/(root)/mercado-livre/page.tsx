"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { ProductImage } from "@/components/ui/product-image";
import { Store, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { BotaoExplicarIa } from "@/components/ia/BotaoExplicarIa";
import { SincronizacaoCatalogo } from "@/components/sincronizacao/SincronizacaoCatalogo";
import type {
  CategoriaProblemaAnuncio,
  SaudeAnunciosResultado,
} from "@/services/saudeAnunciosService";

const TONE_POR_CATEGORIA: Record<
  CategoriaProblemaAnuncio,
  "critical" | "warning" | "neutral"
> = {
  PRECO_ABAIXO_CUSTO: "critical",
  SEM_ESTOQUE: "critical",
  FULL_BAIXO: "warning",
  PAUSADO: "warning",
  SEM_VINCULO: "neutral",
  SEM_TARIFA_FRETE: "neutral",
};

export default function MercadoLivrePage() {
  const { status } = useSession();
  const [temConta, setTemConta] = useState<boolean | null>(null);
  const [dados, setDados] = useState<SaudeAnunciosResultado | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarContas = useCallback(async () => {
    try {
      const res = await fetch("/api/mercadolivre/auth?action=accounts", {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const lista = Array.isArray(data) ? data : data.accounts || [];
      setTemConta(lista.length > 0);
    } catch {
      setTemConta(false);
    }
  }, []);

  const carregarSaude = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/mercadolivre/saude-anuncios");
      if (res.ok) setDados(await res.json());
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    carregarContas();
    carregarSaude();
  }, [status, carregarContas, carregarSaude]);

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/mercadolivre/auth?action=connect", {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.location.href = data.authUrl;
    } catch {
      toast.error("Erro ao conectar conta do Mercado Livre");
    }
  };

  if (status === "loading" || temConta === null) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-6">
        <PageHeader title="Saúde dos anúncios" subtitle="Mercado Livre" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!temConta) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <PageHeader title="Saúde dos anúncios" subtitle="Mercado Livre" />
        <Card>
          <CardContent className="p-10 text-center">
            <Store className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">
              Conecte sua conta do Mercado Livre
            </h3>
            <p className="mb-6 text-muted-foreground">
              Assim que conectar, mostramos aqui tudo que precisa de atenção nos seus anúncios.
            </p>
            <Button onClick={handleConnect}>
              <Store className="mr-2 h-4 w-4" />
              Conectar Mercado Livre
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const semProblemas = dados && dados.grupos.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      <PageHeader
        title="Saúde dos anúncios"
        subtitle={
          dados
            ? `${dados.totalAtivos} anúncio${dados.totalAtivos === 1 ? "" : "s"} ativo${dados.totalAtivos === 1 ? "" : "s"}`
            : "Mercado Livre"
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dados && dados.grupos.length > 0 && (
              <BotaoExplicarIa
                pedido={{ tipo: "anuncios" }}
                rotulo="Plano de ação"
                perguntaAssistente="Quais anúncios estão perdendo venda e o que eu faço primeiro?"
              />
            )}
            <SincronizacaoCatalogo onConcluido={carregarSaude} compacto />
          </div>
        }
      />

      {carregando && !dados ? (
        <>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </>
      ) : semProblemas ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-success-text" />
            <h3 className="text-lg font-semibold">Nenhum problema encontrado</h3>
            <p className="text-muted-foreground">
              Todos os anúncios ativos têm estoque, vínculo, tarifa, frete e margem em dia.
            </p>
          </CardContent>
        </Card>
      ) : (
        dados?.grupos.map((grupo) => (
          <SectionCard
            key={grupo.categoria}
            title={grupo.titulo}
            description={grupo.descricao}
            actions={
              <div className="flex items-center gap-2">
                <StatusPill tone={TONE_POR_CATEGORIA[grupo.categoria]}>
                  {grupo.anuncios.length}
                </StatusPill>
                <Link href={grupo.linkFiltro}>
                  <Button variant="outline" size="sm">
                    {grupo.acao}
                  </Button>
                </Link>
              </div>
            }
          >
            <div className="divide-y divide-border">
              {grupo.anuncios.slice(0, 5).map((anuncio) => (
                <div
                  key={anuncio.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <ProductImage src={anuncio.mlThumbnail} alt={anuncio.mlTitle} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{anuncio.mlTitle}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {anuncio.produtoSku ?? "sem SKU vinculado"}
                    </p>
                  </div>
                  {anuncio.produtoId ? (
                    <Link href={`/produtos/${anuncio.produtoId}`}>
                      <Button variant="ghost" size="sm">
                        Ver produto
                      </Button>
                    </Link>
                  ) : (
                    anuncio.mlPermalink && (
                      <a href={anuncio.mlPermalink} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm">
                          Ver no ML
                        </Button>
                      </a>
                    )
                  )}
                </div>
              ))}
              {grupo.anuncios.length > 5 && (
                <p className="pt-2.5 text-sm text-muted-foreground">
                  + {grupo.anuncios.length - 5} outro{grupo.anuncios.length - 5 === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </SectionCard>
        ))
      )}
    </div>
  );
}
