import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("vincular anúncio de kit com 2 unidades atualiza a composição e o custo da venda", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1440x900",
    "fluxo de escrita roda uma vez só: linkar o mesmo anúncio de novo em outro projeto encontraria o botão já trocado por 'Editar'"
  );

  await login(page);
  await page.goto("/mercado-livre/produtos");
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Buscar produtos por título ou ID...").fill("MLB2000");
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Vincular ao estoque" }).first().click();

  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText("E2E Produto 1", { exact: false })).toBeVisible({ timeout: 10_000 });

  const campoUnidades = dialogo.locator('input[type="number"]');
  await expect(campoUnidades).toHaveValue("2");

  await dialogo.getByRole("button", { name: "Salvar vínculo" }).click();
  await expect(dialogo).not.toBeVisible();

  await page.goto("/financeiro/vendas");
  await page.waitForLoadState("networkidle");

  const campoBusca = page.getByPlaceholder(/pedido|buscar/i).first();
  if (await campoBusca.isVisible().catch(() => false)) {
    await campoBusca.fill("200000001020");
    await campoBusca.press("Enter");
    await page.waitForTimeout(500);
  }

  const linhaVenda = page.locator("tr", { hasText: "200000001020" }).first();
  await expect(linhaVenda).toBeVisible({ timeout: 10_000 });
  await expect(linhaVenda.locator("text=/—|sem custo/i")).toHaveCount(0);
});
