#!/usr/bin/env node
// Roda antes de `next build` (ver script "build" no package.json).
// Antes de `prisma migrate deploy`, tenta limpar o estado de falha de
// migrações que sabemos que podem ter ficado marcadas como falhas por
// bugs já corrigidos nos próprios arquivos de migração (ex.: índice
// duplicado). `prisma migrate resolve --rolled-back` só apaga o registro
// de falha em `_prisma_migrations` — nunca desfaz DDL já aplicado.
import { spawnSync } from "node:child_process";

const MIGRACOES_REAPLICAVEIS = ["20261008000000_integridade_schema_fase9"];

const PADROES_IGNORAVEIS = [
  "P3011",
  "P3012",
  "not in a failed state",
  "never applied",
];

function rodar(comando, args) {
  const resultado = spawnSync(comando, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  if (resultado.stdout) process.stdout.write(resultado.stdout);
  if (resultado.stderr) process.stderr.write(resultado.stderr);
  return {
    status: resultado.status,
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
  };
}

for (const nome of MIGRACOES_REAPLICAVEIS) {
  console.log(`\n[migrate-deploy] Resolvendo possível estado de falha: ${nome}`);
  const { status, saida } = rodar("npx", [
    "prisma",
    "migrate",
    "resolve",
    "--rolled-back",
    nome,
  ]);

  if (status === 0) {
    console.log(`[migrate-deploy] ${nome} marcada como rolled-back.`);
    continue;
  }

  const ignoravel = PADROES_IGNORAVEIS.some((padrao) => saida.includes(padrao));
  if (ignoravel) {
    console.log(
      `[migrate-deploy] ${nome} não estava em estado de falha (ou nunca foi aplicada) — seguindo sem alterações.`
    );
    continue;
  }

  console.error(
    `[migrate-deploy] Falha ao resolver ${nome}: saída não reconhecida como ignorável. Abortando build.`
  );
  process.exit(status ?? 1);
}

console.log("\n[migrate-deploy] Rodando prisma migrate deploy...");
const deploy = rodar("npx", ["prisma", "migrate", "deploy"]);
process.exit(deploy.status ?? 1);
