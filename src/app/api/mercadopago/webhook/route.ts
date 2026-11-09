import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { MercadoPagoService } from "@/services/mercadoPagoService";
import { webhookSemSegredoEmProducao } from "@/modules/cobranca/periodo";
import { tratarPagamento, tratarPreapproval } from "@/modules/cobranca/webhookMercadoPago";

function isValidSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!signatureHeader || !requestId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    })
  );

  const ts = parts.ts;
  const receivedHash = parts.v1;
  if (!ts || !receivedHash) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expectedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const esperado = Buffer.from(expectedHash);
  const recebido = Buffer.from(receivedHash);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

export async function POST(request: NextRequest) {
  if (webhookSemSegredoEmProducao()) {
    console.error("[MP_WEBHOOK] MP_WEBHOOK_SECRET ausente em produção; notificação recusada.");
    return NextResponse.json({ error: "Webhook do Mercado Pago sem segredo configurado" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const { searchParams } = new URL(request.url);
  const type = body?.type || searchParams.get("type") || searchParams.get("topic");
  const dataId = body?.data?.id || searchParams.get("data.id") || searchParams.get("id");

  if (!type || !dataId) {
    return NextResponse.json({ received: true });
  }

  if (!isValidSignature(request, String(dataId))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  try {
    let resultado = "IGNORADO";
    if (type === "subscription_preapproval" || type === "preapproval") {
      resultado = await tratarPreapproval(await MercadoPagoService.getPreapproval(String(dataId)));
    } else if (type === "payment") {
      resultado = await tratarPagamento(await MercadoPagoService.getPayment(String(dataId)));
    }
    return NextResponse.json({ received: true, resultado });
  } catch (error) {
    console.error("Erro ao processar webhook do Mercado Pago:", error);
    return NextResponse.json({ error: "Erro ao processar notificação" }, { status: 500 });
  }
}
