import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_BANCO = process.env.TESTE_BANCO_URL;

vi.unmock("@/lib/prisma");

describe.skipIf(!URL_BANCO)("ideias e notas no Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let notas: typeof import("../notas");
  let tarefas: typeof import("../tarefas");
  let rotinas: typeof import("../rotinas");
  let SemPermissaoError: typeof import("@/lib/permissoes").SemPermissaoError;
  type Ctx = import("../contexto").ContextoOperacao;
  const sufixo = Date.now();
  const donoId = `nt-dono-${sufixo}`;
  const membroId = `nt-membro-${sufixo}`;
  const leitorId = `nt-leitor-${sufixo}`;
  let dono: Ctx;
  let membro: Ctx;
  let leitor: Ctx;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_BANCO;
    vi.resetModules();
    prisma = (await import("@/lib/prisma")).prisma;
    const ctx = await import("../contexto");
    notas = await import("../notas");
    tarefas = await import("../tarefas");
    rotinas = await import("../rotinas");
    SemPermissaoError = (await import("@/lib/permissoes")).SemPermissaoError;
    await prisma.user.create({ data: { id: donoId, email: `${donoId}@t.local`, name: "Dona", role: "ADMIN" } });
    await prisma.user.create({ data: { id: membroId, email: `${membroId}@t.local`, name: "Ana", role: "VENDAS", contaId: donoId } });
    await prisma.user.create({ data: { id: leitorId, email: `${leitorId}@t.local`, name: "Leo", role: "LEITURA", contaId: donoId } });
    dono = ctx.contextoDoUsuario({ id: donoId, contaId: donoId, role: "ADMIN", name: "Dona", email: "d@t" });
    membro = ctx.contextoDoUsuario({ id: membroId, contaId: donoId, role: "VENDAS", name: "Ana", email: "a@t" });
    leitor = ctx.contextoDoUsuario({ id: leitorId, contaId: donoId, role: "LEITURA", name: "Leo", email: "l@t" });
    await ctx.garantirEstruturaPadrao(donoId, donoId);
  });

  afterAll(async () => {
    for (const id of [membroId, leitorId, donoId]) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  const filtros = { tipo: "TODAS" as const, visibilidade: "TODAS" as const, arquivadas: false };

  it("nota privada só aparece para quem escreveu, nem para o administrador", async () => {
    const privada = await notas.criarNota(membro, { tipo: "NOTA", conteudo: "Senha do fornecedor X", cor: "cinza", fixada: false, visibilidade: "PRIVADA" });
    const daEquipe = await notas.criarNota(membro, { tipo: "IDEIA", conteudo: "Kit com 3 unidades", cor: "amarelo", fixada: false, visibilidade: "EQUIPE" });
    expect((await notas.listarNotas(membro, filtros)).map((n) => n.id)).toEqual(expect.arrayContaining([privada.id, daEquipe.id]));
    const doDono = (await notas.listarNotas(dono, filtros)).map((n) => n.id);
    expect(doDono).toContain(daEquipe.id);
    expect(doDono).not.toContain(privada.id);
    await expect(notas.atualizarNota(dono, privada.id, { conteudo: "x" })).rejects.toThrow(/não encontrada/);
    await expect(notas.apagarNota(dono, privada.id)).rejects.toThrow(/não encontrada/);
  });

  it("apoio liga e desliga, e não vale em nota privada", async () => {
    const ideia = await notas.criarNota(dono, { tipo: "IDEIA", conteudo: "Vender no Shopee", cor: "verde", fixada: false, visibilidade: "EQUIPE" });
    const [a, b] = await Promise.all([notas.apoiarNota(membro, ideia.id), notas.apoiarNota(dono, ideia.id)]);
    expect(Math.max(a.apoios, b.apoios)).toBe(2);
    const desfeito = await notas.apoiarNota(membro, ideia.id);
    expect(desfeito).toMatchObject({ apoios: 1, apoiadaPorMim: false });
    const minha = await notas.criarNota(dono, { tipo: "IDEIA", conteudo: "segredo", cor: "rosa", fixada: false, visibilidade: "PRIVADA" });
    await expect(notas.apoiarNota(dono, minha.id)).rejects.toThrow(/não encontrada/);
    await expect(notas.apoiarNota(leitor, ideia.id)).rejects.toBeInstanceOf(SemPermissaoError);
  });

  it("nota da equipe: o autor e o administrador mexem, outro membro não", async () => {
    const nota = await notas.criarNota(dono, { tipo: "NOTA", conteudo: "Horário da transportadora", cor: "azul", fixada: false, visibilidade: "EQUIPE" });
    await expect(notas.atualizarNota(membro, nota.id, { conteudo: "mudei" })).rejects.toThrow(/Só quem escreveu/);
    const daAna = await notas.criarNota(membro, { tipo: "NOTA", conteudo: "Ideia da Ana", cor: "azul", fixada: false, visibilidade: "EQUIPE" });
    expect((await notas.atualizarNota(dono, daAna.id, { fixada: true })).fixada).toBe(true);
    await expect(notas.atualizarNota(dono, daAna.id, { visibilidade: "PRIVADA" })).rejects.toThrow(/quem vê/);
  });

  it("virar tarefa liga a nota à tarefa", async () => {
    const ideia = await notas.criarNota(membro, { tipo: "IDEIA", conteudo: "Testar anúncio premium", cor: "laranja", fixada: false, visibilidade: "EQUIPE" });
    const { tarefa } = await tarefas.criarTarefa(membro, { titulo: "Testar anúncio premium", notaId: ideia.id });
    const lista = await notas.listarNotas(membro, { ...filtros, tipo: "IDEIA" });
    expect(lista.find((n) => n.id === ideia.id)?.tarefa).toMatchObject({ id: tarefa.id, numero: tarefa.numero });
    const detalhe = await tarefas.detalharTarefa(membro, tarefa.id);
    expect(detalhe.notaOrigem?.id).toBe(ideia.id);
  });

  it("rotinas sugeridas não duplicam, nem depois de concluir a primeira", async () => {
    const criadas = await rotinas.criarRotinas(dono, ["full-semanal", "despesas-mes"]);
    expect(criadas).toHaveLength(2);
    expect(criadas.every((t) => t.recorrente && t.prazoData)).toBe(true);
    expect(await rotinas.criarRotinas(dono, ["full-semanal"])).toHaveLength(0);
    const full = criadas.find((t) => t.titulo.includes("Full"))!;
    const { proxima } = await tarefas.executarAcao(dono, full.id, "concluir");
    expect(proxima).not.toBeNull();
    expect(await rotinas.criarRotinas(dono, ["full-semanal"])).toHaveLength(0);
    const lista = await rotinas.listarRotinas(dono);
    expect(lista.find((r) => r.chave === "full-semanal")?.ativa).toBe(true);
    expect(lista.find((r) => r.chave === "perguntas-ml")?.ativa).toBe(false);
  });
});
