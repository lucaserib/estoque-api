import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  emailEnviado: { findUnique: vi.fn(), update: vi.fn() },
  supressaoEmail: { upsert: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/email/webhook/route";
import { processarEventoEmail } from "../eventos";

const SEGREDO_BRUTO = Buffer.from("segredo-do-webhook-resend");
const SEGREDO = `whsec_${SEGREDO_BRUTO.toString("base64")}`;

function assinar(corpo: string, id = "msg_1", timestamp = Math.floor(Date.now() / 1000).toString()) {
  const assinatura = crypto.createHmac("sha256", SEGREDO_BRUTO).update(`${id}.${timestamp}.${corpo}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${assinatura}` };
}

function requisicao(corpo: string, cabecalhos: Record<string, string>) {
  return new NextRequest("https://app.skubo.test/api/email/webhook", { method: "POST", body: corpo, headers: cabecalhos });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = SEGREDO;
});

describe("webhook do Resend", () => {
  const corpo = JSON.stringify({ type: "email.delivered", created_at: "2026-11-10T12:00:00.000Z", data: { email_id: "re_1", to: ["a@b.com"] } });

  it("assinatura válida atualiza o e-mail", async () => {
    prismaMock.emailEnviado.findUnique.mockResolvedValue({ id: "e1", status: "ENVIADO", entregueEm: null, para: "a@b.com" });
    const resposta = await POST(requisicao(corpo, assinar(corpo)));
    expect(resposta.status).toBe(200);
    expect(prismaMock.emailEnviado.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { status: "ENTREGUE", entregueEm: new Date("2026-11-10T12:00:00.000Z") },
    });
  });

  it("assinatura inválida ou corpo alterado é recusado", async () => {
    const cabecalhos = assinar(corpo);
    expect((await POST(requisicao(corpo.replace("delivered", "bounced"), cabecalhos))).status).toBe(401);
    expect((await POST(requisicao(corpo, { ...cabecalhos, "svix-signature": "v1,AAAA" }))).status).toBe(401);
    expect(prismaMock.emailEnviado.findUnique).not.toHaveBeenCalled();
  });

  it("sem segredo configurado, recusa com 503", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await POST(requisicao(corpo, assinar(corpo)))).status).toBe(503);
  });
});

describe("eventos de e-mail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não regride de clicado para aberto", async () => {
    prismaMock.emailEnviado.findUnique.mockResolvedValue({ id: "e1", status: "CLICADO", abertoEm: new Date(), clicadoEm: new Date(), para: "a@b.com" });
    const resultado = await processarEventoEmail({ type: "email.opened", data: { email_id: "re_1" } });
    expect(resultado.atualizado).toBe(false);
  });

  it("devolução definitiva e reclamação criam supressão; devolução temporária não", async () => {
    prismaMock.emailEnviado.findUnique.mockResolvedValue({ id: "e1", status: "ENVIADO", para: "a@b.com" });
    await processarEventoEmail({ type: "email.bounced", data: { email_id: "re_1", to: ["a@b.com"], bounce: { type: "Transient" } } });
    expect(prismaMock.supressaoEmail.upsert).not.toHaveBeenCalled();

    await processarEventoEmail({ type: "email.bounced", data: { email_id: "re_1", to: ["a@b.com"], bounce: { type: "Permanent", message: "não existe" } } });
    expect(prismaMock.supressaoEmail.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ motivo: "DEVOLUCAO" }) }));

    await processarEventoEmail({ type: "email.complained", data: { email_id: "re_1", to: ["a@b.com"] } });
    expect(prismaMock.supressaoEmail.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({ motivo: "RECLAMACAO" }) }));
  });
});
