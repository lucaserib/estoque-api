import { Prisma, type EmailEnviado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_TENTATIVAS_EMAIL, renderizarEmail } from "./enviar";
import { obterProvedorEmail, type MensagemEmail } from "./provedor";

export interface ResultadoFila {
  pendentes: number;
  enviados: number;
  falhas: number;
  reenfileirados: number;
}

async function reservar(registro: EmailEnviado): Promise<boolean> {
  const { count } = await prisma.emailEnviado.updateMany({
    where: { id: registro.id, status: "ENFILEIRADO" },
    data: { status: "ENVIADO", tentativas: { increment: 1 } },
  });
  return count === 1;
}

export async function processarFilaEmails(
  opcoes: { limite?: number; orcamentoMs?: number; tamanhoLote?: number } = {}
): Promise<ResultadoFila> {
  const limite = opcoes.limite ?? 100;
  const prazo = Date.now() + (opcoes.orcamentoMs ?? 45_000);
  const tamanhoLote = opcoes.tamanhoLote ?? 50;
  const resultado: ResultadoFila = { pendentes: 0, enviados: 0, falhas: 0, reenfileirados: 0 };

  const pendentes = await prisma.emailEnviado.findMany({
    where: { status: "ENFILEIRADO", tentativas: { lt: MAX_TENTATIVAS_EMAIL } },
    orderBy: { createdAt: "asc" },
    take: limite,
  });
  resultado.pendentes = pendentes.length;
  const provedor = obterProvedorEmail();

  for (let inicio = 0; inicio < pendentes.length; inicio += tamanhoLote) {
    if (Date.now() > prazo) break;
    const lote: Array<{ registro: EmailEnviado; mensagem: MensagemEmail }> = [];

    for (const registro of pendentes.slice(inicio, inicio + tamanhoLote)) {
      if (!(await reservar(registro))) continue;
      try {
        lote.push({ registro, mensagem: renderizarEmail(registro, registro.dados).mensagem });
      } catch (error) {
        resultado.falhas++;
        await prisma.emailEnviado.update({
          where: { id: registro.id },
          data: { status: "FALHOU", erro: error instanceof Error ? error.message.slice(0, 1000) : "Falha ao montar o e-mail" },
        });
      }
    }
    if (lote.length === 0) continue;

    let respostas: Array<{ id: string | null; erro: string | null }>;
    try {
      respostas = await provedor.enviarLote(lote.map((item) => item.mensagem));
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Falha ao enviar o lote";
      respostas = lote.map(() => ({ id: null, erro: mensagem }));
    }

    for (const [indice, item] of lote.entries()) {
      const resposta = respostas[indice] ?? { id: null, erro: "Sem resposta do provedor" };
      if (resposta.id && !resposta.erro) {
        resultado.enviados++;
        await prisma.emailEnviado.update({
          where: { id: item.registro.id },
          data: { status: "ENVIADO", provedorId: resposta.id, enviadoEm: new Date(), erro: null, dados: Prisma.DbNull },
        });
        continue;
      }
      const tentativas = item.registro.tentativas + 1;
      const desistir = tentativas >= MAX_TENTATIVAS_EMAIL;
      if (desistir) resultado.falhas++;
      else resultado.reenfileirados++;
      await prisma.emailEnviado.update({
        where: { id: item.registro.id },
        data: { status: desistir ? "FALHOU" : "ENFILEIRADO", erro: (resposta.erro ?? "Falha desconhecida").slice(0, 1000) },
      });
    }
  }

  return resultado;
}
