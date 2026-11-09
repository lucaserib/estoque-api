import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { adicionarItem } from "@/modules/operacao/checklist";
import { itemChecklistSchema } from "@/modules/operacao/dominio/esquemas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const { texto } = itemChecklistSchema.parse(await request.json());
    return NextResponse.json({ item: await adicionarItem(contexto, id, texto) }, { status: 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "adicionar item");
  }
}
