import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { carregarQuadro } from "@/modules/operacao/consultas";
import { atualizarQuadroSchema, filtrosQuadroSchema } from "@/modules/operacao/dominio/esquemas";
import { atualizarQuadro } from "@/modules/operacao/quadros";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const filtros = filtrosQuadroSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json(await carregarQuadro(contexto, id, filtros));
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "carregar quadro");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const dados = atualizarQuadroSchema.parse(await request.json());
    return NextResponse.json({ quadro: await atualizarQuadro(contexto, id, dados) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "atualizar quadro");
  }
}
