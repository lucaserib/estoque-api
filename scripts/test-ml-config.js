// Script para testar configurações do Mercado Livre
const fs = require("fs");
const path = require("path");

// Função para ler .env manualmente
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envFile = fs.readFileSync(envPath, "utf8");
    const env = {};

    envFile.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      if (key && !key.startsWith("#")) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        env[key.trim()] = value.trim();
      }
    });

    return env;
  } catch (error) {
    console.log("❌ Arquivo .env não encontrado");
    return {};
  }
}

const env = loadEnv();

console.log("🔍 Testando configurações do Mercado Livre...\n");

const configs = [
  { name: "ML_CLIENT_ID", value: env.ML_CLIENT_ID },
  { name: "ML_CLIENT_SECRET", value: env.ML_CLIENT_SECRET },
  { name: "ML_REDIRECT_URI", value: env.ML_REDIRECT_URI },
];

let allConfigured = true;

configs.forEach(({ name, value }) => {
  if (value) {
    console.log(`✅ ${name}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${name}: NÃO CONFIGURADO`);
    allConfigured = false;
  }
});

console.log("\n" + "=".repeat(50));

if (allConfigured) {
  console.log("🎉 Todas as configurações estão OK!");
  console.log("\nURL de autorização de exemplo:");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.ML_CLIENT_ID,
    redirect_uri: env.ML_REDIRECT_URI,
    state: "test-user-id",
  });

  const authUrl = `https://auth.mercadolibre.com.br/authorization?${params.toString()}`;
  console.log(authUrl);

  console.log("\n🔍 Verificações:");
  console.log(
    `✅ URL contém HTTPS: ${env.ML_REDIRECT_URI.startsWith("https://")}`
  );
  console.log(
    `✅ URL termina com /configuracoes: ${env.ML_REDIRECT_URI.endsWith(
      "/configuracoes"
    )}`
  );
} else {
  console.log("❌ Algumas configurações estão faltando!");
  console.log(
    "\nVerifique se você configurou todas as variáveis no arquivo .env:"
  );
  console.log("- ML_CLIENT_ID (APP ID da sua aplicação no ML)");
  console.log("- ML_CLIENT_SECRET (Secret Key da sua aplicação no ML)");
  console.log("- ML_REDIRECT_URI (URL de callback da sua aplicação)");
  console.log("\nExemplo de .env:");
  console.log('ML_CLIENT_ID="1234567890123456"');
  console.log('ML_CLIENT_SECRET="abcdefghijklmnopqrstuvwxyz123456"');
  console.log('ML_REDIRECT_URI="https://abc123.ngrok-free.app/configuracoes"');
}

console.log("\n🔗 Links úteis:");
console.log(
  "- Painel de Desenvolvedor: https://developers.mercadolivre.com.br/"
);
console.log(
  "- Documentação: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao"
);
