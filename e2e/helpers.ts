import type { Page } from "@playwright/test";

export const E2E_EMAIL = "e2e@skubo.test";
export const E2E_SENHA = "e2eteste123";

export async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(E2E_EMAIL);
  await page.locator("#password").fill(E2E_SENHA);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 15_000 });
}

export function paraNumero(texto: string): number {
  const limpo = texto
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  return Number(limpo);
}
