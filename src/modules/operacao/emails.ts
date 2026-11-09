import { prisma } from "@/lib/prisma";
import { enviarEmailSemFalhar } from "@/modules/email/enviar";
import { linkAbsoluto } from "@/modules/email/config";
import { obterSituacaoContaEmCache } from "@/modules/conta/situacao";
import { NotificationService } from "@/services/notificationService";
import { fimDoDia } from "@/modules/financeiro/dominio/periodo";
import { hojeEmTexto, partesDoPrazo } from "./dominio/prazo";
import type { AvisoEnviado } from "./avisos";

const HORA_MS = 60 * 60 * 1000;
const ITENS_POR_SECAO = 5;

function prazoCurto(prazo: Date, comHora: boolean): string {
  const partes = partesDoPrazo(prazo, comHora);
  const [, mes, dia] = partes.data.split("-");
  return `${dia}/${mes}${partes.hora ? ` ${partes.hora}` : ""}`;
}

export async function enviarEmailsDosAvisos(avisos: AvisoEnviado[], agora: Date = new Date()): Promise<number> {
  const relevantes = avisos.filter((aviso) => aviso.tipo === "atribuida" || aviso.tipo === "mencao");
  if (relevantes.length === 0) return 0;
  const pessoas = await prisma.user.findMany({
    where: { id: { in: [...new Set(relevantes.map((a) => a.userId))] }, emailTarefas: true, bloqueadoEm: null },
    select: { id: true, email: true, name: true, contaId: true },
  });
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const tarefaIds = [...new Set(relevantes.map((a) => a.tarefa.id))];
  const prazos = new Map(
    (await prisma.tarefa.findMany({ where: { id: { in: tarefaIds } }, select: { id: true, prazo: true, prazoComHora: true } })).map((t) => [t.id, t])
  );
  const hora = Math.floor(agora.getTime() / HORA_MS);
  const dia = hojeEmTexto(agora);
  let enviados = 0;
  for (const aviso of relevantes) {
    const pessoa = porId.get(aviso.userId);
    if (!pessoa) continue;
    const link = linkAbsoluto(`/operacao?tarefa=${aviso.tarefa.id}`);
    const base = { para: pessoa.email, contaId: pessoa.contaId ?? pessoa.id, userId: pessoa.id };
    if (aviso.tipo === "atribuida") {
      const tarefa = prazos.get(aviso.tarefa.id);
      const resultado = await enviarEmailSemFalhar({
        ...base,
        modelo: "tarefa-atribuida",
        chaveIdempotencia: `tarefa-atribuida:${aviso.tarefa.id}:${pessoa.id}:${dia}`,
        dados: {
          nome: pessoa.name,
          autor: aviso.autorNome,
          numero: aviso.tarefa.numero,
          titulo: aviso.tarefa.titulo,
          prazo: tarefa?.prazo ? prazoCurto(tarefa.prazo, tarefa.prazoComHora) : null,
          link,
        },
      });
      if (resultado?.novo) enviados++;
    } else {
      const resultado = await enviarEmailSemFalhar({
        ...base,
        modelo: "tarefa-mencao",
        chaveIdempotencia: `tarefa-mencao:${aviso.tarefa.id}:${pessoa.id}:${hora}`,
        dados: {
          nome: pessoa.name,
          autor: aviso.autorNome,
          numero: aviso.tarefa.numero,
          titulo: aviso.tarefa.titulo,
          trecho: aviso.trecho ?? "",
          link,
        },
      });
      if (resultado?.novo) enviados++;
    }
  }
  return enviados;
}

export interface ResultadoResumoDiario {
  pessoas: number;
  emails: number;
  avisos: number;
  pendentes: boolean;
}

export async function enviarResumosDiarios(agora: Date = new Date(), orcamentoMs = 45_000): Promise<ResultadoResumoDiario> {
  const inicio = Date.now();
  const fimHoje = fimDoDia(agora);
  const dia = hojeEmTexto(agora);
  const candidatos = await prisma.tarefa.groupBy({
    by: ["responsavelId"],
    where: {
      responsavelId: { not: null },
      concluidaEm: null,
      arquivadaEm: null,
      prazo: { lte: fimHoje },
      quadro: { arquivadoEm: null },
    },
    _count: { _all: true },
  });
  const ids = candidatos.map((c) => c.responsavelId).filter((id): id is string => Boolean(id));
  const jaEnviados = new Set(
    (
      await prisma.emailEnviado.findMany({
        where: { chaveIdempotencia: { in: ids.map((id) => `resumo-tarefas:${id}:${dia}`) } },
        select: { chaveIdempotencia: true },
      })
    ).map((e) => e.chaveIdempotencia.split(":")[1])
  );
  const pessoas = await prisma.user.findMany({
    where: { id: { in: ids }, bloqueadoEm: null },
    select: { id: true, email: true, name: true, contaId: true, emailTarefas: true },
  });
  const resultado: ResultadoResumoDiario = { pessoas: 0, emails: 0, avisos: 0, pendentes: false };

  for (const pessoa of pessoas) {
    if (Date.now() - inicio > orcamentoMs) {
      resultado.pendentes = true;
      break;
    }
    if (jaEnviados.has(pessoa.id)) continue;
    const contaId = pessoa.contaId ?? pessoa.id;
    const situacao = await obterSituacaoContaEmCache(contaId);
    if (!situacao.podeUsar) continue;
    const base = { responsavelId: pessoa.id, contaId, concluidaEm: null, arquivadaEm: null, quadro: { arquivadoEm: null } };
    const selecao = { numero: true, titulo: true, prazo: true, prazoComHora: true } as const;
    const [atrasadas, hoje, totalAtrasadas, totalHoje] = await Promise.all([
      prisma.tarefa.findMany({ where: { ...base, prazo: { lt: agora } }, orderBy: { prazo: "asc" }, take: ITENS_POR_SECAO, select: selecao }),
      prisma.tarefa.findMany({ where: { ...base, prazo: { gte: agora, lte: fimHoje } }, orderBy: { prazo: "asc" }, take: ITENS_POR_SECAO, select: selecao }),
      prisma.tarefa.count({ where: { ...base, prazo: { lt: agora } } }),
      prisma.tarefa.count({ where: { ...base, prazo: { gte: agora, lte: fimHoje } } }),
    ]);
    if (totalAtrasadas + totalHoje === 0) continue;
    resultado.pessoas++;
    const partes: string[] = [];
    if (totalAtrasadas > 0) partes.push(`${totalAtrasadas} ${totalAtrasadas === 1 ? "atrasada" : "atrasadas"}`);
    if (totalHoje > 0) partes.push(`${totalHoje} para hoje`);
    const aviso = await NotificationService.create({
      userId: pessoa.id,
      type: "TAREFA",
      title: "Seu dia na operação",
      body: `Você tem ${partes.join(" e ")}.`,
      link: "/operacao",
    }).catch(() => null);
    if (aviso) resultado.avisos++;
    if (!pessoa.emailTarefas) continue;
    const item = (t: { numero: number; titulo: string; prazo: Date | null; prazoComHora: boolean }) => ({
      numero: t.numero,
      titulo: t.titulo,
      prazo: t.prazo ? prazoCurto(t.prazo, t.prazoComHora) : "",
    });
    const email = await enviarEmailSemFalhar({
      para: pessoa.email,
      contaId,
      userId: pessoa.id,
      modelo: "resumo-tarefas",
      chaveIdempotencia: `resumo-tarefas:${pessoa.id}:${dia}`,
      dados: {
        nome: pessoa.name,
        atrasadas: atrasadas.map(item),
        hoje: hoje.map(item),
        totalAtrasadas,
        totalHoje,
        link: linkAbsoluto("/operacao"),
      },
    });
    if (email?.novo) resultado.emails++;
  }
  return resultado;
}
