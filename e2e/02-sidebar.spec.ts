import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("com Financeiro aberto em tela baixa, Usuários continua alcançável", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-390x844", "sidebar desktop não se aplica no celular");

  await login(page);
  await page.waitForLoadState("networkidle");

  const grupoFinanceiro = page.getByRole("button", { name: /Financeiro/i }).first();
  await grupoFinanceiro.click();

  const linkUsuarios = page.getByRole("link", { name: "Usuários" });
  await expect(linkUsuarios).toBeVisible();
  await linkUsuarios.click();
  await page.waitForURL(/\/usuarios/);
});
