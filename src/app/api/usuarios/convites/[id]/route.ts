import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { ipDe } from "@/modules/conta/auditoria";
import { EquipeError, reenviarConvite, revogarConvite } from "@/modules/usuarios/equipe";

async function autorAdmin(req: NextRequest) {
  const usuario = await verifyUserAtivo(req);
  if (usuario.role !== "ADMIN") throw new EquipeError("Acesso restrito a administradores", 403);
  return usuario;
}

function respostaDeErro(error: unknown, contexto: string) {
  const respostaAcesso = permissaoErrorResponse(error);
  if (respostaAcesso) return respostaAcesso;
  if (error instanceof EquipeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`Erro ao ${contexto}:`, error);
  return NextResponse.json({ error: `Erro ao ${contexto}` }, { status: 500 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await autorAdmin(req);
    const { id } = await params;
    await revogarConvite(
      { id: usuario.id, contaId: usuario.contaId, name: usuario.name, email: usuario.email },
      id,
      { ip: ipDe(req.headers) }
    );
    return NextResponse.json({ message: "Convite revogado com sucesso" });
  } catch (error) {
    return respostaDeErro(error, "revogar convite");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await autorAdmin(req);
    const { id } = await params;
    const convite = await reenviarConvite(
      { id: usuario.id, contaId: usuario.contaId, name: usuario.name, email: usuario.email },
      id,
      { ip: ipDe(req.headers) }
    );
    return NextResponse.json({
      convite: { id: convite.id, email: convite.email, expiresAt: convite.expiresAt, caminho: `/register?invite=${convite.token}` },
    });
  } catch (error) {
    return respostaDeErro(error, "reenviar convite");
  }
}
