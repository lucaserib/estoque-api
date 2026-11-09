import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { ipDe } from "@/modules/conta/auditoria";
import { confirmarEmail } from "@/modules/usuarios/senha";
import { TokenInvalidoError } from "@/modules/usuarios/tokens";

const corpoSchema = z.object({ token: z.string().min(20).max(200) });

export async function POST(request: NextRequest) {
  const limite = await checkRateLimit("email-confirmar", ipDe(request.headers) ?? "local", 30, 3600);
  if (!limite.allowed) return rateLimitResponse(limite);

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: "Link inválido. Peça um novo." }, { status: 400 });

  try {
    await confirmarEmail(corpo.data.token);
    return NextResponse.json({ mensagem: "E-mail confirmado." });
  } catch (error) {
    if (error instanceof TokenInvalidoError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("[EMAIL] Falha ao confirmar:", error);
    return NextResponse.json({ error: "Não foi possível confirmar agora." }, { status: 500 });
  }
}
