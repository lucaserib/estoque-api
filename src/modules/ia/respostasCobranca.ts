import { NextResponse } from "next/server";
import { MercadoPagoNotConfiguredError } from "@/services/mercadoPagoService";
import { CobrancaIaError } from "./cobranca";
import { respostaErroRotaIa } from "./respostas";

export function respostaErroCobrancaIa(error: unknown, contexto: string): NextResponse {
  if (error instanceof CobrancaIaError) {
    return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: error.status });
  }
  if (error instanceof MercadoPagoNotConfiguredError) {
    return NextResponse.json({ error: "Pagamentos ainda não estão configurados.", codigo: "MP_NAO_CONFIGURADO" }, { status: 503 });
  }
  return respostaErroRotaIa(error, contexto);
}
