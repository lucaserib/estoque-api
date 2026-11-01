import { test, expect } from "@playwright/test";
import { login, paraNumero } from "./helpers";

test("margem do topo do Financeiro é igual à soma do bloco Por logística", async ({ page }) => {
  await login(page);
  await page.goto("/financeiro");
  await page.waitForLoadState("networkidle");

  const cartaoMargem = page
    .locator(".shadow-card")
    .filter({ has: page.locator("p", { hasText: "Margem de contribuição" }) })
    .first();
  const valorTopoTexto = await cartaoMargem.locator("p").nth(1).innerText();
  const margemTopo = paraNumero(valorTopoTexto);

  const secaoPorLogistica = page
    .locator(".shadow-card")
    .filter({ has: page.locator("h2", { hasText: "Por logística" }) })
    .first();
  const linhas = secaoPorLogistica.locator("tbody tr");
  const totalLinhas = await linhas.count();
  expect(totalLinhas).toBeGreaterThan(0);

  let somaLogistica = 0;
  for (let i = 0; i < totalLinhas; i++) {
    const ultimaCelula = linhas.nth(i).locator("td").last();
    const valorLinha = await ultimaCelula.evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("span").forEach((span) => span.remove());
      return clone.textContent?.trim() ?? "";
    });
    somaLogistica += paraNumero(valorLinha);
  }

  expect(Math.abs(margemTopo - somaLogistica)).toBeLessThan(0.01);
});
