#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const MIGRACOES_REAPLICAVEIS = ["20261008000000_integridade_schema_fase9"];

const PADROES_IGNORAVEIS = [
  "P3011",
  "P3012",
  "not in a failed state",
  "never applied",
  "without migrations table",
];

const TENTATIVAS_TRAVA = 4;
const ESPERA_TRAVA_MS = 15000;

function urlDeMigracao(urlOriginal) {
  const explicita = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED;
  if (explicita) return explicita;
  if (!urlOriginal) return null;
  try {
    const url = new URL(urlOriginal);
    if (!url.hostname.includes("-pooler.")) return null;
    url.hostname = url.hostname.replace("-pooler.", ".");
    url.searchParams.delete("pgbouncer");
    return url.toString();
  } catch {
    return null;
  }
}

const urlMigracao = urlDeMigracao(process.env.DATABASE_URL);
const ambiente = urlMigracao ? { ...process.env, DATABASE_URL: urlMigracao } : process.env;
if (urlMigracao) console.log("[migrate-deploy] Usando a conexão direta do banco para as migrações (sem pooler).");

function esperar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function rodar(comando, args, extras = {}) {
  const resultado = spawnSync(comando, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...ambiente, ...extras },
  });
  if (resultado.stdout) process.stdout.write(resultado.stdout);
  if (resultado.stderr) process.stderr.write(resultado.stderr);
  return {
    status: resultado.status,
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
  };
}

function rodarComTrava(comando, args) {
  let resultado = rodar(comando, args);
  for (let tentativa = 2; tentativa <= TENTATIVAS_TRAVA && resultado.saida.includes("advisory lock"); tentativa++) {
    console.log(
      `[migrate-deploy] Trava de migração ocupada; nova tentativa ${tentativa}/${TENTATIVAS_TRAVA} em ${ESPERA_TRAVA_MS / 1000}s.`
    );
    esperar(ESPERA_TRAVA_MS);
    resultado = rodar(comando, args);
  }
  if (resultado.saida.includes("advisory lock")) {
    console.log(
      "[migrate-deploy] A trava continua presa (provavelmente esquecida por uma conexão do pooler); rodando uma vez sem a trava."
    );
    resultado = rodar(comando, args, { PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" });
  }
  return resultado;
}

console.log("\n[migrate-deploy] Conferindo o estado das migrações...");
const situacao = rodar("npx", ["prisma", "migrate", "status"]);
if (situacao.saida.includes("Database schema is up to date")) {
  console.log("[migrate-deploy] Nenhuma migração pendente nem com falha — seguindo para o build.");
  process.exit(0);
}

for (const nome of MIGRACOES_REAPLICAVEIS) {
  console.log(`\n[migrate-deploy] Resolvendo possível estado de falha: ${nome}`);
  const { status, saida } = rodarComTrava("npx", [
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
const deploy = rodarComTrava("npx", ["prisma", "migrate", "deploy"]);
process.exit(deploy.status ?? 1);
