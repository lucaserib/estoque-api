import { test, expect } from "@playwright/test";
import { login, paraNumero } from "./helpers";

test("DRE: soma das linhas de componente fecha com o resultado final", async ({ page }) => {
  await login(page);
  await page.goto("/financeiro/dre");
  await page.waitForLoadState("networkidle");

  const linhas = page.locator("tbody tr");
  const totalLinhas = await linhas.count();
  expect(totalLinhas).toBeGreaterThan(0);

  let somaComponentes = 0;
  let ultimoSubtotal = 0;

  for (let i = 0; i < totalLinhas; i++) {
    const linha = linhas.nth(i);
    const rotulo = (await linha.locator("td").first().innerText()).trim();
    const valorTexto = await linha.locator("td").nth(1).innerText();
    if (!valorTexto.includes("R$")) continue;
    const valor = paraNumero(valorTexto);

    if (rotulo.startsWith("(=)")) {
      ultimoSubtotal = valor;
      continue;
    }
    if (rotulo.startsWith("(−)") || rotulo.startsWith("(+)") || rotulo.startsWith("(±)") || rotulo === "Vendas brutas (todos os pedidos)") {
      somaComponentes += valor;
    }
  }

  expect(Math.abs(somaComponentes - ultimoSubtotal)).toBeLessThan(0.05);
});
