import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { ipDe } from "@/modules/conta/auditoria";
import { EquipeError, sairDaEquipe } from "@/modules/usuarios/equipe";

export async function POST(req: NextRequest) {
  try {
    const usuario = await verifyUser(req);
    await sairDaEquipe(
      { id: usuario.id, contaId: usuario.contaId === usuario.id ? null : usuario.contaId, name: usuario.name, email: usuario.email, role: usuario.role },
      { ip: ipDe(req.headers) }
    );
    return NextResponse.json({ saiu: true });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof EquipeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao sair da equipe:", error);
    return NextResponse.json({ error: "Erro ao sair da equipe" }, { status: 500 });
  }
}
