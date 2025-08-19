import { verifyUser } from "@/helpers/verifyUser";
import { brlToCents } from "@/utils/currency";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;

  try {
    return JSON.parse(
      JSON.stringify(obj, (key, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      })
    );
  } catch (error) {
    console.error("Erro ao serializar objeto:", error);
    // Se falhar a serialização, tenta retornar o objeto original
    return obj;
  }
};

interface RequestBody {
  produtoId: string;
  fornecedorId: string;
  id?: number;
  preco: number;
  multiplicador: number;
  codigoNF: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBody = await request.json();

    console.log("API POST /produto-fornecedor - Corpo da requisição:", body);

    const { produtoId, fornecedorId, preco, multiplicador, codigoNF } = body;

    if (
      !produtoId ||
      !fornecedorId ||
      preco === undefined ||
      !multiplicador ||
      !codigoNF
    ) {
      console.error(
        "API POST /produto-fornecedor - Campos obrigatórios não preenchidos:",
        {
          produtoId,
          fornecedorId,
          preco,
          multiplicador,
          codigoNF,
        }
      );
      return NextResponse.json(
        {
          error: "Todos os campos são obrigatórios!",
        },
        { status: 400 }
      );
    }

    // Verificar se o produto e o fornecedor existem e pertencem ao usuário
    const produto = await prisma.produto.findFirst({
      where: { 
        id: produtoId,
        userId: user.id 
      },
    });

    if (!produto) {
      console.error(
        `API POST /produto-fornecedor - Produto não encontrado ou não pertence ao usuário: ${produtoId}`
      );
      return NextResponse.json(
        { error: "Produto não encontrado ou não autorizado" },
        { status: 404 }
      );
    }

    const fornecedor = await prisma.fornecedor.findFirst({
      where: { 
        id: fornecedorId,
        userId: user.id 
      },
    });

    if (!fornecedor) {
      console.error(
        `API POST /produto-fornecedor - Fornecedor não encontrado ou não pertence ao usuário: ${fornecedorId}`
      );
      return NextResponse.json(
        { error: "Fornecedor não encontrado ou não autorizado" },
        { status: 404 }
      );
    }

    const vinculoExistente = await prisma.produtoFornecedor.findFirst({
      where: { produtoId, fornecedorId },
    });

    if (vinculoExistente) {
      console.warn(
        `API POST /produto-fornecedor - Produto já vinculado ao fornecedor: ${produtoId}, ${fornecedorId}`
      );
      return NextResponse.json(
        { error: "Produto já vinculado a este fornecedor" },
        { status: 400 }
      );
    }

    // Converter o preço para um valor numérico
    const precoNumerico =
      typeof preco === "number" ? preco : parseFloat(preco as string);

    console.log(
      `API POST /produto-fornecedor - Preço convertido: ${precoNumerico}`
    );

    // Garantir que o preço seja um valor positivo
    if (isNaN(precoNumerico) || precoNumerico < 0) {
      console.error(`API POST /produto-fornecedor - Preço inválido: ${preco}`);
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 });
    }

    const vinculo = await prisma.produtoFornecedor.create({
      data: {
        produtoId,
        fornecedorId,
        preco: Math.round(precoNumerico * 100),
        multiplicador: Number(multiplicador),
        codigoNF,
      },
    });

    console.log(
      "API POST /produto-fornecedor - Vínculo criado com sucesso:",
      vinculo
    );
    return NextResponse.json(vinculo, { status: 201 });
  } catch (error) {
    console.error("Erro ao vincular fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao vincular fornecedor" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const { searchParams } = new URL(request.url);
    const fornecedorId = searchParams.get("fornecedorId");
    const produtoId = searchParams.get("produtoId");

    console.log("API /produto-fornecedor - Parâmetros:", {
      fornecedorId,
      produtoId,
    });

    if (!fornecedorId && !produtoId) {
      console.log(
        "API /produto-fornecedor - Erro: FornecedorId ou ProdutoId é obrigatório"
      );
      return NextResponse.json(
        { error: "FornecedorId ou ProdutoId é obrigatório" },
        { status: 400 }
      );
    }

    if (fornecedorId) {
      console.log(
        "API /produto-fornecedor - Buscando produtos para fornecedor:",
        fornecedorId
      );
      
      // Verificar se o fornecedor pertence ao usuário
      const fornecedor = await prisma.fornecedor.findFirst({
        where: {
          id: fornecedorId,
          userId: user.id,
        },
      });

      if (!fornecedor) {
        console.error(
          `API /produto-fornecedor - Fornecedor não encontrado ou não autorizado: ${fornecedorId}`
        );
        return NextResponse.json(
          { error: "Fornecedor não encontrado ou não autorizado" },
          { status: 404 }
        );
      }

      const produtos = await prisma.produtoFornecedor.findMany({
        where: {
          fornecedorId: fornecedorId,
          produto: {
            userId: user.id, // Garantir que o produto pertence ao usuário
          },
        },
        include: {
          produto: true,
        },
      });

      console.log(
        `API /produto-fornecedor - Encontrados ${produtos.length} produtos para o fornecedor`
      );
      const serializedProdutos = serializeBigInt(produtos);
      console.log(
        "API /produto-fornecedor - Produtos serializados:",
        serializedProdutos
      );

      return NextResponse.json(serializedProdutos, { status: 200 });
    } else if (produtoId) {
      console.log(
        "API /produto-fornecedor - Buscando fornecedores para produto:",
        produtoId
      );
      
      // Verificar se o produto pertence ao usuário
      const produto = await prisma.produto.findFirst({
        where: {
          id: produtoId,
          userId: user.id,
        },
      });

      if (!produto) {
        console.error(
          `API /produto-fornecedor - Produto não encontrado ou não autorizado: ${produtoId}`
        );
        return NextResponse.json(
          { error: "Produto não encontrado ou não autorizado" },
          { status: 404 }
        );
      }

      const fornecedores = await prisma.produtoFornecedor.findMany({
        where: {
          produtoId: produtoId,
          fornecedor: {
            userId: user.id, // Garantir que o fornecedor pertence ao usuário
          },
        },
        include: {
          fornecedor: true,
        },
      });

      console.log(
        `API /produto-fornecedor - Encontrados ${fornecedores.length} fornecedores para o produto`
      );
      return NextResponse.json(serializeBigInt(fornecedores), { status: 200 });
    }

    console.log("API /produto-fornecedor - Retornando array vazio");
    return NextResponse.json([], { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar produtos ou fornecedores:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos ou fornecedores" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await verifyUser(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  try {
    // Verificar se o vínculo existe e se o usuário tem permissão
    const vinculoExistente = await prisma.produtoFornecedor.findUnique({
      where: { id: Number(id) },
      include: {
        produto: true,
        fornecedor: true,
      },
    });

    if (!vinculoExistente) {
      return NextResponse.json(
        { error: "Vínculo não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se o produto e fornecedor pertencem ao usuário
    if (vinculoExistente.produto.userId !== user.id || vinculoExistente.fornecedor.userId !== user.id) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 403 }
      );
    }

    await prisma.produtoFornecedor.delete({
      where: { id: Number(id) },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Erro ao deletar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao deletar fornecedor" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBody = await request.json();

    console.log("API PUT /produto-fornecedor - Corpo da requisição:", body);

    const { id, preco, multiplicador, codigoNF } = body;

    if (!id || preco === undefined || !multiplicador || !codigoNF) {
      console.error(
        "API PUT /produto-fornecedor - Campos obrigatórios não preenchidos:",
        {
          id,
          preco,
          multiplicador,
          codigoNF,
        }
      );
      return NextResponse.json(
        { error: "ID, Preço, Multiplicador e Código NF são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se o vínculo existe e se o usuário tem permissão
    const vinculoExistente = await prisma.produtoFornecedor.findUnique({
      where: { id: Number(id) },
      include: {
        produto: true,
        fornecedor: true,
      },
    });

    if (!vinculoExistente) {
      console.error(
        `API PUT /produto-fornecedor - Vínculo não encontrado: ${id}`
      );
      return NextResponse.json(
        { error: "Vínculo não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se o produto e fornecedor pertencem ao usuário
    if (vinculoExistente.produto.userId !== user.id || vinculoExistente.fornecedor.userId !== user.id) {
      console.error(
        `API PUT /produto-fornecedor - Vínculo não autorizado para usuário: ${user.id}`
      );
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 403 }
      );
    }

    // Converter o preço para um valor numérico
    const precoNumerico =
      typeof preco === "number" ? preco : parseFloat(preco as string);

    console.log(
      `API PUT /produto-fornecedor - Preço convertido: ${precoNumerico}`
    );

    // Garantir que o preço seja um valor positivo
    if (isNaN(precoNumerico) || precoNumerico < 0) {
      console.error(`API PUT /produto-fornecedor - Preço inválido: ${preco}`);
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 });
    }

    const vinculo = await prisma.produtoFornecedor.update({
      where: { id: Number(id) },
      data: {
        preco: Math.round(precoNumerico * 100),
        multiplicador: Number(multiplicador),
        codigoNF,
      },
    });

    console.log(
      "API PUT /produto-fornecedor - Vínculo atualizado com sucesso:",
      vinculo
    );
    return NextResponse.json(serializeBigInt(vinculo), { status: 200 });
  } catch (error) {
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar fornecedor" },
      { status: 500 }
    );
  }
}
