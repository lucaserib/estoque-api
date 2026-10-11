import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarDre } from "@/modules/financeiro/relatorios/dre";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const ate = searchParams.get("ate");
    if (!ate || !/^\d{4}-\d{2}$/.test(ate)) {
      return NextResponse.json({ error: "Parâmetro ate é obrigatório no formato AAAA-MM" }, { status: 400 });
    }
    const [ano, mes] = ate.split("-").map(Number);
    const meses = Math.min(Number(searchParams.get("meses") ?? "1"), 12);
    const canal = (searchParams.get("canal") as CanalVenda) || undefined;
    const contaCanalId = searchParams.get("contaCanalId") || undefined;

    const relatorio = await gerarDre(user.contaId, { ano, mes }, meses, { canal, contaCanalId });
    return NextResponse.json(relatorio);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar DRE:", error);
    return NextResponse.json({ error: "Erro ao gerar DRE" }, { status: 500 });
  }
}
