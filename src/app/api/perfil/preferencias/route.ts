import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { ipDe } from "@/modules/conta/auditoria";
import { preferenciasDoUsuario, registrarConsentimentos } from "@/modules/clientes/consentimento";
import { aplicarDescadastro } from "@/modules/email/descadastro";

const corpoSchema = z.object({
  marketingEmail: z.boolean().optional(),
  marketingWhatsapp: z.boolean().optional(),
  cicloDeVida: z.boolean().optional(),
});

function resposta(preferencias: { marketingEmail: boolean; marketingWhatsapp: boolean; cicloDeVida: boolean }) {
  return {
    marketingEmail: preferencias.marketingEmail,
    marketingWhatsapp: preferencias.marketingWhatsapp,
    cicloDeVida: preferencias.cicloDeVida,
  };
}

export async function GET(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    return NextResponse.json(resposta(await preferenciasDoUsuario(usuario.id)));
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
    if (!corpo.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    const contexto = { origem: "perfil" as const, ip: ipDe(request.headers), userAgent: request.headers.get("user-agent") };

    if (corpo.data.marketingEmail !== undefined || corpo.data.cicloDeVida !== undefined) {
      await aplicarDescadastro(usuario.id, { cicloDeVida: corpo.data.cicloDeVida, marketing: corpo.data.marketingEmail }, contexto);
    }
    if (corpo.data.marketingWhatsapp !== undefined) {
      await registrarConsentimentos(usuario.id, [{ tipo: "MARKETING_WHATSAPP", concedido: corpo.data.marketingWhatsapp }], contexto);
    }
    return NextResponse.json(resposta(await preferenciasDoUsuario(usuario.id)));
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao salvar preferências:", error);
    return NextResponse.json({ error: "Não foi possível salvar agora." }, { status: 500 });
  }
}
