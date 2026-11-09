import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);
    const { nome, cnpj, inscricaoEstadual, contato, endereco } =
      await req.json();

    if (!nome) {
      return NextResponse.json(
        { error: "Nome do fornecedor é orbigatorio" },
        { status: 400 }
      );
    }
    const fornecedor = await prisma.fornecedor.create({
      data: {
        nome,
        cnpj,
        inscricaoEstadual,
        contato,
        endereco,
        userId: user.contaId,
      },
    });

    return NextResponse.json(fornecedor, { status: 201 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    return NextResponse.json(
      { error: "Erro ao criar fonecedor" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);

    const fornecedores = await prisma.fornecedor.findMany({
      where: { userId: user.contaId },
    });
    return NextResponse.json(fornecedores, { status: 200 });
  } catch (erroAcesso) {
    const respostaAcesso = permissaoErrorResponse(erroAcesso);
    if (respostaAcesso) return respostaAcesso;
    return NextResponse.json({ error: "Erro ao buscar Fornecedor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const forceDelete = searchParams.get("force") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "ID do fornecedor é obrigatório" },
        { status: 400 }
      );
    }

    const fornecedor = await prisma.fornecedor.findFirst({
      where: {
        id: id,
        userId: user.contaId,
      },
      include: {
        pedidos: {
          include: {
            produtos: true,
          },
        },
        produtos: true,
      },
    });

    if (!fornecedor) {
      return NextResponse.json(
        { error: "Fornecedor não encontrado ou não pertence a este usuário" },
        { status: 404 }
      );
    }

    if (fornecedor.pedidos.length > 0 || fornecedor.produtos.length > 0) {
      if (!forceDelete) {
        return NextResponse.json(
          {
            error: "Fornecedor possui vínculos com pedidos ou produtos",
            hasOrders: fornecedor.pedidos.length > 0,
            hasProducts: fornecedor.produtos.length > 0,
            fornecedorId: fornecedor.id,
          },
          { status: 409 }
        );
      }

      await prisma.$transaction(async (tx) => {
        for (const pedido of fornecedor.pedidos) {
          await tx.pedidoProduto.deleteMany({
            where: { pedidoId: pedido.id },
          });
        }

        await tx.pedidoCompra.deleteMany({
          where: { fornecedorId: id },
        });

        await tx.produtoFornecedor.deleteMany({
          where: { fornecedorId: id },
        });

        await tx.fornecedor.delete({
          where: { id: id },
        });
      });
    } else {
      await prisma.fornecedor.delete({
        where: { id: id },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao deletar fornecedor:", error);
    return NextResponse.json(
      {
        error: "Erro ao deletar fornecedor",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const { nome, cnpj, inscricaoEstadual, contato, endereco } =
      await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID do fornecedor é obrigatório" },
        { status: 400 }
      );
    }

    if (!nome) {
      return NextResponse.json(
        { error: "Nome do fornecedor é obrigatório" },
        { status: 400 }
      );
    }

    const fornecedor = await prisma.fornecedor.findFirst({
      where: {
        id: id,
        userId: user.contaId,
      },
    });

    if (!fornecedor) {
      return NextResponse.json(
        { error: "Fornecedor não encontrado ou não pertence a este usuário" },
        { status: 404 }
      );
    }

    const updatedFornecedor = await prisma.fornecedor.update({
      where: { id: id },
      data: {
        nome,
        cnpj,
        inscricaoEstadual,
        contato,
        endereco,
      },
    });

    return NextResponse.json(updatedFornecedor, { status: 200 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar fornecedor" },
      { status: 500 }
    );
  }
}
