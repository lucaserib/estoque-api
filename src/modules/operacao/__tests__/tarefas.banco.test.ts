import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_BANCO = process.env.TESTE_BANCO_URL;

vi.unmock("@/lib/prisma");

describe.skipIf(!URL_BANCO)("tarefas no Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let ctxMod: typeof import("../contexto");
  let tarefas: typeof import("../tarefas");
  let quadros: typeof import("../quadros");
  let consultas: typeof import("../consultas");
  let comentarios: typeof import("../comentarios");
  let checklist: typeof import("../checklist");
  let mencoes: typeof import("../dominio/mencoes");
  let ErroOperacao: typeof import("../erros").ErroOperacao;
  let SemPermissaoError: typeof import("@/lib/permissoes").SemPermissaoError;

  const sufixo = Date.now();
  const donoId = `op-dono-${sufixo}`;
  const membroId = `op-membro-${sufixo}`;
  const leitorId = `op-leitor-${sufixo}`;
  const outraContaId = `op-outra-${sufixo}`;

  type Ctx = import("../contexto").ContextoOperacao;
  let dono: Ctx;
  let membro: Ctx;
  let leitor: Ctx;
  let outra: Ctx;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_BANCO;
    vi.resetModules();
    prisma = (await import("@/lib/prisma")).prisma;
    ctxMod = await import("../contexto");
    tarefas = await import("../tarefas");
    quadros = await import("../quadros");
    consultas = await import("../consultas");
    comentarios = await import("../comentarios");
    checklist = await import("../checklist");
    mencoes = await import("../dominio/mencoes");
    ErroOperacao = (await import("../erros")).ErroOperacao;
    SemPermissaoError = (await import("@/lib/permissoes")).SemPermissaoError;

    await prisma.user.create({ data: { id: donoId, email: `${donoId}@t.local`, name: "Dona Loja", role: "ADMIN" } });
    await prisma.user.create({ data: { id: membroId, email: `${membroId}@t.local`, name: "Ana Estoque", role: "ESTOQUE", contaId: donoId } });
    await prisma.user.create({ data: { id: leitorId, email: `${leitorId}@t.local`, name: "Leo Leitura", role: "LEITURA", contaId: donoId } });
    await prisma.user.create({ data: { id: outraContaId, email: `${outraContaId}@t.local`, name: "Outra", role: "ADMIN" } });

    const montar = (id: string, contaId: string, role: "ADMIN" | "ESTOQUE" | "LEITURA", name: string) =>
      ctxMod.contextoDoUsuario({ id, contaId, role, name, email: `${id}@t.local` });
    dono = montar(donoId, donoId, "ADMIN", "Dona Loja");
    membro = montar(membroId, donoId, "ESTOQUE", "Ana Estoque");
    leitor = montar(leitorId, donoId, "LEITURA", "Leo Leitura");
    outra = montar(outraContaId, outraContaId, "ADMIN", "Outra");
    await ctxMod.garantirEstruturaPadrao(donoId, donoId);
  });

  afterAll(async () => {
    for (const id of [membroId, leitorId]) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    for (const id of [donoId, outraContaId]) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  async function colunas() {
    const quadro = await prisma.quadroTarefas.findFirstOrThrow({
      where: { contaId: donoId, padrao: true },
      include: { colunas: { orderBy: { posicao: "asc" } } },
    });
    return {
      quadro,
      aFazer: quadro.colunas.find((c) => c.papel === "A_FAZER")!,
      fazendo: quadro.colunas.find((c) => c.nome === "Fazendo")!,
      feito: quadro.colunas.find((c) => c.papel === "CONCLUIDA")!,
    };
  }

  it("cria com número sequencial, coluna a fazer, etiquetas, checklist e avisa o responsável", async () => {
    const etiqueta = await prisma.etiquetaTarefa.findFirstOrThrow({ where: { contaId: donoId, nome: "Compras" } });
    const { tarefa } = await tarefas.criarTarefa(dono, {
      titulo: "Cobrar fornecedor",
      responsavelId: membroId,
      etiquetaIds: [etiqueta.id],
      checklist: ["Ligar", "Mandar e-mail"],
      prazo: { data: "2026-11-20" },
    });
    const { tarefa: segunda } = await tarefas.criarTarefa(membro, { titulo: "Segunda" });
    const { aFazer } = await colunas();
    expect(tarefa.colunaId).toBe(aFazer.id);
    expect(segunda.numero).toBe(tarefa.numero + 1);
    expect(tarefa.etiquetas.map((e) => e.nome)).toEqual(["Compras"]);
    expect(tarefa.checklist).toEqual({ total: 2, feitos: 0 });
    const aviso = await prisma.notification.findFirst({ where: { userId: membroId, type: "TAREFA" } });
    expect(aviso?.link).toBe(`/operacao?tarefa=${tarefa.id}`);
  });

  it("recusa responsável só de leitura, de outra loja e etiqueta de outra loja", async () => {
    await expect(tarefas.criarTarefa(dono, { titulo: "x", responsavelId: leitorId })).rejects.toThrow(/leitura/);
    await expect(tarefas.criarTarefa(dono, { titulo: "x", responsavelId: outraContaId })).rejects.toThrow(/equipe/);
    await ctxMod.garantirEstruturaPadrao(outraContaId, outraContaId);
    const etiquetaAlheia = await prisma.etiquetaTarefa.findFirstOrThrow({ where: { contaId: outraContaId } });
    await expect(tarefas.criarTarefa(dono, { titulo: "x", etiquetaIds: [etiquetaAlheia.id] })).rejects.toThrow(/Etiqueta/);
    await expect(tarefas.criarTarefa(leitor, { titulo: "x" })).rejects.toBeInstanceOf(SemPermissaoError);
  });

  it("a mesma origem não duplica enquanto a tarefa está aberta", async () => {
    const entrada = { titulo: "Produtos sem custo", chaveOrigem: "controle:sem-custo" };
    const primeira = await tarefas.criarTarefa(dono, entrada);
    const [a, b] = await Promise.all([tarefas.criarTarefa(dono, entrada), tarefas.criarTarefa(membro, entrada)]);
    expect(primeira.existente).toBe(false);
    expect(a.tarefa.id).toBe(primeira.tarefa.id);
    expect(b.existente).toBe(true);
    await tarefas.executarAcao(dono, primeira.tarefa.id, "concluir");
    const nova = await tarefas.criarTarefa(dono, entrada);
    expect(nova.existente).toBe(false);
    expect(nova.tarefa.id).not.toBe(primeira.tarefa.id);
  });

  it("mover ordena entre vizinhos, conclui ao entrar em Feito e reabre ao sair", async () => {
    const { fazendo, feito } = await colunas();
    const t1 = (await tarefas.criarTarefa(dono, { titulo: "T1", colunaId: fazendo.id })).tarefa;
    const t2 = (await tarefas.criarTarefa(dono, { titulo: "T2", colunaId: fazendo.id })).tarefa;
    const t3 = (await tarefas.criarTarefa(membro, { titulo: "T3" })).tarefa;
    await tarefas.moverTarefa(dono, t3.id, { colunaId: fazendo.id, anteriorId: t1.id, seguinteId: t2.id });
    const ordem = await prisma.tarefa.findMany({ where: { colunaId: fazendo.id }, orderBy: { posicao: "asc" }, select: { id: true } });
    expect(ordem.map((t) => t.id)).toEqual([t1.id, t3.id, t2.id]);

    const concluida = await tarefas.moverTarefa(dono, t3.id, { colunaId: feito.id });
    expect(concluida.tarefa.concluidaEm).not.toBeNull();
    expect(concluida.tarefa.situacao).toBe("concluida");
    expect(await prisma.notification.count({ where: { userId: membroId, title: "Tarefa concluída" } })).toBe(1);
    const reaberta = await tarefas.moverTarefa(dono, t3.id, { colunaId: fazendo.id, seguinteId: t1.id });
    expect(reaberta.tarefa.concluidaEm).toBeNull();
    const tipos = (await prisma.atividadeTarefa.findMany({ where: { tarefaId: t3.id }, orderBy: { createdAt: "asc" } })).map((a) => a.tipo);
    expect(tipos).toEqual(["CRIADA", "MOVIDA", "MOVIDA", "CONCLUIDA", "MOVIDA", "REABERTA"]);
  });

  it("renumera a coluna quando não cabe mais nada entre dois cartões", async () => {
    const { quadro } = await colunas();
    const coluna = await prisma.colunaTarefas.create({ data: { quadroId: quadro.id, nome: "Apertada", papel: "EM_ANDAMENTO", posicao: 999 } });
    const a = (await tarefas.criarTarefa(dono, { titulo: "A", colunaId: coluna.id })).tarefa;
    const b = (await tarefas.criarTarefa(dono, { titulo: "B", colunaId: coluna.id })).tarefa;
    await prisma.tarefa.update({ where: { id: b.id }, data: { posicao: a.posicao + 1e-7 } });
    const c = (await tarefas.criarTarefa(dono, { titulo: "C" })).tarefa;
    await tarefas.moverTarefa(dono, c.id, { colunaId: coluna.id, anteriorId: a.id, seguinteId: b.id });
    const ordem = await prisma.tarefa.findMany({ where: { colunaId: coluna.id }, orderBy: { posicao: "asc" }, select: { id: true } });
    expect(ordem.map((t) => t.id)).toEqual([a.id, c.id, b.id]);
  });

  it("rotina concluída gera a próxima uma vez só", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, {
      titulo: "Enviar Full",
      prazo: { data: "2026-11-09" },
      recorrencia: { frequencia: "SEMANAL", intervalo: 1, diasSemana: [1], diaDoMes: null, ate: null },
      checklist: ["Separar", "Etiquetar"],
    });
    const primeira = await tarefas.executarAcao(dono, tarefa.id, "concluir");
    expect(primeira.proxima).not.toBeNull();
    expect(primeira.proxima!.prazoData).not.toBe("2026-11-09");
    expect(primeira.proxima!.checklist).toEqual({ total: 2, feitos: 0 });
    expect(primeira.proxima!.origem).toBe("RECORRENCIA");
    await tarefas.executarAcao(dono, tarefa.id, "reabrir");
    const segunda = await tarefas.executarAcao(dono, tarefa.id, "concluir");
    expect(segunda.proxima).toBeNull();
    const serie = await prisma.tarefa.findUniqueOrThrow({ where: { id: tarefa.id }, select: { serieId: true } });
    expect(await prisma.tarefa.count({ where: { serieId: serie.serieId } })).toBe(2);
  });

  it("edição com versão antiga dá conflito e registra o histórico das mudanças", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Versão" });
    const detalhe = await tarefas.detalharTarefa(dono, tarefa.id);
    await tarefas.atualizarTarefa(membro, tarefa.id, { titulo: "Versão nova", prioridade: "URGENTE", responsavelId: membroId, versao: detalhe.versao });
    const erro = await tarefas.atualizarTarefa(dono, tarefa.id, { titulo: "Atrasada", versao: detalhe.versao }).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroOperacao);
    expect(erro.status).toBe(409);
    const tipos = (await prisma.atividadeTarefa.findMany({ where: { tarefaId: tarefa.id } })).map((a) => a.tipo).sort();
    expect(tipos).toEqual(["ATRIBUIDA", "CRIADA", "EDITADA", "PRIORIDADE"]);
  });

  it("edições de campos diferentes ao mesmo tempo, sem versão, não dão conflito", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Rápida" });
    await Promise.all([
      tarefas.atualizarTarefa(dono, tarefa.id, { prioridade: "URGENTE" }),
      tarefas.atualizarTarefa(membro, tarefa.id, { prazo: { data: "2030-01-15" } }),
    ]);
    const final = await tarefas.detalharTarefa(dono, tarefa.id);
    expect(final.prioridade).toBe("URGENTE");
    expect(final.prazoData).toBe("2030-01-15");
  });

  it("outra loja não vê nem mexe na tarefa", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Privada da loja" });
    await expect(tarefas.detalharTarefa(outra, tarefa.id)).rejects.toThrow(/não encontrada/);
    await expect(tarefas.atualizarTarefa(outra, tarefa.id, { titulo: "hack" })).rejects.toThrow(/não encontrada/);
    await expect(tarefas.executarAcao(outra, tarefa.id, "arquivar")).rejects.toThrow(/não encontrada/);
    const { colunaId } = tarefa;
    const alheia = await prisma.colunaTarefas.findFirstOrThrow({ where: { quadro: { contaId: outraContaId } } });
    await expect(tarefas.moverTarefa(dono, tarefa.id, { colunaId: alheia.id })).rejects.toThrow(/Coluna/);
    expect((await prisma.tarefa.findUniqueOrThrow({ where: { id: tarefa.id } })).colunaId).toBe(colunaId);
  });

  it("excluir de vez só para ADMIN e só arquivada", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Lixo" });
    await expect(tarefas.excluirTarefa(dono, tarefa.id)).rejects.toThrow(/Arquive/);
    await tarefas.executarAcao(membro, tarefa.id, "arquivar");
    await expect(tarefas.excluirTarefa(membro, tarefa.id)).rejects.toBeInstanceOf(SemPermissaoError);
    await tarefas.excluirTarefa(dono, tarefa.id);
    expect(await prisma.tarefa.count({ where: { id: tarefa.id } })).toBe(0);
  });

  it("duplicar copia campos, etiquetas e checklist desmarcado", async () => {
    const etiqueta = await prisma.etiquetaTarefa.findFirstOrThrow({ where: { contaId: donoId, nome: "Full" } });
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Modelo", etiquetaIds: [etiqueta.id], checklist: ["a"] });
    const item = await prisma.itemChecklistTarefa.findFirstOrThrow({ where: { tarefaId: tarefa.id } });
    await checklist.atualizarItem(dono, item.id, { concluido: true });
    const { tarefa: copia } = await tarefas.executarAcao(dono, tarefa.id, "duplicar");
    expect(copia.titulo).toBe("Modelo (cópia)");
    expect(copia.etiquetas.map((e) => e.nome)).toEqual(["Full"]);
    expect(copia.checklist).toEqual({ total: 1, feitos: 0 });
  });

  it("comentário guarda só menções da equipe e avisa quem foi mencionado", async () => {
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Discutir" });
    const corpo = `Olha isso ${mencoes.marcarMencao("Ana", membroId)} e ${mencoes.marcarMencao("Estranho", outraContaId)}`;
    const comentario = await comentarios.comentar(dono, tarefa.id, corpo);
    expect(mencoes.extrairMencoes(comentario.corpo)).toEqual([membroId]);
    expect(await prisma.notification.count({ where: { userId: membroId, title: "Dona Loja mencionou você" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: outraContaId } })).toBe(0);
    await expect(comentarios.editarComentario(membro, comentario.id, "mudei")).rejects.toThrow(/Só quem escreveu/);
    await comentarios.apagarComentario(dono, comentario.id);
  });

  it("colunas mantêm a regra de a fazer e concluídas e exigem destino para as tarefas", async () => {
    const quadro = await quadros.criarQuadro(dono, { nome: "Marketing", cor: "rosa" });
    const aFazer = quadro.colunas.find((c) => c.papel === "A_FAZER")!;
    const feito = quadro.colunas.find((c) => c.papel === "CONCLUIDA")!;
    await expect(quadros.apagarColuna(dono, feito.id, null)).rejects.toThrow(/concluídas/);
    const nova = await quadros.criarColuna(dono, quadro.id, { nome: "Revisão", papel: "EM_ANDAMENTO" });
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Post", colunaId: nova.id });
    await expect(quadros.apagarColuna(dono, nova.id, null)).rejects.toThrow(/Escolha/);
    await quadros.apagarColuna(dono, nova.id, feito.id);
    const movida = await prisma.tarefa.findUniqueOrThrow({ where: { id: tarefa.id } });
    expect(movida.colunaId).toBe(feito.id);
    expect(movida.concluidaEm).not.toBeNull();
    await expect(quadros.atualizarColuna(dono, aFazer.id, { papel: "EM_ANDAMENTO" })).rejects.toThrow(/a fazer/);
    await expect(quadros.criarQuadro(membro, { nome: "x", cor: "azul" })).rejects.toBeInstanceOf(SemPermissaoError);
  });

  it("não arquiva o último quadro e passa o padrão adiante", async () => {
    const quadrosAtivos = await prisma.quadroTarefas.findMany({ where: { contaId: outraContaId, arquivadoEm: null } });
    expect(quadrosAtivos).toHaveLength(1);
    await expect(quadros.atualizarQuadro(outra, quadrosAtivos[0].id, { arquivado: true })).rejects.toThrow(/pelo menos um quadro/);
    const segundo = await quadros.criarQuadro(outra, { nome: "Segundo", cor: "verde" });
    await quadros.atualizarQuadro(outra, quadrosAtivos[0].id, { arquivado: true });
    expect((await prisma.quadroTarefas.findUniqueOrThrow({ where: { id: segundo.id } })).padrao).toBe(true);
  });

  it("lista filtra por situação, pessoa e número, e o resumo conta o que é meu", async () => {
    const ontem = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Vencida da Ana", responsavelId: membroId });
    await prisma.tarefa.update({ where: { id: tarefa.id }, data: { prazo: ontem } });
    const atrasadas = await consultas.listarTarefas(membro, {
      escopo: "minhas",
      situacao: "atrasadas",
      ordem: "prazo",
      pagina: 1,
      porPagina: 50,
    });
    expect(atrasadas.itens.map((t) => t.id)).toContain(tarefa.id);
    expect(atrasadas.itens.every((t) => t.responsavel?.id === membroId && t.situacao === "atrasada")).toBe(true);
    const porNumero = await consultas.listarTarefas(dono, { escopo: "equipe", situacao: "todas", ordem: "prazo", pagina: 1, porPagina: 5, busca: `#${tarefa.numero}` });
    expect(porNumero.itens.map((t) => t.id)).toEqual([tarefa.id]);
    const resumo = await consultas.resumoOperacao(membro);
    expect(resumo.minhas.atrasadas).toBeGreaterThanOrEqual(1);
    expect(resumo.equipe).toBeNull();
    const doDono = await consultas.resumoOperacao(dono);
    expect(doDono.equipe?.find((p) => p.id === membroId)?.atrasadas).toBeGreaterThanOrEqual(1);
    expect(doDono.equipe?.some((p) => p.id === leitorId)).toBe(false);
  });

  it("quadro esconde concluídas antigas e o leitor só lê", async () => {
    const { quadro, feito } = await colunas();
    const { tarefa } = await tarefas.criarTarefa(dono, { titulo: "Velha" });
    await tarefas.executarAcao(dono, tarefa.id, "concluir");
    await prisma.tarefa.update({ where: { id: tarefa.id }, data: { concluidaEm: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) } });
    const visao = await consultas.carregarQuadro(leitor, quadro.id, {});
    const colunaFeito = visao.colunas.find((c) => c.id === feito.id)!;
    expect(colunaFeito.tarefas.some((t) => t.id === tarefa.id)).toBe(false);
    expect(colunaFeito.ocultas).toBeGreaterThanOrEqual(1);
    const completa = await consultas.carregarQuadro(leitor, quadro.id, { mostrarConcluidas: true });
    expect(completa.colunas.find((c) => c.id === feito.id)!.tarefas.some((t) => t.id === tarefa.id)).toBe(true);
    await expect(tarefas.moverTarefa(leitor, tarefa.id, { colunaId: feito.id })).rejects.toBeInstanceOf(SemPermissaoError);
  });
});
