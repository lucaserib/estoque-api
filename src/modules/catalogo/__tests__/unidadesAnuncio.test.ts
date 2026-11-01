import { describe, it, expect } from "vitest";
import { sugerirUnidadesPeloTitulo } from "../unidadesAnuncio";

describe("sugerirUnidadesPeloTitulo", () => {
  it.each([
    ["Kit 2 Adaptadores USB-C", 2],
    ["Kit com 3 Cabos", 3],
    ["Adaptador USB-C 2 unidades", 2],
    ["Par de adaptadores", 2],
    ["Cabo 10x mais rápido", 10],
  ])("%s → %d", (titulo, esperado) => {
    expect(sugerirUnidadesPeloTitulo(titulo)).toBe(esperado);
  });

  it("anúncio de 1 unidade não sugere nada", () => {
    expect(sugerirUnidadesPeloTitulo("Adaptador USB-C para Lightning")).toBeNull();
  });
});
