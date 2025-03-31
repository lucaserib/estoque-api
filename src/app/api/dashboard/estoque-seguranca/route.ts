import { verifyUser } from "@/helpers/verifyUser";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("Iniciando requisição para estoque-seguranca");
    const user = await verifyUser(request);
    console.log("Usuário verificado:", user.id);

    const produtosCriticos = await prisma.estoque.findMany({
      where: {
        armazem: { userId: user.id },
        quantidade: { lte: prisma.estoque.fields.estoqueSeguranca },
      },
      include: {
        produto: true,
        armazem: true,
      },
    });
    console.log("Produtos críticos encontrados:", produtosCriticos.length);

    const response = produtosCriticos.map((item) => ({
      id: item.produto.id,
      nome: item.produto.nome,
      sku: item.produto.sku,
      quantidade: item.quantidade,
      estoqueSeguranca: item.estoqueSeguranca ?? 0,
      armazem: item.armazem.nome,
    }));

    console.log("Enviando resposta com", response.length, "produtos críticos");
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar produtos no estoque de segurança:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos no estoque de segurança" },
      { status: 500 }
    );
  }
}
