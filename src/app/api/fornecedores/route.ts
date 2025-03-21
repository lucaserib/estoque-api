import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);
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
        userId: user.id,
      },
    });

    return NextResponse.json(fornecedor, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao criar fonecedor" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const fornecedores = await prisma.fornecedor.findMany({
      where: { userId: user.id },
    });
    return NextResponse.json(fornecedores, { status: 200 });
  } catch {
    NextResponse.json({ error: "Erro ao buscar Fornecedor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    // Parâmetro opcional para determinar se deve forçar a exclusão de vínculos
    const forceDelete = searchParams.get("force") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "ID do fornecedor é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se o fornecedor existe e pertence ao usuário
    const fornecedor = await prisma.fornecedor.findFirst({
      where: {
        id: id,
        userId: user.id,
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

    // Verificar se o fornecedor possui vínculos
    if (fornecedor.pedidos.length > 0 || fornecedor.produtos.length > 0) {
      // Se tem vínculos e não foi solicitada exclusão forçada, retornar erro
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

      // Caso contrário, executar exclusão em cascata em uma transação
      await prisma.$transaction(async (tx) => {
        // 1. Primeiro, remover todos os produtos dos pedidos
        for (const pedido of fornecedor.pedidos) {
          await tx.pedidoProduto.deleteMany({
            where: { pedidoId: pedido.id },
          });
        }

        // 2. Depois, remover todos os pedidos
        await tx.pedidoCompra.deleteMany({
          where: { fornecedorId: id },
        });

        // 3. Em seguida, remover os vínculos com produtos
        await tx.produtoFornecedor.deleteMany({
          where: { fornecedorId: id },
        });

        // 4. Por fim, deletar o fornecedor
        await tx.fornecedor.delete({
          where: { id: id },
        });
      });
    } else {
      // Caso não tenha vínculos, basta deletar o fornecedor diretamente
      await prisma.fornecedor.delete({
        where: { id: id },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
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
    const user = await verifyUser(req);
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

    // Verificar se o fornecedor existe e pertence ao usuário
    const fornecedor = await prisma.fornecedor.findFirst({
      where: {
        id: id,
        userId: user.id,
      },
    });

    if (!fornecedor) {
      return NextResponse.json(
        { error: "Fornecedor não encontrado ou não pertence a este usuário" },
        { status: 404 }
      );
    }

    // Atualizar o fornecedor
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
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar fornecedor" },
      { status: 500 }
    );
  }
}
