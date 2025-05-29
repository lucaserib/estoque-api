// Script para configurar desenvolvimento com HTTPS
const { execSync } = require("child_process");
const fs = require("fs");

console.log("🔧 Configurador de HTTPS para Mercado Livre\n");

console.log("O Mercado Livre só aceita URLs HTTPS para redirect URI.");
console.log("Aqui estão suas opções:\n");

console.log("1️⃣  NGROK (Recomendado - Mais fácil)");
console.log("   - Cria um túnel HTTPS para localhost:3000");
console.log("   - Comando: ngrok http 3000");
console.log("   - URL será algo como: https://abc123.ngrok.io\n");

console.log("2️⃣  HTTPS Local");
console.log("   - Configura certificado SSL local");
console.log("   - Mais complexo, mas não precisa de serviço externo\n");

console.log("3️⃣  URL de Produção Temporária");
console.log("   - Use uma URL de produção já existente");
console.log("   - Configure depois para produção real\n");

// Verificar se ngrok está disponível
try {
  execSync("which ngrok", { stdio: "ignore" });
  console.log("✅ ngrok encontrado no sistema");

  console.log("\n🚀 Para usar ngrok:");
  console.log("1. Execute: npm run dev");
  console.log("2. Em outro terminal: ngrok http 3000");
  console.log("3. Copie a URL HTTPS do ngrok (ex: https://abc123.ngrok.io)");
  console.log("4. Configure no ML: https://abc123.ngrok.io/configuracoes");
  console.log(
    '5. Configure no .env: ML_REDIRECT_URI="https://abc123.ngrok.io/configuracoes"'
  );
} catch (error) {
  console.log("❌ ngrok não encontrado");
  console.log("\n📦 Para instalar ngrok:");
  console.log("1. Acesse: https://ngrok.com/download");
  console.log("2. Ou use: npm install -g ngrok");
}

console.log("\n📋 Exemplo de configuração final:");
console.log('ML_CLIENT_ID="seu_app_id"');
console.log('ML_CLIENT_SECRET="sua_secret_key"');
console.log('ML_REDIRECT_URI="https://abc123.ngrok.io/configuracoes"');

console.log("\n⚠️  IMPORTANTE:");
console.log("- A URL do ngrok muda a cada execução");
console.log(
  "- Você precisará atualizar a configuração do ML quando isso acontecer"
);
console.log(
  "- Para produção, use sua URL real (https://seu-dominio.com/configuracoes)"
);
