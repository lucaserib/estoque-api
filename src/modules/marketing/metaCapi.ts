import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { preferenciasDoUsuario } from "@/modules/clientes/consentimento";

export type EventoMeta = "CompleteRegistration" | "StartTrial" | "Subscribe" | "Purchase";

export interface PedidoEventoMeta {
  nome: EventoMeta;
  idEvento: string;
  userId: string;
  valorCentavos?: number;
  urlOrigem?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export function metaConfigurada(): boolean {
  return Boolean(process.env.META_PIXEL_ID?.trim() && process.env.META_CAPI_TOKEN?.trim());
}

export function hashMeta(valor: string): string {
  return crypto.createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}

export function telefoneParaMeta(e164: string | null | undefined): string | null {
  const digitos = e164?.replace(/\D/g, "");
  return digitos && digitos.length >= 10 ? digitos : null;
}

export function montarEventoMeta(
  pedido: PedidoEventoMeta,
  pessoa: { email: string; telefone: string | null },
  agora: Date = new Date()
) {
  return {
    event_name: pedido.nome,
    event_time: Math.floor(agora.getTime() / 1000),
    event_id: pedido.idEvento,
    action_source: "website",
    ...(pedido.urlOrigem ? { event_source_url: pedido.urlOrigem } : {}),
    user_data: {
      em: [hashMeta(pessoa.email)],
      ...(pessoa.telefone ? { ph: [hashMeta(pessoa.telefone)] } : {}),
      external_id: [hashMeta(pedido.userId)],
      ...(pedido.ip ? { client_ip_address: pedido.ip } : {}),
      ...(pedido.userAgent ? { client_user_agent: pedido.userAgent } : {}),
    },
    ...(pedido.valorCentavos !== undefined
      ? { custom_data: { currency: "BRL", value: Math.round(pedido.valorCentavos) / 100 } }
      : {}),
  };
}

export async function enviarEventoMeta(pedido: PedidoEventoMeta): Promise<boolean> {
  if (!metaConfigurada()) return false;
  try {
    const preferencias = await preferenciasDoUsuario(pedido.userId);
    if (!preferencias.marketingEmail && !preferencias.marketingWhatsapp) return false;

    const usuario = await prisma.user.findUnique({
      where: { id: pedido.userId },
      select: { email: true, contaId: true },
    });
    if (!usuario) return false;
    const perfil = await prisma.perfilCliente.findUnique({
      where: { contaId: usuario.contaId ?? pedido.userId },
      select: { whatsapp: true },
    });

    const versao = process.env.META_GRAPH_VERSAO?.trim() || "v23.0";
    const pixel = process.env.META_PIXEL_ID!.trim();
    const resposta = await fetch(`https://graph.facebook.com/${versao}/${encodeURIComponent(pixel)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [montarEventoMeta(pedido, { email: usuario.email, telefone: telefoneParaMeta(perfil?.whatsapp) })],
        access_token: process.env.META_CAPI_TOKEN!.trim(),
        ...(process.env.META_CAPI_TESTE?.trim() ? { test_event_code: process.env.META_CAPI_TESTE.trim() } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resposta.ok) {
      console.error(`[META_CAPI] ${pedido.nome} recusado: ${resposta.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[META_CAPI] Falha ao enviar ${pedido.nome}:`, error);
    return false;
  }
}
