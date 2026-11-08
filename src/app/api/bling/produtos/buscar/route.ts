import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { blingErrorResponse } from "@/lib/blingApi";
import { normalizeSku } from "@/lib/sku";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { BlingService } from "@/services/blingService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const termo = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    if (termo.length < 2) return NextResponse.json({ itens: [], localPorEan: null });

    const conta = await prisma.blingAccount.findFirst({
      where: { userId: user.contaId, isActive: true },
      select: { id: true },
    });
    if (!conta) {
      return NextResponse.json({ error: "Conecte o Bling em Integrações para buscar produtos." }, { status: 404 });
    }

    const soDigitos = termo.replace(/\D/g, "");
    const ehEan = soDigitos.length >= 8 && soDigitos.length === termo.replace(/\s/g, "").length;
    const localPorEan = ehEan
      ? await prisma.produto.findFirst({
          where: { userId: user.contaId, ean: BigInt(soDigitos) },
          select: { id: true, nome: true, sku: true },
        })
      : null;

    const encontrados = await BlingService.buscarProdutos(conta.id, termo);

    const locais = await prisma.produto.findMany({
      where: {
        userId: user.contaId,
        OR: [
          { blingId: { in: encontrados.map((p) => String(p.id)) } },
          { sku: { in: encontrados.map((p) => normalizeSku(p.codigo ?? "")).filter(Boolean) } },
        ],
      },
      select: { id: true, nome: true, sku: true, blingId: true },
    });

    const itens = encontrados.map((p) => {
      const local =
        locais.find((l) => l.blingId === String(p.id)) ??
        locais.find((l) => !l.blingId && l.sku === normalizeSku(p.codigo ?? ""));
      return {
        blingId: p.id,
        nome: p.nome,
        sku: p.codigo,
        preco: p.preco != null ? Math.round(p.preco * 100) : null,
        precoCusto: p.precoCusto != null ? Math.round(p.precoCusto * 100) : null,
        ehKit: BlingService.isKit(p),
        ativo: BlingService.isProductActive(p),
        imagemUrl: normalizeImageUrl(p.imagemURL ?? null),
        jaCadastrado: local ? { id: local.id, nome: local.nome } : null,
      };
    });

    return NextResponse.json({ itens, localPorEan });
  } catch (error) {
    const permissao = permissaoErrorResponse(error);
    if (permissao) return permissao;
    return blingErrorResponse(error);
  }
}
