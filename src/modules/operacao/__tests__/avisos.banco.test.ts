import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { textoLivreSeguro } from "@/modules/email/modelos/tarefas";
import { renderizarMarkdownEmail } from "@/modules/email/markdown";

const URL_BANCO = process.env.TESTE_BANCO_URL;

describe("texto do usuário dentro do e-mail", () => {
  it("não vira link, botão nem título", () => {
    const perigoso = "## [clique aqui](https://golpe.com) **urgente** [[Pagar|https://golpe.com]]";
    const seguro = textoLivreSeguro(perigoso);
    const { html } = renderizarMarkdownEmail(`Tarefa: ${seguro}`);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<h2");
    expect(html).not.toContain("<strong>");
    expect(seguro.length).toBeLessThanOrEqual(200);
  });
});

vi.unmock("@/lib/prisma");

describe.skipIf(!URL_BANCO)("avisos de tarefas por e-mail", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let tarefas: typeof import("../tarefas");
  let comentarios: typeof import("../comentarios");
  let emails: typeof import("../emails");
  let mencoes: typeof import("../dominio/mencoes");
  type Ctx = import("../contexto").ContextoOperacao;
  const sufixo = Date.now();
  const donoId = `av-dono-${sufixo}`;
  const comEmailId = `av-com-${sufixo}`;
  const semEmailId = `av-sem-${sufixo}`;
  let dono: Ctx;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_BANCO;
    vi.resetModules();
    prisma = (await import("@/lib/prisma")).prisma;
    const ctx = await import("../contexto");
    tarefas = await import("../tarefas");
    comentarios = await import("../comentarios");
    emails = await import("../emails");
    mencoes = await import("../dominio/mencoes");
    await prisma.user.create({ data: { id: donoId, email: `${donoId}@t.local`, name: "Dona", role: "ADMIN" } });
    await prisma.user.create({ data: { id: comEmailId, email: `${comEmailId}@t.local`, name: "Ana", role: "COMPRAS", contaId: donoId } });
    await prisma.user.create({
      data: { id: semEmailId, email: `${semEmailId}@t.local`, name: "Bia", role: "ESTOQUE", contaId: donoId, emailTarefas: false },
    });
    dono = ctx.contextoDoUsuario({ id: donoId, contaId: donoId, role: "ADMIN", name: "Dona", email: "d@t" });
    await ctx.garantirEstruturaPadrao(donoId, donoId);
  });

  afterAll(async () => {
    await prisma.emailEnviado.deleteMany({ where: { contaId: donoId } });
    for (const id of [comEmailId, semEmailId, donoId]) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  const emailsDe = (userId: string, modelo: string) => prisma.emailEnviado.count({ where: { userId, modelo } });

  it("atribuir manda e-mail só para quem deixou ligado", async () => {
    await tarefas.criarTarefa(dono, { titulo: "Conferir NF", responsavelId: comEmailId, prazo: { data: "2026-12-01", hora: "10:00" } });
    await tarefas.criarTarefa(dono, { titulo: "Contar caixas", responsavelId: semEmailId });
    expect(await emailsDe(comEmailId, "tarefa-atribuida")).toBe(1);
    expect(await emailsDe(semEmailId, "tarefa-atribuida")).toBe(0);
    expect(await prisma.notification.count({ where: { userId: semEmailId, type: "TAREFA" } })).toBe(1);
  });

  it("menção manda e-mail e repetir na mesma hora não duplica", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Falar com transportadora" });
    const corpo = `Pode ver isso ${mencoes.marcarMencao("Ana", comEmailId)}?`;
    await comentarios.comentar(dono, tarefa.id, corpo);
    await comentarios.comentar(dono, tarefa.id, corpo);
    expect(await emailsDe(comEmailId, "tarefa-mencao")).toBe(1);
  });

  it("resumo diário vai para quem tem atrasada ou para hoje, uma vez por dia", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Pagar boleto", responsavelId: comEmailId });
    await prisma.tarefa.update({ where: { id: tarefa.id }, data: { prazo: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } });
    const primeira = await emails.enviarResumosDiarios();
    expect(primeira.pessoas).toBeGreaterThanOrEqual(1);
    expect(await emailsDe(comEmailId, "resumo-tarefas")).toBe(1);
    await emails.enviarResumosDiarios();
    expect(await emailsDe(comEmailId, "resumo-tarefas")).toBe(1);
    expect(await emailsDe(semEmailId, "resumo-tarefas")).toBe(0);
  });
});
