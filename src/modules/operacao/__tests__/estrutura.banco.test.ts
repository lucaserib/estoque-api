import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_BANCO = process.env.TESTE_BANCO_URL;

vi.unmock("@/lib/prisma");

describe.skipIf(!URL_BANCO)("estrutura padrão e numeração no Postgres", () => {
  let contexto: typeof import("../contexto");
  let prisma: typeof import("@/lib/prisma").prisma;
  const contaId = `teste-operacao-${Date.now()}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_BANCO;
    vi.resetModules();
    contexto = await import("../contexto");
    prisma = (await import("@/lib/prisma")).prisma;
    await prisma.user.create({ data: { id: contaId, email: `${contaId}@teste.local`, name: "Dona Teste" } });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: contaId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("primeiro acesso simultâneo cria um quadro só, com colunas e etiquetas", async () => {
    await Promise.all(Array.from({ length: 5 }, () => contexto.garantirEstruturaPadrao(contaId, contaId)));
    const quadros = await prisma.quadroTarefas.findMany({ where: { contaId }, include: { colunas: true } });
    expect(quadros).toHaveLength(1);
    expect(quadros[0].padrao).toBe(true);
    expect(quadros[0].colunas.map((c) => c.papel).sort()).toEqual(["A_FAZER", "CONCLUIDA", "EM_ANDAMENTO", "EM_ANDAMENTO"]);
    expect(await prisma.etiquetaTarefa.count({ where: { contaId } })).toBe(8);
  });

  it("numeração é sequencial e sem repetição sob concorrência", async () => {
    const numeros = await Promise.all(
      Array.from({ length: 20 }, () => prisma.$transaction((tx) => contexto.proximoNumero(tx, contaId, "tarefa")))
    );
    expect(new Set(numeros).size).toBe(20);
    expect(Math.min(...numeros)).toBe(1);
    expect(Math.max(...numeros)).toBe(20);
  });

  it("apagar a conta leva quadros, colunas e tarefas junto", async () => {
    const quadro = await prisma.quadroTarefas.findFirstOrThrow({ where: { contaId }, include: { colunas: true } });
    await prisma.tarefa.create({
      data: { contaId, numero: 999, quadroId: quadro.id, colunaId: quadro.colunas[0].id, titulo: "Teste", posicao: 1024 },
    });
    await prisma.user.delete({ where: { id: contaId } });
    expect(await prisma.quadroTarefas.count({ where: { contaId } })).toBe(0);
    expect(await prisma.tarefa.count({ where: { contaId } })).toBe(0);
  });
});
