import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/cache", () => ({ withUserCache: vi.fn() }));
vi.mock("@/services/pendenciasService", () => ({ calcularTodasPendencias: vi.fn() }));
vi.mock("@/services/saudeAnunciosService", () => ({ calcularSaudeAnuncios: vi.fn() }));
vi.mock("@/services/reposicaoService", () => ({ calcularReposicaoConta: vi.fn(), calcularCapitalParadoConta: vi.fn() }));
vi.mock("@/modules/financeiro/relatorios/cobrancasNaoMapeadas", () => ({ listarCobrancasNaoMapeadas: vi.fn() }));

const { calcularNota, calcularNotaGeral, classificar, ordenarItens, resumirAreas } = await import("../diagnostico");

const item = (id: string, gravidade: "critica" | "atencao" | "informativa", area = "estoque" as const, valorEmRisco: number | null = null) => ({
  id,
  area,
  gravidade,
  titulo: id,
  descricao: "",
  quantidade: 1,
  valorEmRisco,
  acao: { rotulo: "", href: "/" },
  exemplos: [],
});

describe("diagnóstico da loja", () => {
  it("nota começa em 100 e desconta pela gravidade", () => {
    expect(calcularNota([])).toBe(100);
    expect(calcularNota([item("a", "critica"), item("b", "atencao"), item("c", "informativa")])).toBe(78);
  });

  it("nota nunca fica negativa", () => {
    expect(calcularNota(Array.from({ length: 20 }, (_, i) => item(String(i), "critica")))).toBe(0);
  });

  it("nota geral é a média das áreas menos 4 por item crítico", () => {
    expect(calcularNotaGeral([])).toBe(100);
    expect(calcularNotaGeral([item("a", "critica"), item("b", "atencao")])).toBe(Math.round((80 + 400) / 5 - 4));
  });

  it("classifica a nota em faixas", () => {
    expect(classificar(95)).toBe("excelente");
    expect(classificar(75)).toBe("boa");
    expect(classificar(50)).toBe("regular");
    expect(classificar(10)).toBe("critica");
  });

  it("ordena por gravidade e depois por valor em risco", () => {
    const ordenados = ordenarItens([item("info", "informativa"), item("at", "atencao", "estoque", 10), item("cr", "critica"), item("at2", "atencao", "estoque", 99)]);
    expect(ordenados.map((i) => i.id)).toEqual(["cr", "at2", "at", "info"]);
  });

  it("resume as cinco áreas mesmo sem problemas", () => {
    const areas = resumirAreas([item("cr", "critica")]);
    expect(areas).toHaveLength(5);
    expect(areas.find((a) => a.area === "estoque")).toMatchObject({ nota: 86, problemas: 1 });
    expect(areas.find((a) => a.area === "financeiro")).toMatchObject({ nota: 100, problemas: 0 });
  });
});
