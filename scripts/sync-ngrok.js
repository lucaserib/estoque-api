// Script para sincronizar URL do ngrok automaticamente
const fs = require("fs");
const path = require("path");

async function getCurrentNgrokUrl() {
  try {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels");
    const data = await response.json();
    return data.tunnels[0]?.public_url;
  } catch (error) {
    console.log("❌ ngrok não está rodando");
    return null;
  }
}

function updateEnvFile(newUrl) {
  const envPath = path.join(process.cwd(), ".env");

  try {
    let envContent = fs.readFileSync(envPath, "utf8");
    const redirectUri = `${newUrl}/configuracoes`;

    // Atualizar a linha ML_REDIRECT_URI
    envContent = envContent.replace(
      /ML_REDIRECT_URI=.*/,
      `ML_REDIRECT_URI=${redirectUri}`
    );

    fs.writeFileSync(envPath, envContent);
    return redirectUri;
  } catch (error) {
    console.log("❌ Erro ao atualizar .env:", error.message);
    return null;
  }
}

function readCurrentEnvUrl() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/ML_REDIRECT_URI=(.*)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    return null;
  }
}

async function syncNgrok() {
  console.log("🔄 Verificando URL do ngrok...\n");

  const currentNgrokUrl = await getCurrentNgrokUrl();

  if (!currentNgrokUrl) {
    console.log("❌ ngrok não está rodando. Execute:");
    console.log("   ngrok http 3000");
    return;
  }

  const expectedRedirectUri = `${currentNgrokUrl}/configuracoes`;
  const currentEnvUrl = readCurrentEnvUrl();

  console.log("📊 Status atual:");
  console.log(`   ngrok URL: ${currentNgrokUrl}`);
  console.log(`   .env URL:  ${currentEnvUrl}`);

  if (currentEnvUrl === expectedRedirectUri) {
    console.log("\n✅ URLs estão sincronizadas!");
    console.log("\n🎯 Próximos passos:");
    console.log("1. Configure no painel do ML:");
    console.log(`   ${expectedRedirectUri}`);
    console.log("2. Reinicie sua aplicação se necessário");
  } else {
    console.log("\n🔧 URLs diferentes! Atualizando...");

    const updatedUrl = updateEnvFile(currentNgrokUrl);

    if (updatedUrl) {
      console.log(`✅ .env atualizado: ${updatedUrl}`);
      console.log("\n🚨 AÇÃO NECESSÁRIA:");
      console.log("1. Atualize no painel do Mercado Livre:");
      console.log(`   ${updatedUrl}`);
      console.log("2. Reinicie sua aplicação para aplicar as mudanças");
    }
  }

  console.log("\n🔗 Links úteis:");
  console.log("- Painel ML: https://developers.mercadolivre.com.br/");
  console.log("- ngrok Dashboard: http://127.0.0.1:4040");
}

// Executar se chamado diretamente
if (require.main === module) {
  syncNgrok();
}

module.exports = { syncNgrok };
