import { NextRequest, NextResponse } from "next/server";
import { preferenciaFalsa, registrarPagamentoFalso, usarMercadoPagoFalso } from "@/services/mercadoPagoFalso";
import { tratarPagamento } from "@/modules/cobranca/webhookMercadoPago";
import type { PagamentoMercadoPago } from "@/services/mercadoPagoService";

export async function GET(request: NextRequest) {
  if (!usarMercadoPagoFalso()) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const preferencia = preferenciaFalsa(request.nextUrl.searchParams.get("preferencia") ?? "");
  if (!preferencia) return NextResponse.json({ error: "Preferência desconhecida" }, { status: 404 });

  const itens = preferencia.items as Array<{ unit_price: number }>;
  const pagamento = registrarPagamentoFalso({
    status: request.nextUrl.searchParams.get("status") ?? "approved",
    external_reference: preferencia.external_reference,
    transaction_amount: itens?.[0]?.unit_price ?? 0,
    date_approved: new Date().toISOString(),
    payment_type_id: "account_money",
    payer: preferencia.payer ?? null,
  });
  await tratarPagamento(pagamento as unknown as PagamentoMercadoPago);
  const volta = (preferencia.back_urls as { success: string } | undefined)?.success ?? "/ia";
  return NextResponse.redirect(volta);
}
