import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { registrarEvento } from "@/modules/clientes/eventos";
import { garantirPerfilCliente, type DadosPerfilCliente } from "@/modules/clientes/perfil";
import { dispararAutomacao } from "@/modules/email/automacoes";
import { enviarConfirmacaoDeEmail } from "@/modules/usuarios/senha";
import { criarAssinaturaDaConta } from "./situacao";
import { concederLote, validadeEmDias } from "@/modules/ia/creditos";
import { registrarIndicacaoNoCadastro } from "@/modules/indicacao/cadastro";

export type OrigemCadastro = "senha" | "google" | "convite";

export interface OpcoesNovaConta {
  perfil?: DadosPerfilCliente;
  ip?: string | null;
  userAgent?: string | null;
  codigoIndicacao?: string | null;
}

async function etapa(nome: string, executar: () => Promise<unknown>): Promise<void> {
  try {
    await executar();
  } catch (error) {
    console.error(`[CONTA] Falha em "${nome}" ao preparar a conta nova:`, error);
  }
}

export async function aoCriarConta(
  userId: string,
  contaId: string | null,
  origem: OrigemCadastro,
  opcoes: OpcoesNovaConta = {}
): Promise<void> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, password: true, emailVerificadoEm: true },
  });
  if (!usuario) return;

  if (usuario.password && !usuario.emailVerificadoEm) {
    await etapa("confirmação de e-mail", () => enviarConfirmacaoDeEmail(userId, opcoes.ip ?? null));
  }
  if (contaId) return;

  await etapa("assinatura", () => criarAssinaturaDaConta(userId));
  await etapa("perfil", () => garantirPerfilCliente(userId, opcoes.perfil ?? {}));
  await etapa("evento", () => registrarEvento(userId, "CONTA_CRIADA", { userId, propriedades: { origem } }));
  await etapa("perguntas do teste", async () => {
    const configuracao = await obterConfiguracaoComercial();
    if (configuracao.iaPerguntasTeste <= 0) return;
    await concederLote({
      contaId: userId,
      origem: "TESTE",
      quantidade: configuracao.iaPerguntasTeste,
      validoAte: validadeEmDias(configuracao.iaValidadeDiasTeste),
      chaveIdempotencia: `teste:${userId}`,
      descricao: "Perguntas grátis do teste",
    });
  });
  if (opcoes.codigoIndicacao) {
    await etapa("indicação", () => registrarIndicacaoNoCadastro(userId, opcoes.codigoIndicacao!));
  }
  await etapa("boas-vindas", () =>
    dispararAutomacao({
      chave: "boas-vindas",
      contaId: userId,
      destinatario: { id: userId, email: usuario.email },
      chaveIdempotencia: `boas-vindas:${userId}`,
    })
  );
}
