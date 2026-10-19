"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";

type Motivo = "NAO_CONFIRMADO" | "SKU_DIVERGENTE";

interface VinculoPendente {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlSellerSku: string | null;
  origem: string | null;
  produto: { id: string; nome: string; sku: string } | null;
  motivos: Motivo[];
}

const ROTULO_MOTIVO: Record<Motivo, string> = {
  NAO_CONFIRMADO: "Vínculo por similaridade",
  SKU_DIVERGENTE: "SKU do anúncio diverge",
};

export default function VinculosPendentesPage() {
  const [vinculos, setVinculos] = useState<VinculoPendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [skuTrocaPorId, setSkuTrocaPorId] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch("/api/produtos/vinculos-pendentes");
      if (resposta.ok) setVinculos((await resposta.json()).vinculos);
    } catch (error) {
      console.error("Erro ao carregar vínculos pendentes:", error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const agir = async (id: string, acao: "confirmar" | "rejeitar") => {
    setProcessando(id);
    try {
      const resposta = await fetch("/api/produtos/vinculos-pendentes", {
        method: "PATCH",
        body: JSON.stringify({ id, acao }),
      });
      if (!resposta.ok) throw new Error();
      toast.success(acao === "confirmar" ? "Vínculo confirmado." : "Vínculo desfeito.");
      setVinculos((atual) => atual.filter((v) => v.id !== id));
    } catch {
      toast.error("Erro ao atualizar o vínculo.");
    } finally {
      setProcessando(null);
    }
  };

  const trocarPorSku = async (id: string) => {
    const sku = (skuTrocaPorId[id] ?? "").trim();
    if (!sku) {
      toast.error("Informe o SKU do produto certo.");
      return;
    }
    setProcessando(id);
    try {
      const buscaResposta = await fetch(`/api/produtos?sku=${encodeURIComponent(sku)}`);
      if (!buscaResposta.ok) throw new Error();
      const produto = await buscaResposta.json();
      const novoProdutoId = Array.isArray(produto) ? produto[0]?.id : produto?.id;
      if (!novoProdutoId) {
        toast.error(`Nenhum produto encontrado com o SKU "${sku}".`);
        return;
      }

      const resposta = await fetch("/api/produtos/vinculos-pendentes", {
        method: "PATCH",
        body: JSON.stringify({ id, acao: "trocar", novoProdutoId }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Vínculo trocado.");
      setVinculos((atual) => atual.filter((v) => v.id !== id));
    } catch {
      toast.error("Erro ao trocar o vínculo.");
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="container mx-auto max-w-[1300px] space-y-6 p-6">
      <PageHeader
        eyebrow="Produtos"
        title="Confirme estes vínculos"
        subtitle="Anúncios vinculados por similaridade de título ou com SKU divergente do produto — confirme, troque ou desfaça antes de confiar no CMV dessas vendas."
      />

      <SectionCard title={`${vinculos.length} vínculo(s) pendente(s)`}>
        {carregando ? (
          <Skeleton className="h-[200px] rounded-md" />
        ) : vinculos.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum vínculo pendente de confirmação.
          </div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Anúncio (ML)</DataTableHead>
                <DataTableHead>SKU do anúncio</DataTableHead>
                <DataTableHead>Produto vinculado</DataTableHead>
                <DataTableHead>Motivo</DataTableHead>
                <DataTableHead className="text-right">Ações</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {vinculos.map((v) => (
                <DataTableRow key={v.id}>
                  <DataTableCell>
                    <div className="font-medium">{v.mlTitle}</div>
                    <div className="text-xs text-muted-foreground">{v.mlItemId}</div>
                  </DataTableCell>
                  <DataTableCell>{v.mlSellerSku ?? "—"}</DataTableCell>
                  <DataTableCell>
                    {v.produto ? `${v.produto.nome} (${v.produto.sku})` : "—"}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-1">
                      {v.motivos.map((motivo) => (
                        <StatusPill key={motivo} tone="warning">{ROTULO_MOTIVO[motivo]}</StatusPill>
                      ))}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex flex-wrap justify-end items-center gap-2">
                      <Input
                        className="h-8 w-32"
                        placeholder="SKU certo"
                        value={skuTrocaPorId[v.id] ?? ""}
                        onChange={(e) => setSkuTrocaPorId((atual) => ({ ...atual, [v.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processando === v.id}
                        onClick={() => trocarPorSku(v.id)}
                      >
                        Trocar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processando === v.id}
                        onClick={() => agir(v.id, "rejeitar")}
                      >
                        Desfazer
                      </Button>
                      <Button
                        size="sm"
                        disabled={processando === v.id}
                        onClick={() => agir(v.id, "confirmar")}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>
    </div>
  );
}
