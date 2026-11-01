import { execSync } from "node:child_process";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definida. Aponte para um banco de teste descartável antes de rodar npm run test:e2e."
    );
  }

  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  execSync("npx prisma db seed", { stdio: "inherit" });
}
