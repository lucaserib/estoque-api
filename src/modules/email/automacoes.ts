import type { AutomacaoEmail, CategoriaEmail } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { linkAbsoluto } from "./config";
import { enviarEmailSemFalhar, type ResultadoEmail } from "./enviar";
import { substituirVariaveis } from "./markdown";

export interface AutomacaoPadrao {
  chave: string;
  nome: string;
  descricao: string;
  atrasoHoras: number;
  assunto: string;
  preCabecalho: string;
  corpoMarkdown: string;
  rotuloBotao: string | null;
  urlBotao: string | null;
  categoria: CategoriaEmail;
}

export const VARIAVEIS_AUTOMACAO = [
  "nome",
  "loja",
  "link_indicacao",
  "dias_teste",
  "saldo_ia",
  "link_planos",
  "data_fim_teste",
  "cupom",
  "dias",
  "indicado",
  "data_renovacao",
  "valor",
  "pesquisa",
] as const;

export const AUTOMACOES_PADRAO: AutomacaoPadrao[] = [
  {
    chave: "boas-vindas",
    nome: "Boas-vindas",
    descricao: "Na criação da conta, para o dono.",
    atrasoHoras: 0,
    assunto: "Bem-vindo ao Skubo, {{nome}}",
    preCabecalho: "Seus {{dias_teste}} dias grátis começaram agora.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nSeus **{{dias_teste}} dias grátis** começaram. Para ver o Skubo trabalhando com os números da {{loja}}:\n\n- Conecte o Mercado Livre (2 minutos)\n- Conecte o Bling, se usar\n- Abra a Reposição e veja o que comprar\n\nVocê também tem **{{saldo_ia}} perguntas grátis** para a Skubo IA.",
    rotuloBotao: "Começar agora",
    urlBotao: "/comecar",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "conectar-ml",
    nome: "Conectar o Mercado Livre",
    descricao: "24 h depois do cadastro, se o Mercado Livre não foi conectado.",
    atrasoHoras: 24,
    assunto: "{{nome}}, falta conectar o Mercado Livre",
    preCabecalho: "Leva 2 minutos e o Skubo já mostra o que comprar.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nO Skubo ainda não está ligado ao Mercado Livre da {{loja}}. É com essa conexão que ele traz anúncios, vendas e o estoque do Full, e começa a sugerir o que comprar.\n\nLeva 2 minutos e você não precisa digitar nada.",
    rotuloBotao: "Conectar o Mercado Livre",
    urlBotao: "/integracoes",
    categoria: "CICLO_DE_VIDA",
  },
  {
    chave: "conectar-bling",
    nome: "Conectar o Bling",
    descricao: "48 h depois de conectar o Mercado Livre, se o Bling não foi conectado.",
    atrasoHoras: 48,
    assunto: "Usa o Bling? Conecte e veja o custo real de cada venda",
    preCabecalho: "Produtos, custos e estoque local entram sozinhos.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nO Mercado Livre já está conectado. Se a {{loja}} usa o Bling, conecte também: o Skubo traz produtos, custos e o estoque local, e o lucro de cada venda passa a ser real.\n\nSe não usa o Bling, tudo bem: dá para cadastrar o custo direto no Skubo.",
    rotuloBotao: "Conectar o Bling",
    urlBotao: "/integracoes",
    categoria: "CICLO_DE_VIDA",
  },
  {
    chave: "primeira-reposicao",
    nome: "Ver a primeira reposição",
    descricao: "72 h depois da primeira sincronização, se a Reposição não foi aberta.",
    atrasoHoras: 72,
    assunto: "O Skubo já sabe o que você precisa comprar",
    preCabecalho: "Veja o que vai acabar antes da próxima compra chegar.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nCom as vendas sincronizadas, a Reposição já calcula o que vai acabar e quanto comprar de cada produto, contando o estoque local, o Full e os pedidos em aberto.\n\nDá uma olhada: costuma aparecer pelo menos um produto que você ia deixar faltar.",
    rotuloBotao: "Abrir a Reposição",
    urlBotao: "/reposicao",
    categoria: "CICLO_DE_VIDA",
  },
  {
    chave: "ia-perguntas-gratis",
    nome: "Perguntas grátis da IA",
    descricao: "No 4º dia do teste, se ninguém perguntou nada à IA.",
    atrasoHoras: 72,
    assunto: "Você tem {{saldo_ia}} perguntas grátis esperando",
    preCabecalho: "Pergunte em português e receba a resposta com os números da sua loja.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nA Skubo IA responde com os números da {{loja}}. Experimente perguntar:\n\n- O que preciso comprar esta semana?\n- Qual produto me dá mais lucro?\n- O que está parado no estoque?\n\nVocê ainda tem **{{saldo_ia}} perguntas grátis**.",
    rotuloBotao: "Perguntar para a IA",
    urlBotao: "/ia",
    categoria: "CICLO_DE_VIDA",
  },
  {
    chave: "teste-acabando",
    nome: "Teste acabando",
    descricao: "2 dias antes do fim do teste.",
    atrasoHoras: 0,
    assunto: "Seu teste do Skubo termina em 2 dias",
    preCabecalho: "Assine agora e não perca nada do que já configurou.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nSeu teste grátis termina em **{{data_fim_teste}}**. Assinando agora, a primeira cobrança só acontece no fim do teste e você não perde nada do que já configurou.",
    rotuloBotao: "Escolher meu plano",
    urlBotao: "/assinatura",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "teste-terminou",
    nome: "Teste terminou",
    descricao: "No dia seguinte ao fim do teste, sem assinatura.",
    atrasoHoras: 24,
    assunto: "Seu teste do Skubo terminou",
    preCabecalho: "Seus dados continuam guardados. Assine para continuar.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nSeu teste grátis terminou. Produtos, vínculos e configurações da {{loja}} continuam guardados: é só assinar para voltar de onde parou.",
    rotuloBotao: "Assinar o Skubo",
    urlBotao: "/assinatura",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "volte-3",
    nome: "Volte (3 dias)",
    descricao: "3 dias depois do fim do teste, sem assinatura. Pode levar o cupom configurado.",
    atrasoHoras: 72,
    assunto: "Sentimos sua falta, {{nome}}",
    preCabecalho: "Seus dados estão guardados esperando você.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nA {{loja}} ficou parada no Skubo. Tudo o que você configurou continua lá: vínculos, custos, fornecedores.\n\n> Use o cupom **{{cupom}}** na assinatura.",
    rotuloBotao: "Voltar ao Skubo",
    urlBotao: "/assinatura",
    categoria: "CICLO_DE_VIDA",
  },
  {
    chave: "volte-14",
    nome: "Volte (14 dias)",
    descricao: "14 dias depois do fim do teste, sem assinatura.",
    atrasoHoras: 336,
    assunto: "Ainda dá tempo de voltar",
    preCabecalho: "O estoque da sua loja continua guardado no Skubo.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nFaz duas semanas que o teste da {{loja}} terminou. Se o problema foi tempo para configurar, a gente ajuda: responda este e-mail que alguém do time fala com você.\n\n> Use o cupom **{{cupom}}** na assinatura.",
    rotuloBotao: "Ver os planos",
    urlBotao: "/assinatura",
    categoria: "CICLO_DE_VIDA",
  },
  {
    chave: "pagamento-falhou",
    nome: "Pagamento falhou",
    descricao: "Quando uma cobrança é recusada e de novo 3 dias depois, se continuar.",
    atrasoHoras: 72,
    assunto: "Não conseguimos cobrar sua assinatura do Skubo",
    preCabecalho: "Atualize o cartão para não perder o acesso.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nO Mercado Pago não conseguiu cobrar a assinatura da {{loja}}. Isso costuma ser cartão vencido, sem limite ou bloqueado pelo banco.\n\nAtualize a forma de pagamento para manter o Skubo funcionando. Seus dados ficam guardados.",
    rotuloBotao: "Resolver o pagamento",
    urlBotao: "/assinatura",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "cancelou",
    nome: "Cancelou",
    descricao: "No cancelamento, com a pesquisa de motivo de 1 clique.",
    atrasoHoras: 0,
    assunto: "Sua assinatura do Skubo foi cancelada",
    preCabecalho: "Nenhuma nova cobrança será feita.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nConfirmamos o cancelamento. Você continua usando o Skubo até **{{data_renovacao}}** e nenhuma nova cobrança será feita.\n\nPode contar, em um clique, por que cancelou? Isso ajuda muito:\n\n{{pesquisa}}",
    rotuloBotao: null,
    urlBotao: null,
    categoria: "TRANSACIONAL",
  },
  {
    chave: "renovacao-anual",
    nome: "Renovação anual próxima",
    descricao: "15 dias antes da renovação do plano anual.",
    atrasoHoras: 0,
    assunto: "Sua assinatura anual do Skubo renova em 15 dias",
    preCabecalho: "Renovação em {{data_renovacao}}.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nA assinatura anual da {{loja}} renova em **{{data_renovacao}}**, no valor de **{{valor}}**, no mesmo cartão.\n\nNão precisa fazer nada. Se quiser mudar algo, é só abrir sua assinatura.",
    rotuloBotao: "Ver minha assinatura",
    urlBotao: "/assinatura",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "creditos-acabando",
    nome: "Perguntas da IA acabando",
    descricao: "Quando o saldo de perguntas chega a 3 ou menos.",
    atrasoHoras: 0,
    assunto: "Restam {{saldo_ia}} perguntas da Skubo IA",
    preCabecalho: "Garanta mais perguntas para não ficar sem resposta.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nA {{loja}} tem **{{saldo_ia}} perguntas** da Skubo IA. Para continuar perguntando sem interrupção, já dá para comprar um pacote novo.",
    rotuloBotao: "Ver pacotes",
    urlBotao: "/ia",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "creditos-esgotados",
    nome: "Perguntas da IA esgotadas",
    descricao: "Quando o saldo de perguntas chega a zero.",
    atrasoHoras: 0,
    assunto: "Suas perguntas da Skubo IA acabaram",
    preCabecalho: "Compre um pacote para continuar perguntando.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nAs perguntas da Skubo IA da {{loja}} acabaram. Compre um pacote para continuar recebendo análises e respostas com os números da sua loja.",
    rotuloBotao: "Comprar perguntas",
    urlBotao: "/ia",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "indicacao-entrou",
    nome: "Indicação entrou",
    descricao: "Quando alguém cria conta pelo link de indicação, para quem indicou.",
    atrasoHoras: 0,
    assunto: "Alguém entrou no Skubo pelo seu link",
    preCabecalho: "Quando a pessoa assinar, você ganha dias grátis.",
    corpoMarkdown:
      "Olá, {{nome}}!\n\n**{{indicado}}** criou uma conta no Skubo com o seu link. Assim que a assinatura dessa pessoa for paga, você ganha **{{dias}} dias grátis**.",
    rotuloBotao: "Ver minhas indicações",
    urlBotao: "/indique",
    categoria: "TRANSACIONAL",
  },
  {
    chave: "indicacao-recompensa",
    nome: "Recompensa de indicação",
    descricao: "Quando a recompensa é liberada, para quem indicou.",
    atrasoHoras: 0,
    assunto: "Você ganhou {{dias}} dias grátis no Skubo",
    preCabecalho: "Sua indicação assinou. Obrigado por espalhar o Skubo!",
    corpoMarkdown:
      "Olá, {{nome}}!\n\nSua indicação assinou e a recompensa foi liberada: **{{dias}} dias grátis**. {{forma}}\n\nSeu link para indicar mais gente: {{link_indicacao}}",
    rotuloBotao: "Indicar mais gente",
    urlBotao: "/indique",
    categoria: "TRANSACIONAL",
  },
];

let garantidas = false;

export async function garantirAutomacoes(): Promise<void> {
  if (garantidas) return;
  await prisma.automacaoEmail.createMany({
    data: AUTOMACOES_PADRAO.map((a) => ({ ...a })),
    skipDuplicates: true,
  });
  garantidas = true;
}

export async function listarAutomacoes(): Promise<AutomacaoEmail[]> {
  await garantirAutomacoes();
  const ordem = new Map(AUTOMACOES_PADRAO.map((a, i) => [a.chave, i]));
  const lista = await prisma.automacaoEmail.findMany();
  return lista.sort((a, b) => (ordem.get(a.chave) ?? 99) - (ordem.get(b.chave) ?? 99));
}

export async function obterAutomacao(chave: string): Promise<AutomacaoEmail | null> {
  await garantirAutomacoes();
  return prisma.automacaoEmail.findUnique({ where: { chave } });
}

export type VariaveisAutomacao = Partial<Record<(typeof VARIAVEIS_AUTOMACAO)[number] | "forma", string | number | null>>;

export async function variaveisDaConta(contaId: string, userId: string | null): Promise<VariaveisAutomacao> {
  const [pessoa, perfil, configuracaoGeral, configuracao, saldo] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId ?? contaId }, select: { name: true } }),
    prisma.perfilCliente.findUnique({ where: { contaId }, select: { nomeLoja: true, codigoIndicacao: true } }),
    prisma.configuracaoGeral.findUnique({ where: { userId: contaId }, select: { nomeLoja: true } }),
    obterConfiguracaoComercial(),
    prisma.loteCreditoIa.aggregate({
      where: { contaId, validoAte: { gt: new Date() }, quantidadeRestante: { gt: 0 } },
      _sum: { quantidadeRestante: true },
    }),
  ]);
  const primeiroNome = pessoa?.name?.trim().split(/\s+/)[0] ?? "";
  const nomeLoja = configuracaoGeral?.nomeLoja ?? perfil?.nomeLoja ?? null;
  return {
    nome: primeiroNome || "lojista",
    loja: nomeLoja ? `loja ${nomeLoja}` : "sua loja",
    link_indicacao: perfil ? linkAbsoluto(`/r/${perfil.codigoIndicacao}`) : linkAbsoluto("/indique"),
    dias_teste: configuracao.diasTeste,
    saldo_ia: saldo._sum.quantidadeRestante ?? 0,
    link_planos: linkAbsoluto("/planos"),
  };
}

export function renderizarAutomacao(automacao: Pick<AutomacaoEmail, "assunto" | "preCabecalho" | "corpoMarkdown" | "rotuloBotao" | "urlBotao" | "cupomCodigo">, variaveis: VariaveisAutomacao) {
  const todas = { ...variaveis, cupom: variaveis.cupom ?? automacao.cupomCodigo ?? "" };
  let corpo = automacao.corpoMarkdown;
  if (!todas.cupom) corpo = corpo.replace(/\n*>[^\n]*\{\{\s*cupom\s*\}\}[^\n]*/g, "");
  return {
    assunto: substituirVariaveis(automacao.assunto, todas),
    preCabecalho: substituirVariaveis(automacao.preCabecalho, todas),
    corpo: substituirVariaveis(corpo, todas),
    botao: automacao.rotuloBotao && automacao.urlBotao ? { rotulo: automacao.rotuloBotao, url: automacao.urlBotao } : null,
  };
}

export interface PedidoAutomacao {
  chave: string;
  contaId: string;
  destinatario: { id: string; email: string };
  chaveIdempotencia: string;
  variaveis?: VariaveisAutomacao;
  ignorarDesligada?: boolean;
}

export async function dispararAutomacao(pedido: PedidoAutomacao): Promise<ResultadoEmail | null> {
  const automacao = await obterAutomacao(pedido.chave);
  if (!automacao) return null;
  if (!automacao.ativo && !pedido.ignorarDesligada) return null;
  const variaveis = { ...(await variaveisDaConta(pedido.contaId, pedido.destinatario.id)), ...(pedido.variaveis ?? {}) };
  const conteudo = renderizarAutomacao(automacao, variaveis);
  return enviarEmailSemFalhar({
    para: pedido.destinatario.email,
    modelo: "automacao",
    categoria: automacao.categoria,
    dados: { ...conteudo, motivo: motivoDaCategoria(automacao.categoria) },
    chaveIdempotencia: pedido.chaveIdempotencia,
    userId: pedido.destinatario.id,
    contaId: pedido.contaId,
  });
}

export function motivoDaCategoria(categoria: CategoriaEmail): string {
  if (categoria === "MARKETING") return "Você recebeu este e-mail porque aceitou receber novidades e ofertas do Skubo.";
  if (categoria === "CICLO_DE_VIDA") return "Você recebeu este e-mail porque tem uma conta no Skubo e queremos ajudar você a aproveitá-la.";
  return "Você recebeu este e-mail porque tem uma conta no Skubo.";
}
