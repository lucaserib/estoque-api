import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { colunaSchema } from "@/modules/operacao/dominio/esquemas";
import { criarColuna } from "@/modules/operacao/quadros";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const dados = colunaSchema.parse(await request.json());
    return NextResponse.json({ coluna: await criarColuna(contexto, id, dados) }, { status: 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "criar coluna");
  }
}
