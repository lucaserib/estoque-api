import { describe, expect, it } from "vitest";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { ESPACO_POSICAO, posicaoEntre, posicoesRenumeradas } from "../dominio/posicao";
import { hojeEmTexto, montarPrazo, partesDoPrazo, situacaoDoPrazo } from "../dominio/prazo";
import { descreverRecorrencia, proximoPrazo, recorrenciaSchema } from "../dominio/recorrencia";
import { interpretarCaptura } from "../dominio/capturaRapida";
import { extrairMencoes, limparMencoesInvalidas, marcarMencao, textoSemMarcacao, trechosDoComentario } from "../dominio/mencoes";
import { criarTarefaSchema, filtrosNotasSchema, vinculoSchema } from "../dominio/esquemas";

const SP = (texto: string) => new Date(`${texto}-03:00`);

describe("posições", () => {
  it("calcula o meio entre os vizinhos e as pontas", () => {
    expect(posicaoEntre(null, null)).toBe(ESPACO_POSICAO);
    expect(posicaoEntre(1024, null)).toBe(2048);
    expect(posicaoEntre(null, 1024)).toBe(0);
    expect(posicaoEntre(1024, 2048)).toBe(1536);
  });

  it("pede renumeração quando não cabe mais nada entre os vizinhos", () => {
    expect(posicaoEntre(1, 1 + 1e-7)).toBeNull();
    expect(posicoesRenumeradas(3)).toEqual([1024, 2048, 3072]);
  });
});

describe("prazos no fuso de São Paulo", () => {
  const agora = SP("2026-11-11T10:00:00");

  it("dia sem hora vence no fim do dia", () => {
    const prazo = montarPrazo("2026-11-11");
    expect(prazo?.prazoComHora).toBe(false);
    expect(prazo?.prazo.toISOString()).toBe("2026-11-12T02:59:59.999Z");
    expect(partesDoPrazo(prazo!.prazo, false)).toEqual({ data: "2026-11-11", hora: null });
  });

  it("dia com hora vira o instante em São Paulo", () => {
    const prazo = montarPrazo("2026-11-11", "14:30");
    expect(prazo?.prazo.toISOString()).toBe("2026-11-11T17:30:00.000Z");
    expect(partesDoPrazo(prazo!.prazo, true)).toEqual({ data: "2026-11-11", hora: "14:30" });
  });

  it("recusa datas e horas impossíveis", () => {
    expect(montarPrazo("2026-02-30")).toBeNull();
    expect(montarPrazo("2026-11-11", "25:00")).toBeNull();
  });

  it("classifica a situação da tarefa", () => {
    const base = { concluidaEm: null, arquivadaEm: null };
    expect(situacaoDoPrazo({ ...base, prazo: null }, agora)).toBe("sem-prazo");
    expect(situacaoDoPrazo({ ...base, prazo: SP("2026-11-10T23:59:59") }, agora)).toBe("atrasada");
    expect(situacaoDoPrazo({ ...base, prazo: SP("2026-11-11T09:00:00") }, agora)).toBe("atrasada");
    expect(situacaoDoPrazo({ ...base, prazo: montarPrazo("2026-11-11")!.prazo }, agora)).toBe("hoje");
    expect(situacaoDoPrazo({ ...base, prazo: montarPrazo("2026-11-14")!.prazo }, agora)).toBe("semana");
    expect(situacaoDoPrazo({ ...base, prazo: montarPrazo("2026-11-20")!.prazo }, agora)).toBe("futura");
    expect(situacaoDoPrazo({ prazo: SP("2026-11-01T00:00:00"), concluidaEm: agora, arquivadaEm: null }, agora)).toBe("concluida");
    expect(situacaoDoPrazo({ prazo: null, concluidaEm: null, arquivadaEm: agora }, agora)).toBe("arquivada");
  });

  it("hoje em texto respeita o fuso", () => {
    expect(hojeEmTexto(new Date("2026-11-12T02:30:00Z"))).toBe("2026-11-11");
  });
});

describe("recorrência", () => {
  const ler = (valor: unknown) => recorrenciaSchema.parse(valor);

  it("diária pula para depois de agora mesmo com atraso", () => {
    const prazo = montarPrazo("2026-11-05")!.prazo;
    const proximo = proximoPrazo(ler({ frequencia: "DIARIA" }), prazo, false, SP("2026-11-11T10:00:00"));
    expect(partesDoPrazo(proximo!, false).data).toBe("2026-11-11");
  });

  it("semanal escolhe o próximo dia marcado e respeita o intervalo", () => {
    const segunda = montarPrazo("2026-11-09")!.prazo;
    const semanal = ler({ frequencia: "SEMANAL", diasSemana: [1, 4] });
    expect(partesDoPrazo(proximoPrazo(semanal, segunda, false, SP("2026-11-09T08:00:00"))!, false).data).toBe("2026-11-12");
    const quinzenal = ler({ frequencia: "SEMANAL", intervalo: 2, diasSemana: [1] });
    expect(partesDoPrazo(proximoPrazo(quinzenal, segunda, false, SP("2026-11-09T08:00:00"))!, false).data).toBe("2026-11-23");
  });

  it("mensal mantém o dia e ajusta no mês curto, preservando a hora", () => {
    const prazo = montarPrazo("2026-01-31", "09:00")!.prazo;
    const mensal = ler({ frequencia: "MENSAL", diaDoMes: 31 });
    const proximo = proximoPrazo(mensal, prazo, true, SP("2026-01-31T10:00:00"));
    expect(partesDoPrazo(proximo!, true)).toEqual({ data: "2026-02-28", hora: "09:00" });
  });

  it("para na data final", () => {
    const prazo = montarPrazo("2026-11-10")!.prazo;
    const comFim = ler({ frequencia: "DIARIA", ate: "2026-11-10" });
    expect(proximoPrazo(comFim, prazo, false, SP("2026-11-10T08:00:00"))).toBeNull();
  });

  it("valida semanal sem dias e descreve em português", () => {
    expect(recorrenciaSchema.safeParse({ frequencia: "SEMANAL", diasSemana: [] }).success).toBe(false);
    expect(descreverRecorrencia(ler({ frequencia: "SEMANAL", diasSemana: [4, 1, 1] }))).toBe("Toda semana: seg, qui");
    expect(descreverRecorrencia(ler({ frequencia: "MENSAL", intervalo: 3, diaDoMes: 5 }))).toBe("A cada 3 meses, dia 5");
  });
});

describe("captura rápida", () => {
  const pessoas = [
    { id: "u-ana", nome: "Ana Souza", email: "ana@loja.com" },
    { id: "u-bruno", nome: "Bruno Lima", email: "bruno@loja.com" },
    { id: "u-beto", nome: "Bruno Alves", email: "beto@loja.com" },
  ];
  const etiquetas = [
    { id: "e-compras", nome: "Compras" },
    { id: "e-anuncios", nome: "Anúncios" },
  ];
  const agora = SP("2026-11-11T10:00:00");

  it("entende pessoa, etiqueta, prioridade e data", () => {
    const r = interpretarCaptura("Cobrar fornecedor de caixas @ana #compras !alta amanhã", { pessoas, etiquetas, agora });
    expect(r).toMatchObject({
      titulo: "Cobrar fornecedor de caixas",
      responsavelId: "u-ana",
      etiquetaIds: ["e-compras"],
      prioridade: "ALTA",
      prazo: { data: "2026-11-12", hora: null },
      avisos: [],
    });
  });

  it("dia da semana é sempre o próximo e aceita hora com 'às'", () => {
    const r = interpretarCaptura("Enviar Full na sexta às 14h #anuncios", { pessoas, etiquetas, agora });
    expect(r.titulo).toBe("Enviar Full");
    expect(r.prazo).toEqual({ data: "2026-11-13", hora: "14:00" });
    expect(r.etiquetaIds).toEqual(["e-anuncios"]);
    const quarta = interpretarCaptura("Reunião quarta", { pessoas, etiquetas, agora });
    expect(quarta.prazo?.data).toBe("2026-11-18");
  });

  it("data com barra vira o próximo ano quando já passou", () => {
    expect(interpretarCaptura("Balanço até 05/01", { pessoas, etiquetas, agora }).prazo?.data).toBe("2027-01-05");
    expect(interpretarCaptura("Fechar mês 30/11", { pessoas, etiquetas, agora }).prazo?.data).toBe("2026-11-30");
  });

  it("avisa quando a pessoa é ambígua ou não existe e não consome o texto", () => {
    const ambigua = interpretarCaptura("Ligar @bruno", { pessoas, etiquetas, agora });
    expect(ambigua.responsavelId).toBeNull();
    expect(ambigua.avisos[0]).toMatch(/Mais de uma pessoa/);
    const inexistente = interpretarCaptura("Ligar @carla #fiscal", { pessoas, etiquetas, agora });
    expect(inexistente.titulo).toBe("Ligar @carla #fiscal");
    expect(inexistente.avisos).toHaveLength(2);
  });

  it("hora sozinha vale para hoje e números soltos ficam no título", () => {
    const r = interpretarCaptura("Comprar 50 caixas 16:30", { pessoas, etiquetas, agora });
    expect(r.titulo).toBe("Comprar 50 caixas");
    expect(r.prazo).toEqual({ data: "2026-11-11", hora: "16:30" });
  });
});

describe("menções", () => {
  it("extrai ids, limpa as inválidas e gera texto puro", () => {
    const corpo = `Oi ${marcarMencao("Ana Souza", "u-ana")} e ${marcarMencao("Intruso", "u-x")}, vejam isso`;
    expect(extrairMencoes(corpo)).toEqual(["u-ana", "u-x"]);
    const limpo = limparMencoesInvalidas(corpo, new Set(["u-ana"]));
    expect(extrairMencoes(limpo)).toEqual(["u-ana"]);
    expect(textoSemMarcacao(limpo)).toBe("Oi @Ana Souza e @Intruso, vejam isso");
    expect(trechosDoComentario(limpo).map((t) => t.tipo)).toEqual(["texto", "mencao", "texto"]);
  });
});

describe("validação de entrada", () => {
  it("vínculo só aponta para telas do próprio Skubo", () => {
    expect(vinculoSchema.safeParse({ tipo: "TELA", rotulo: "Reposição", href: "/reposicao?x=1" }).success).toBe(true);
    for (const href of ["https://evil.com", "//evil.com", "javascript:alert(1)", "/\\evil.com"]) {
      expect(vinculoSchema.safeParse({ tipo: "TELA", rotulo: "x", href }).success).toBe(false);
    }
  });

  it("título é obrigatório e a chave de origem tem formato fechado", () => {
    expect(criarTarefaSchema.safeParse({ titulo: "   " }).success).toBe(false);
    expect(criarTarefaSchema.safeParse({ titulo: "Ok", chaveOrigem: "controle:sem-custo" }).success).toBe(true);
    expect(criarTarefaSchema.safeParse({ titulo: "Ok", chaveOrigem: "<script>" }).success).toBe(false);
    expect(criarTarefaSchema.safeParse({ titulo: "Ok", origem: "RECORRENCIA" }).success).toBe(false);
  });

  it("filtro de notas lê booleano de query string", () => {
    expect(filtrosNotasSchema.parse({ arquivadas: "false" }).arquivadas).toBe(false);
    expect(filtrosNotasSchema.parse({ arquivadas: "1" }).arquivadas).toBe(true);
  });
});

describe("permissões de tarefas", () => {
  it("todos veem, só LEITURA não edita e só ADMIN administra", () => {
    for (const papel of ["ADMIN", "COMPRAS", "ESTOQUE", "VENDAS", "LEITURA"] as const) {
      expect(podeVer(papel, "TAREFAS_EDITAR")).toBe(true);
      expect(podeEditar(papel, "TAREFAS_EDITAR")).toBe(papel !== "LEITURA");
      expect(podeEditar(papel, "TAREFAS_ADMINISTRAR")).toBe(papel === "ADMIN");
    }
  });
});
