import { NextRequest, NextResponse } from "next/server";
import { verifyUser, type VerifiedUser } from "@/helpers/verifyUser";
import { ehAdminPlataforma } from "@/lib/adminPlataforma";

export class AcessoAdminNegadoError extends Error {
  constructor() {
    super("Acesso restrito à administração da plataforma");
    this.name = "AcessoAdminNegadoError";
  }
}

export async function verifyAdminPlataforma(request: NextRequest): Promise<VerifiedUser> {
  const user = await verifyUser(request);
  if (!ehAdminPlataforma(user.email)) throw new AcessoAdminNegadoError();
  return user;
}

export class ErroAdmin extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 422 | 502 | 503 = 400
  ) {
    super(message);
    this.name = "ErroAdmin";
  }
}

export function respostaErroAdmin(error: unknown, contexto: string): NextResponse {
  if (error instanceof AcessoAdminNegadoError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ErroAdmin) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && (error.name === "MotivoObrigatorioError" || error.name === "ConfiguracaoInvalidaError" || error.name === "CupomInvalidoError")) {
    const problemas = (error as Error & { problemas?: unknown }).problemas;
    return NextResponse.json({ error: error.message, ...(problemas ? { problemas } : {}) }, { status: 400 });
  }
  if (error instanceof Error && error.message.includes("não autorizado")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  console.error(`[ADMIN] ${contexto}:`, error);
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}
