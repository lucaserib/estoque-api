import type { StatusEmail } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ORDEM: Record<StatusEmail, number> = {
  ENFILEIRADO: 0,
  FALHOU: 1,
  SUPRIMIDO: 1,
  ENVIADO: 2,
  ENTREGUE: 3,
  ABERTO: 4,
  CLICADO: 5,
  DEVOLVIDO: 6,
  RECLAMACAO: 7,
};

export interface EventoEmailRecebido {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

export function statusDoEvento(tipo: string): StatusEmail | null {
  switch (tipo) {
    case "email.sent":
      return "ENVIADO";
    case "email.delivered":
      return "ENTREGUE";
    case "email.opened":
      return "ABERTO";
    case "email.clicked":
      return "CLICADO";
    case "email.bounced":
      return "DEVOLVIDO";
    case "email.complained":
      return "RECLAMACAO";
    case "email.failed":
      return "FALHOU";
    case "email.suppressed":
      return "SUPRIMIDO";
    default:
      return null;
  }
}

export function devolucaoDefinitiva(evento: EventoEmailRecebido): boolean {
  const tipo = evento.data?.bounce?.type?.toLowerCase() ?? "";
  return tipo === "permanent" || tipo === "hard";
}

export async function processarEventoEmail(evento: EventoEmailRecebido): Promise<{ atualizado: boolean; suprimido: boolean }> {
  const status = statusDoEvento(evento.type);
  const provedorId = evento.data?.email_id;
  if (!status || !provedorId) return { atualizado: false, suprimido: false };

  const quando = evento.created_at ? new Date(evento.created_at) : new Date();
  const registro = await prisma.emailEnviado.findUnique({ where: { provedorId } });
  let atualizado = false;

  if (registro) {
    const dados: Record<string, unknown> = {};
    if (ORDEM[status] > ORDEM[registro.status]) dados.status = status;
    if (status === "ENTREGUE" && !registro.entregueEm) dados.entregueEm = quando;
    if (status === "ABERTO" && !registro.abertoEm) dados.abertoEm = quando;
    if (status === "CLICADO") {
      if (!registro.clicadoEm) dados.clicadoEm = quando;
      if (!registro.abertoEm) dados.abertoEm = quando;
    }
    if (status === "DEVOLVIDO") dados.erro = evento.data?.bounce?.message?.slice(0, 1000) ?? "Devolvido";
    if (Object.keys(dados).length > 0) {
      await prisma.emailEnviado.update({ where: { id: registro.id }, data: dados });
      atualizado = true;
    }
  }

  const deveSuprimir = status === "RECLAMACAO" || (status === "DEVOLVIDO" && devolucaoDefinitiva(evento));
  if (!deveSuprimir) return { atualizado, suprimido: false };

  const enderecos = new Set<string>([...(evento.data?.to ?? []), ...(registro ? [registro.para] : [])].map((e) => e.trim().toLowerCase()));
  for (const email of enderecos) {
    if (!email) continue;
    await prisma.supressaoEmail.upsert({
      where: { email },
      update: { motivo: status === "RECLAMACAO" ? "RECLAMACAO" : "DEVOLUCAO" },
      create: {
        email,
        motivo: status === "RECLAMACAO" ? "RECLAMACAO" : "DEVOLUCAO",
        detalhe: status === "RECLAMACAO" ? "Marcou como spam" : evento.data?.bounce?.message?.slice(0, 300) ?? null,
      },
    });
  }
  return { atualizado, suprimido: true };
}
