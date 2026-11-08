export const MODELO_PADRAO = "claude-sonnet-5-5";
export const MODELO_RAPIDO_PADRAO = "claude-haiku-5-5";
export const COTACAO_DOLAR_PADRAO = 5.5;
export const ORCAMENTO_MENSAL_PADRAO_CENTAVOS = 1000;
export const MENSAGENS_MENSAIS_PADRAO = 300;
export const TESTE_ORCAMENTO_PADRAO_CENTAVOS = 200;
export const TESTE_MENSAGENS_SEM_PRECO = 30;
export const DIAS_TESTE = 7;
export const RETENCAO_PADRAO_DIAS = 90;

export type EsforcoIa = "low" | "medium" | "high";

export const ESFORCO = {
  chat: "low",
  analise: "medium",
  rapido: "low",
} as const satisfies Record<string, EsforcoIa>;

export interface PrecosModelo {
  entrada: number;
  saida: number;
  cacheLeitura: number;
  cacheEscrita: number;
}

function texto(nome: string): string | null {
  const valor = process.env[nome]?.trim();
  return valor ? valor : null;
}

function numeroPositivo(nome: string): number | null {
  const bruto = texto(nome);
  if (bruto === null) return null;
  const valor = Number(bruto.replace(",", "."));
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

function inteiroPositivo(nome: string, padrao: number): number {
  const valor = numeroPositivo(nome);
  return valor !== null && valor > 0 ? Math.round(valor) : padrao;
}

function ligado(nome: string): boolean {
  const valor = texto(nome)?.toLowerCase();
  return valor === "1" || valor === "true" || valor === "sim";
}

export function modeloPrincipal(): string {
  return texto("IA_MODELO") ?? MODELO_PADRAO;
}

export function modeloRapido(): string {
  return texto("IA_MODELO_RAPIDO") ?? MODELO_RAPIDO_PADRAO;
}

export function iaDesligada(): boolean {
  return ligado("IA_DESLIGADA");
}

export function usarProvedorFalso(): boolean {
  return ligado("IA_PROVEDOR_FALSO");
}

export function iaConfigurada(): boolean {
  return usarProvedorFalso() || Boolean(texto("ANTHROPIC_API_KEY"));
}

export function workspaceAnthropic(): string | null {
  return texto("ANTHROPIC_WORKSPACE_ID");
}

function lerPrecos(prefixo: string): PrecosModelo | null {
  const entrada = numeroPositivo(`${prefixo}ENTRADA_MTOK`);
  const saida = numeroPositivo(`${prefixo}SAIDA_MTOK`);
  const cacheLeitura = numeroPositivo(`${prefixo}CACHE_LEITURA_MTOK`);
  const cacheEscrita = numeroPositivo(`${prefixo}CACHE_ESCRITA_MTOK`);
  if (entrada === null || saida === null || cacheLeitura === null || cacheEscrita === null) return null;
  return { entrada, saida, cacheLeitura, cacheEscrita };
}

export function precosDoModelo(modelo: string): PrecosModelo | null {
  const principais = lerPrecos("IA_PRECO_");
  if (modelo === modeloRapido() && modelo !== modeloPrincipal()) {
    return lerPrecos("IA_PRECO_RAPIDO_") ?? principais;
  }
  return principais;
}

export function precosConfigurados(): boolean {
  return lerPrecos("IA_PRECO_") !== null;
}

export function cotacaoDolar(): number {
  const valor = numeroPositivo("IA_COTACAO_DOLAR");
  return valor !== null && valor > 0 ? valor : COTACAO_DOLAR_PADRAO;
}

export function orcamentoMensalCentavos(): number {
  return inteiroPositivo("IA_ORCAMENTO_MENSAL_CENTAVOS", ORCAMENTO_MENSAL_PADRAO_CENTAVOS);
}

export function mensagensMensais(): number {
  return inteiroPositivo("IA_MENSAGENS_MENSAIS", MENSAGENS_MENSAIS_PADRAO);
}

export function testeOrcamentoCentavos(): number {
  return inteiroPositivo("IA_TESTE_ORCAMENTO_CENTAVOS", TESTE_ORCAMENTO_PADRAO_CENTAVOS);
}

export function retencaoDias(): number {
  return inteiroPositivo("IA_RETENCAO_DIAS", RETENCAO_PADRAO_DIAS);
}

export function contasLiberadasPorEnv(): Set<string> {
  return new Set(
    (process.env.IA_CONTAS_LIBERADAS ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}
