import { NextRequest, NextResponse } from "next/server";
import { preapprovalFalso, registrarPagamentoFalso, usarMercadoPagoFalso } from "@/services/mercadoPagoFalso";
import { tratarPagamento, tratarPreapproval } from "@/modules/cobranca/webhookMercadoPago";
import { MercadoPagoService, type PagamentoMercadoPago } from "@/services/mercadoPagoService";

export async function GET(request: NextRequest) {
  if (!usarMercadoPagoFalso()) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const id = request.nextUrl.searchParams.get("preapproval") ?? "";
  const registro = preapprovalFalso(id);
  if (!registro) return NextResponse.json({ error: "Preapproval desconhecido" }, { status: 404 });

  const autorizado = await MercadoPagoService.updatePreapprovalAmount(id, Number((registro.auto_recurring as { transaction_amount: number }).transaction_amount));
  await MercadoPagoService.getPreapproval(id);
  const atualizado = { ...autorizado, status: "authorized" };
  Object.assign(registro, { status: "authorized" });
  await tratarPreapproval(atualizado);

  const inicio = (registro.auto_recurring as { start_date?: string }).start_date;
  if (!inicio || new Date(inicio).getTime() <= Date.now()) {
    const pagamento = registrarPagamentoFalso({
      status: "approved",
      external_reference: registro.external_reference,
      transaction_amount: (registro.auto_recurring as { transaction_amount: number }).transaction_amount,
      date_approved: new Date().toISOString(),
      payment_type_id: "credit_card",
      payer: { email: registro.payer_email },
    });
    await tratarPagamento(pagamento as unknown as PagamentoMercadoPago);
  }
  return NextResponse.redirect(String(registro.back_url ?? "/assinatura"));
}
