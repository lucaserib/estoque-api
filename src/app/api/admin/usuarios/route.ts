import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { buscarUsuarios } from "@/modules/admin/usuarios";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    return NextResponse.json({ usuarios: await buscarUsuarios(request.nextUrl.searchParams.get("busca")) });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao buscar usuários");
  }
}
