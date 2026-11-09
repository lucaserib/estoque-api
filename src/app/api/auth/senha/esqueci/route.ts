import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { ipDe } from "@/modules/conta/auditoria";
import { pedirRedefinicaoDeSenha } from "@/modules/usuarios/senha";
import { normalizarEmail } from "@/modules/usuarios/convites";

const corpoSchema = z.object({ email: z.string().trim().email("Informe um e-mail válido.").max(200) });
const RESPOSTA = "Se houver uma conta com este e-mail, mandamos um link para criar uma nova senha. Confira a caixa de entrada e o spam.";

export async function POST(request: NextRequest) {
  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: corpo.error.issues[0].message }, { status: 400 });

  const ip = ipDe(request.headers);
  const email = normalizarEmail(corpo.data.email);
  const [porIp, porEmail] = await Promise.all([
    checkRateLimit("senha-esqueci-ip", ip ?? "local", 10, 3600),
    checkRateLimit("senha-esqueci-email", email, 3, 3600),
  ]);
  if (!porIp.allowed) return rateLimitResponse(porIp);
  if (!porEmail.allowed) return NextResponse.json({ mensagem: RESPOSTA });

  try {
    await pedirRedefinicaoDeSenha(email, ip);
  } catch (error) {
    console.error("[SENHA] Falha ao pedir redefinição:", error);
  }
  return NextResponse.json({ mensagem: RESPOSTA });
}
