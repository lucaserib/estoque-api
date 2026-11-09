import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { detalharConta } from "@/modules/admin/contas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdminPlataforma(request);
    const detalhe = await detalharConta((await params).id);
    if (!detalhe) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    return NextResponse.json(detalhe);
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao detalhar a conta");
  }
}
