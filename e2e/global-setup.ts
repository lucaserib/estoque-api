import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definida. Aponte para um banco de teste descartável antes de rodar npm run test:e2e."
    );
  }

  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  execSync("npx prisma db seed", { stdio: "inherit" });

  const arquivoEmails = process.env.EMAIL_CONSOLE_ARQUIVO;
  if (arquivoEmails) {
    fs.mkdirSync(path.dirname(arquivoEmails), { recursive: true });
    fs.writeFileSync(arquivoEmails, "");
  }
}
