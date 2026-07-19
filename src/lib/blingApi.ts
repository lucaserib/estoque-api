import { NextResponse } from "next/server";
import { BlingReconnectError } from "@/services/blingService";

export interface ApiError {
  error: string;
  code?: string;
}

export function blingErrorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof BlingReconnectError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 401 }
    );
  }

  console.error("[BLING] Erro:", error);
  return NextResponse.json(
    { error: "Erro na comunicação com o Bling. Tente novamente." },
    { status: 500 }
  );
}
