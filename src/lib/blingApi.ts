import { NextResponse } from "next/server";
import {
  BlingReconnectError,
  BlingRateLimitError,
  BlingApiError,
  BlingTransientError,
} from "@/services/blingService";

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

  if (error instanceof BlingRateLimitError) {
    return NextResponse.json(
      { error: error.message, code: "BLING_RATE_LIMITED" },
      { status: 429 }
    );
  }

  if (error instanceof BlingTransientError) {
    return NextResponse.json(
      {
        error: "O Bling está indisponível no momento. Tente novamente em instantes.",
        code: "BLING_INDISPONIVEL",
      },
      { status: 503 }
    );
  }

  if (error instanceof BlingApiError) {
    console.error(`[BLING] Erro ${error.status} em ${error.endpoint}:`, error.message);
    return NextResponse.json(
      {
        error: "O Bling retornou um erro ao processar a solicitação.",
        code: "BLING_API_ERROR",
      },
      { status: 502 }
    );
  }

  console.error("[BLING] Erro:", error);
  return NextResponse.json(
    { error: "Erro na comunicação com o Bling. Tente novamente." },
    { status: 500 }
  );
}
