import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeComponente {
  kitId: string;
  quantidade: number;
  produto: { custoMedio: number | null };
}

let componentes: FakeComponente[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    componente: {
      findMany: vi.fn(async ({ where }: { where: { kitId: string } }) =>
        componentes.filter((c) => c.kitId === where.kitId)
      ),
    },
  },
}));

const { calcularCustoKit } = await import("../custo");

beforeEach(() => {
  componentes = [];
});

describe("calcularCustoKit", () => {
  it("Ciclo 11 (Parte 4, Fase 1, item 2): CMV do kit é a soma do custo dos componentes", async () => {
    componentes.push(
      { kitId: "kit-1", quantidade: 2, produto: { custoMedio: 1000 } },
      { kitId: "kit-1", quantidade: 1, produto: { custoMedio: 500 } }
    );

    const resultado = await calcularCustoKit("kit-1");

    expect(resultado.custoMedio).toBe(2 * 1000 + 1 * 500);
    expect(resultado.completo).toBe(true);
  });

  it("componente sem custo: custoMedio fica null e completo=false (pendência), nunca soma parcial", async () => {
    componentes.push(
      { kitId: "kit-1", quantidade: 2, produto: { custoMedio: 1000 } },
      { kitId: "kit-1", quantidade: 1, produto: { custoMedio: null } }
    );

    const resultado = await calcularCustoKit("kit-1");

    expect(resultado.custoMedio).toBeNull();
    expect(resultado.completo).toBe(false);
  });

  it("kit sem nenhum componente cadastrado: incompleto", async () => {
    const resultado = await calcularCustoKit("kit-vazio");

    expect(resultado.custoMedio).toBeNull();
    expect(resultado.completo).toBe(false);
  });
});
