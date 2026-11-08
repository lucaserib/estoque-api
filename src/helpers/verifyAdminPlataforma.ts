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

export function respostaErroAdmin(error: unknown, contexto: string): NextResponse {
  if (error instanceof AcessoAdminNegadoError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error && error.message.includes("não autorizado")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  console.error(`[ADMIN] ${contexto}:`, error);
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}
