import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { rateLimitResponse } from "@/lib/rateLimit";
import { explicarReposicao, explicarVariacao, planejarAnuncios, resumirProduto } from "@/modules/ia/explicacoes";
import { ErroFerramenta } from "@/modules/ia/ferramentas/tipos";
import { limitarExplicacoes } from "@/modules/ia/limite";
import { respostaErroRotaIa } from "@/modules/ia/respostas";

export const runtime = "nodejs";
export const maxDuration = 60;

const corpoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("reposicao"), produtoId: z.string().min(1).max(64) }),
  z.object({ tipo: z.literal("produto"), produtoId: z.string().min(1).max(64) }),
  z.object({ tipo: z.literal("variacao"), periodo: z.enum(["mes-atual", "mes-anterior", "7", "30", "90", "hoje"]).default("mes-atual") }),
  z.object({ tipo: z.literal("anuncios") }),
]);

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
    if (!corpo.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

    const limite = await limitarExplicacoes(user.id);
    if (!limite.allowed) return rateLimitResponse(limite);

    const usuario = { id: user.id, contaId: user.contaId, role: user.role };
    const dados = corpo.data;
    const resultado =
      dados.tipo === "reposicao"
        ? await explicarReposicao(usuario, dados.produtoId)
        : dados.tipo === "produto"
        ? await resumirProduto(usuario, dados.produtoId)
        : dados.tipo === "variacao"
        ? await explicarVariacao(usuario, dados.periodo)
        : await planejarAnuncios(usuario);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof ErroFerramenta) return NextResponse.json({ error: error.message }, { status: 422 });
    return respostaErroRotaIa(error, "Falha ao gerar explicação");
  }
}
