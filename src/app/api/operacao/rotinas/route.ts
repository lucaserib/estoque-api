import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { criarRotinas, listarRotinas } from "@/modules/operacao/rotinas";

const corpoSchema = z.object({ chaves: z.array(z.string().max(40)).min(1).max(20) });

export async function GET(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    return NextResponse.json({ rotinas: await listarRotinas(contexto) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "listar rotinas");
  }
}

export async function POST(request: NextRequest) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { chaves } = corpoSchema.parse(await request.json());
    return NextResponse.json({ criadas: await criarRotinas(contexto, chaves) }, { status: 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "criar rotinas");
  }
}
