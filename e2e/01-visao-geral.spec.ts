import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("login leva à Visão geral sem elementos sobrepostos e sem rolagem horizontal", async ({ page }) => {
  await login(page);
  await page.waitForLoadState("networkidle");

  const larguraDocumento = await page.evaluate(() => document.documentElement.scrollWidth);
  const larguraJanela = await page.evaluate(() => window.innerWidth);
  expect(larguraDocumento).toBeLessThanOrEqual(larguraJanela + 1);

  const cartoes = page.locator(".shadow-card");
  const totalCartoes = await cartoes.count();
  expect(totalCartoes).toBeGreaterThan(0);

  for (let i = 0; i < totalCartoes; i++) {
    const cartao = cartoes.nth(i);
    const textos = cartao.locator("p, span");
    const totalTextos = await textos.count();
    const caixas: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let j = 0; j < totalTextos; j++) {
      const elemento = textos.nth(j);
      // Só elementos-folha (sem filho elemento): um <span> com outro <span> aninhado
      // dentro (ex.: badge de variação com rótulo) sempre "contém" o próprio filho
      // geometricamente, o que não é o tipo de sobreposição visual que este teste quer pegar.
      const ehFolha = await elemento.evaluate((el) => el.children.length === 0);
      if (!ehFolha) continue;
      const caixa = await elemento.boundingBox();
      if (caixa && caixa.width > 0 && caixa.height > 0) caixas.push(caixa);
    }
    for (let a = 0; a < caixas.length; a++) {
      for (let b = a + 1; b < caixas.length; b++) {
        const caixaA = caixas[a];
        const caixaB = caixas[b];
        const seSobrepoe =
          caixaA.x < caixaB.x + caixaB.width &&
          caixaA.x + caixaA.width > caixaB.x &&
          caixaA.y < caixaB.y + caixaB.height &&
          caixaA.y + caixaA.height > caixaB.y;
        expect(seSobrepoe, `elementos de texto sobrepostos no cartão ${i}`).toBe(false);
      }
    }
  }
});
