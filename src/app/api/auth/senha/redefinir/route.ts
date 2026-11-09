import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { ipDe } from "@/modules/conta/auditoria";
import { redefinirSenha, SenhaFracaError } from "@/modules/usuarios/senha";
import { TokenInvalidoError } from "@/modules/usuarios/tokens";

const corpoSchema = z.object({
  token: z.string().min(20).max(200),
  senha: z.string().max(200),
});

export async function POST(request: NextRequest) {
  const limite = await checkRateLimit("senha-redefinir", ipDe(request.headers) ?? "local", 20, 3600);
  if (!limite.allowed) return rateLimitResponse(limite);

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: "Link inválido. Peça um novo." }, { status: 400 });

  try {
    await redefinirSenha(corpo.data.token, corpo.data.senha);
    return NextResponse.json({ mensagem: "Senha alterada. Entre com a nova senha." });
  } catch (error) {
    if (error instanceof SenhaFracaError || error instanceof TokenInvalidoError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("[SENHA] Falha ao redefinir:", error);
    return NextResponse.json({ error: "Não foi possível trocar a senha agora." }, { status: 500 });
  }
}
