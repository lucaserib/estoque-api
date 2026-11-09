import { NextResponse } from "next/server";
import { obterConfiguracaoComercial, pacotesAtivos } from "@/modules/comercial/configuracao";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const configuracao = await obterConfiguracaoComercial();
    return NextResponse.json(
      {
        versao: configuracao.versao,
        diasTeste: configuracao.diasTeste,
        precos: {
          mensalCentavos: configuracao.precoMensalCentavos,
          primeiroMesCentavos: configuracao.precoPrimeiroMesCentavos,
          anualCentavos: configuracao.precoAnualCentavos,
        },
        ia: {
          perguntasTeste: configuracao.iaPerguntasTeste,
          pacotes: pacotesAtivos(configuracao).map(({ id, nome, perguntas, precoCentavos, destaque }) => ({
            id,
            nome,
            perguntas,
            precoCentavos,
            destaque,
          })),
        },
        indicacao: {
          ativo: configuracao.indicacao.ativo,
          diasRecompensa: configuracao.indicacao.diasRecompensa,
          bonusPerguntasIa: configuracao.indicacao.bonusIndicado.perguntasIa,
        },
        textos: configuracao.textosOferta,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Erro ao ler os planos:", error);
    return NextResponse.json({ error: "Não foi possível carregar os planos agora." }, { status: 500 });
  }
}
