import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  conversaIa: {
    findFirst: vi.fn(),
    create: vi.fn(async () => ({ id: "conv-1" })),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 1 })),
    delete: vi.fn(async () => ({})),
  },
  mensagemIa: {
    findMany: vi.fn(async () => []),
    create: vi.fn(async ({ data }: { data: { papel: string } }) => ({ id: data.papel === "USUARIO" ? "msg-u" : "msg-a" })),
    delete: vi.fn(async () => ({})),
  },
  user: { findUnique: vi.fn(async () => ({ name: "Loja Teste" })) },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const consumo = { base: "MENSAGENS", percentual: 10, esgotado: false };
const acessoMock = {
  garantirAcessoIa: vi.fn(async () => ({ liberada: true, ilimitada: false })),
  obterAcessoIa: vi.fn(async () => ({ consumo, saldo: 4, ilimitada: false })),
};
vi.mock("../acesso", () => acessoMock);

const consumoMock = {
  cobrarUsoIa: vi.fn(async () => ({ debitado: 1, saldoAntes: 5, saldoApos: 4, repetido: false, custo: 1 })),
  registrarPrimeiraPergunta: vi.fn(async () => undefined),
};
vi.mock("../consumo", () => consumoMock);

const creditosMock = { estornarCreditos: vi.fn(async () => 1) };
vi.mock("../creditos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../creditos")>()),
  ...creditosMock,
}));

const registrarUsoIa = vi.fn(async () => undefined);
vi.mock("../uso", () => ({ registrarUsoIa }));

const executarFerramenta = vi.fn();
vi.mock("../ferramentas/registro", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ferramentas/registro")>()),
  executarFerramenta,
}));

const { responderPergunta, gerarTituloConversa, MAX_ITERACOES } = await import("../assistente");
const { IaCanceladaError, IaIndisponivelError } = await import("../erros");
const { AVISO_LIMITE_CONSULTAS, RESPOSTA_RECUSA } = await import("../prompts/assistente");

type Bloco = Record<string, unknown>;
interface Roteiro {
  texto?: string;
  ferramentas?: Array<{ id: string; nome: string; entrada?: Record<string, unknown> }>;
  stop?: string;
  erro?: Error;
}

function provedorRoteirizado(roteiros: Roteiro[] | ((indice: number) => Roteiro)) {
  const chamadas: Array<Record<string, unknown>> = [];
  const transmitirMensagem = vi.fn(async (parametros: Record<string, unknown>, aoTexto: (d: string) => void) => {
    const indice = chamadas.length;
    chamadas.push(structuredClone({ ...parametros, sinal: undefined }));
    const roteiro = typeof roteiros === "function" ? roteiros(indice) : roteiros[indice];
    if (roteiro.erro) throw roteiro.erro;
    const content: Bloco[] = [];
    if (roteiro.texto) {
      aoTexto(roteiro.texto);
      content.push({ type: "text", text: roteiro.texto });
    }
    for (const f of roteiro.ferramentas ?? []) content.push({ type: "tool_use", id: f.id, name: f.nome, input: f.entrada ?? {} });
    return {
      content,
      stop_reason: roteiro.stop ?? (roteiro.ferramentas?.length ? "tool_use" : "end_turn"),
      usage: { input_tokens: 100, output_tokens: 20 },
    };
  });
  return { provedor: { transmitirMensagem, criarMensagem: vi.fn() }, chamadas };
}

const usuario = { id: "user-1", contaId: "conta-1", role: "ADMIN" as const };

function coletar() {
  const eventos: Array<Record<string, unknown>> = [];
  return { eventos, emitir: (e: Record<string, unknown>) => eventos.push(e) };
}

beforeEach(() => {
  vi.clearAllMocks();
  executarFerramenta.mockImplementation(async (nome: string, entrada: unknown) => ({
    nome,
    rotulo: `Rótulo ${nome}`,
    entrada,
    conteudo: `<dados_da_loja>\n{"fonte":"Reposição","de":"${nome}"}\n</dados_da_loja>`,
    erro: false,
    duracaoMs: 5,
  }));
});

describe("responderPergunta", () => {
  it("chama uma ferramenta, devolve o resultado ao modelo e grava pergunta e resposta", async () => {
    const { provedor, chamadas } = provedorRoteirizado([
      { texto: "Vou olhar a reposição.", ferramentas: [{ id: "t1", nome: "sugestao_reposicao", entrada: { urgencia: "critico" } }] },
      { texto: "Compre **30 unidades** do Borrifador. Confira em [Reposição](/reposicao)." },
    ]);
    const { eventos, emitir } = coletar();

    const r = await responderPergunta({ usuario, mensagem: "O que comprar?", paginaAtual: "/reposicao", emitir, provedor: provedor as never });

    expect(r).toMatchObject({ conversaId: "conv-1", mensagemId: "msg-a", novaConversa: true });
    expect(eventos.map((e) => e.tipo)).toEqual(["conversa", "texto", "texto", "ferramenta", "ferramenta", "texto", "fim"]);
    expect(eventos[3]).toMatchObject({ nome: "sugestao_reposicao", estado: "inicio" });
    expect(eventos[4]).toMatchObject({ estado: "fim" });
    expect(eventos.at(-1)).toMatchObject({ tipo: "fim", mensagemId: "msg-a", consumo });

    expect(executarFerramenta).toHaveBeenCalledWith("sugestao_reposicao", { urgencia: "critico" }, expect.objectContaining({ contaId: "conta-1", userId: "user-1", podeVerCusto: true }));
    const segunda = chamadas[1].mensagens as Array<{ role: string; content: unknown }>;
    expect(segunda.at(-2)?.role).toBe("assistant");
    expect(segunda.at(-1)).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1" }] });
    expect(String(chamadas[0].sistemaVariavel)).toContain("Loja: Loja Teste");
    expect(String(chamadas[0].sistemaVariavel)).toContain("Tela aberta agora: Reposição");
    expect((chamadas[0].ferramentas as unknown[]).length).toBe(13);

    const salvas = prismaMock.mensagemIa.create.mock.calls.map((c) => (c as unknown as [{ data: Record<string, unknown> }])[0].data);
    expect(salvas[0]).toMatchObject({ papel: "USUARIO", conteudo: "O que comprar?" });
    expect(salvas[1]).toMatchObject({ papel: "ASSISTENTE", ferramentas: [{ nome: "sugestao_reposicao", erro: false, duracaoMs: 5 }] });
    expect(String(salvas[1].conteudo)).toContain("Compre **30 unidades**");
    expect(JSON.stringify(salvas[1].ferramentas)).not.toContain("dados_da_loja");
    expect(registrarUsoIa).toHaveBeenCalledTimes(2);
    expect(prismaMock.conversaIa.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "conta-1", autorId: "user-1" }) }));
  });

  it("executa várias ferramentas do mesmo turno em paralelo e devolve todos os resultados juntos", async () => {
    let simultaneas = 0;
    let maximo = 0;
    executarFerramenta.mockImplementation(async (nome: string) => {
      simultaneas++;
      maximo = Math.max(maximo, simultaneas);
      await new Promise((r) => setTimeout(r, 20));
      simultaneas--;
      return { nome, rotulo: nome, entrada: {}, conteudo: "ok", erro: false, duracaoMs: 20 };
    });
    const { provedor, chamadas } = provedorRoteirizado([
      { ferramentas: [{ id: "a", nome: "resumo_financeiro" }, { id: "b", nome: "saude_anuncios" }] },
      { texto: "Pronto." },
    ]);
    await responderPergunta({ usuario, mensagem: "Como estou?", emitir: () => undefined, provedor: provedor as never });

    expect(maximo).toBe(2);
    const resultados = (chamadas[1].mensagens as Array<{ content: Array<{ type: string; tool_use_id: string }> }>).at(-1)!.content;
    expect(resultados.map((r) => r.tool_use_id)).toEqual(["a", "b"]);
  });

  it("erro de ferramenta vira tool_result com is_error e a conversa continua", async () => {
    executarFerramenta.mockResolvedValueOnce({ nome: "detalhe_produto", rotulo: "Ficha", entrada: {}, conteudo: "Produto não encontrado", erro: true, duracaoMs: 1 });
    const { provedor, chamadas } = provedorRoteirizado([
      { ferramentas: [{ id: "x", nome: "detalhe_produto" }] },
      { texto: "Não achei esse produto." },
    ]);
    const { eventos, emitir } = coletar();
    const r = await responderPergunta({ usuario, mensagem: "E o SKU X?", emitir, provedor: provedor as never });

    expect(eventos.find((e) => e.tipo === "ferramenta" && e.estado === "erro")).toBeTruthy();
    expect((chamadas[1].mensagens as Array<{ content: unknown }>).at(-1)!.content).toEqual([
      { type: "tool_result", tool_use_id: "x", content: "Produto não encontrado", is_error: true },
    ]);
    expect(r.resposta).toBe("Não achei esse produto.");
  });

  it(`para depois de ${MAX_ITERACOES} rodadas de ferramenta e pede a resposta com o que tem`, async () => {
    const { provedor, chamadas } = provedorRoteirizado((i) =>
      i < MAX_ITERACOES ? { ferramentas: [{ id: `t${i}`, nome: "diagnostico_loja" }] } : { texto: "Resposta com o que tenho." }
    );
    const r = await responderPergunta({ usuario, mensagem: "Analise tudo", emitir: () => undefined, provedor: provedor as never });

    expect(chamadas).toHaveLength(MAX_ITERACOES + 1);
    expect(executarFerramenta).toHaveBeenCalledTimes(MAX_ITERACOES);
    expect(chamadas.slice(0, MAX_ITERACOES).every((c) => !c.semFerramentas)).toBe(true);
    expect(chamadas[MAX_ITERACOES].semFerramentas).toBe(true);
    const ultimaPergunta = (chamadas[MAX_ITERACOES].mensagens as Array<{ content: Array<{ type: string; text?: string }> }>).at(-1)!;
    expect(ultimaPergunta.content.at(-1)).toEqual({ type: "text", text: AVISO_LIMITE_CONSULTAS });
    expect(r.resposta).toBe("Resposta com o que tenho.");
  });

  it("respeita o cancelamento: guarda o texto parcial e não emite erro", async () => {
    const controlador = new AbortController();
    const { provedor } = provedorRoteirizado([
      { texto: "Começando a resposta", ferramentas: [{ id: "t", nome: "diagnostico_loja" }] },
      { erro: new IaCanceladaError() },
    ]);
    executarFerramenta.mockImplementationOnce(async (nome: string) => {
      controlador.abort();
      return { nome, rotulo: nome, entrada: {}, conteudo: "ok", erro: false, duracaoMs: 1 };
    });
    const { eventos, emitir } = coletar();
    const r = await responderPergunta({ usuario, mensagem: "Pergunta", emitir, provedor: provedor as never, sinal: controlador.signal });

    expect(eventos.some((e) => e.tipo === "erro")).toBe(false);
    expect(eventos.some((e) => e.tipo === "fim")).toBe(false);
    const salva = prismaMock.mensagemIa.create.mock.calls.at(-1) as unknown as [{ data: { papel: string; conteudo: string } }];
    expect(salva[0].data.papel).toBe("ASSISTENTE");
    expect(salva[0].data.conteudo).toContain("Começando a resposta");
    expect(salva[0].data.conteudo).toContain("resposta interrompida");
    expect(r.mensagemId).toBe("msg-a");
  });

  it("falha do provedor antes de qualquer texto: avisa e descarta a pergunta e a conversa nova", async () => {
    const { provedor } = provedorRoteirizado([{ erro: new IaIndisponivelError("A IA está instável agora, tente em alguns minutos.", "FALHA_PROVEDOR", "HTTP_529") }]);
    const { eventos, emitir } = coletar();
    await responderPergunta({ usuario, mensagem: "Oi", emitir, provedor: provedor as never });

    expect(eventos.at(-1)).toEqual({
      tipo: "erro",
      codigo: "FALHA_PROVEDOR",
      mensagem: "A IA está instável agora, tente em alguns minutos.",
      conversaDescartada: true,
    });
    expect(prismaMock.mensagemIa.delete).toHaveBeenCalledWith({ where: { id: "msg-u" } });
    expect(prismaMock.conversaIa.delete).toHaveBeenCalledWith({ where: { id: "conv-1" } });
    expect(registrarUsoIa).toHaveBeenCalledWith(expect.objectContaining({ sucesso: false, codigoErro: "HTTP_529" }));
    expect(creditosMock.estornarCreditos).toHaveBeenCalledWith("chat:msg-u");
  });

  it("cobra a pergunta depois de gravá-la e devolve o saldo no fim", async () => {
    const { provedor } = provedorRoteirizado([{ texto: "Tudo certo." }]);
    const { eventos, emitir } = coletar();
    await responderPergunta({ usuario, mensagem: "Oi", emitir, provedor: provedor as never });
    expect(consumoMock.cobrarUsoIa).toHaveBeenCalledWith(
      expect.objectContaining({ contaId: "conta-1", autorId: "user-1", recurso: "CHAT", chave: "chat:msg-u", ilimitada: false })
    );
    expect(creditosMock.estornarCreditos).not.toHaveBeenCalled();
    expect(eventos.at(-1)).toMatchObject({ tipo: "fim", creditos: { saldo: 4, ilimitada: false } });
  });

  it("sem saldo na hora de cobrar: descarta a pergunta e avisa SEM_CREDITOS", async () => {
    const { SemCreditosIaError } = await import("../creditos");
    consumoMock.cobrarUsoIa.mockRejectedValueOnce(new SemCreditosIaError(0, 1));
    const { provedor } = provedorRoteirizado([]);
    const { eventos, emitir } = coletar();
    await responderPergunta({ usuario, mensagem: "Oi", emitir, provedor: provedor as never });
    expect(eventos.at(-1)).toMatchObject({ tipo: "erro", codigo: "SEM_CREDITOS", conversaDescartada: true });
    expect(provedor.transmitirMensagem).not.toHaveBeenCalled();
    expect(creditosMock.estornarCreditos).not.toHaveBeenCalled();
    expect(prismaMock.mensagemIa.delete).toHaveBeenCalledWith({ where: { id: "msg-u" } });
  });

  it("sem acesso não cria conversa e devolve o código do bloqueio", async () => {
    acessoMock.garantirAcessoIa.mockRejectedValueOnce(new IaIndisponivelError("Plano com IA", "NAO_CONTRATADA"));
    const { provedor } = provedorRoteirizado([]);
    const { eventos, emitir } = coletar();
    await responderPergunta({ usuario, mensagem: "Oi", emitir, provedor: provedor as never });
    expect(eventos).toEqual([{ tipo: "erro", codigo: "NAO_CONTRATADA", mensagem: "Plano com IA", conversaDescartada: false }]);
    expect(prismaMock.conversaIa.create).not.toHaveBeenCalled();
    expect(provedor.transmitirMensagem).not.toHaveBeenCalled();
  });

  it("não abre conversa de outro usuário", async () => {
    prismaMock.conversaIa.findFirst.mockResolvedValueOnce(null);
    const { provedor } = provedorRoteirizado([]);
    const { eventos, emitir } = coletar();
    await responderPergunta({ usuario, conversaId: "de-outro", mensagem: "Oi", emitir, provedor: provedor as never });
    expect(prismaMock.conversaIa.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "de-outro", autorId: "user-1", userId: "conta-1" }) })
    );
    expect(eventos[0]).toMatchObject({ tipo: "erro", codigo: "CONVERSA_NAO_ENCONTRADA" });
  });

  it("recusa do modelo vira uma frase gentil", async () => {
    const { provedor } = provedorRoteirizado([{ stop: "refusal" }]);
    const r = await responderPergunta({ usuario, mensagem: "Algo fora do escopo", emitir: () => undefined, provedor: provedor as never });
    expect(r.resposta).toBe(RESPOSTA_RECUSA);
  });

  it("papel sem custo recebe só as ferramentas permitidas e o aviso no contexto", async () => {
    const { provedor, chamadas } = provedorRoteirizado([{ texto: "ok" }]);
    await responderPergunta({ usuario: { ...usuario, role: "ESTOQUE" }, mensagem: "Oi", emitir: () => undefined, provedor: provedor as never });
    const nomes = (chamadas[0].ferramentas as Array<{ name: string }>).map((f) => f.name);
    expect(nomes).not.toContain("resumo_financeiro");
    expect(nomes).not.toContain("capital_parado");
    expect(String(chamadas[0].sistemaVariavel)).toContain("não pode ver custo");
  });
});

describe("gerarTituloConversa", () => {
  it("usa o modelo rápido e limpa aspas e ponto", async () => {
    const criarMensagem = vi.fn(async () => ({ content: [{ type: "text", text: '"Compras da semana."' }], usage: { input_tokens: 10, output_tokens: 5 } }));
    const titulo = await gerarTituloConversa(usuario, "conv-1", "O que comprar?", "Compre X", { criarMensagem, transmitirMensagem: vi.fn() } as never);
    expect(titulo).toBe("Compras da semana");
    expect((criarMensagem.mock.calls[0] as unknown as [{ modelo: string; recurso: string }])[0]).toMatchObject({ modelo: "claude-haiku-5-5", recurso: "TITULO" });
    expect(prismaMock.conversaIa.updateMany).toHaveBeenCalledWith({ where: { id: "conv-1", autorId: "user-1" }, data: { titulo: "Compras da semana" } });
  });
});
