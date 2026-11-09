import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function cronAutorizado(request: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

export function respostaCronNaoAutorizado(): NextResponse {
  return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
}
