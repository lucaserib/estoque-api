import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { exportarDadosDoTitular } from "@/modules/clientes/titular";

export async function GET(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const limite = await checkRateLimit("meus-dados", usuario.id, 10, 3600);
    if (!limite.allowed) return rateLimitResponse(limite);
    const dados = await exportarDadosDoTitular(usuario.id);
    const dia = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(dados, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="skubo-meus-dados-${dia}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao exportar dados do titular:", error);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo agora." }, { status: 500 });
  }
}
