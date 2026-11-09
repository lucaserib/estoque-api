import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { apagarConversasDaConta, listarConversas } from "@/modules/ia/conversas";
import { respostaErroRotaIa } from "@/modules/ia/respostas";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const pagina = Math.max(1, Number(request.nextUrl.searchParams.get("pagina")) || 1);
    return NextResponse.json(await listarConversas({ id: user.id, contaId: user.contaId }, pagina));
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao listar conversas");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    if (request.nextUrl.searchParams.get("escopo") !== "conta") {
      return NextResponse.json({ error: "Informe escopo=conta para apagar todas as conversas da conta." }, { status: 400 });
    }
    if (user.id !== user.contaId) {
      return NextResponse.json({ error: "Só o dono da conta pode apagar as conversas de todos." }, { status: 403 });
    }
    return NextResponse.json({ apagadas: await apagarConversasDaConta(user.contaId) });
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao apagar conversas da conta");
  }
}
