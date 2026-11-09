import type { UserRole } from "@prisma/client";
import { prisma, type ClienteTransacao } from "@/lib/prisma";
import { SemPermissaoError, exigirPermissao, podeEditar, podeVer } from "@/lib/permissoes";
import { COLUNAS_PADRAO, ETIQUETAS_PADRAO, NOME_QUADRO_PADRAO } from "./dominio/esquemas";
import { ESPACO_POSICAO } from "./dominio/posicao";

export interface ContextoOperacao {
  contaId: string;
  userId: string;
  nome: string;
  papel: UserRole;
  podeEditar: boolean;
  podeAdministrar: boolean;
}

export interface MembroOperacao {
  id: string;
  nome: string;
  email: string;
  imagem: string | null;
  papel: UserRole;
  podeEditar: boolean;
}

export function contextoDoUsuario(usuario: {
  id: string;
  contaId: string;
  role: UserRole;
  name: string | null;
  email: string;
}): ContextoOperacao {
  exigirLeitura(usuario.role);
  return {
    contaId: usuario.contaId,
    userId: usuario.id,
    nome: usuario.name?.trim() || usuario.email.split("@")[0],
    papel: usuario.role,
    podeEditar: podeEditar(usuario.role, "TAREFAS_EDITAR"),
    podeAdministrar: podeEditar(usuario.role, "TAREFAS_ADMINISTRAR"),
  };
}

function exigirLeitura(papel: UserRole): void {
  if (!podeVer(papel, "TAREFAS_EDITAR")) throw new SemPermissaoError("TAREFAS_EDITAR");
}

export function exigirEdicao(contexto: ContextoOperacao): void {
  exigirPermissao(contexto.papel, "TAREFAS_EDITAR");
}

export function exigirAdministracao(contexto: ContextoOperacao): void {
  exigirPermissao(contexto.papel, "TAREFAS_ADMINISTRAR");
}

export function nomeDaPessoa(pessoa: { name: string | null; email: string }): string {
  return pessoa.name?.trim() || pessoa.email.split("@")[0];
}

export async function membrosDaConta(contaId: string, cliente: ClienteTransacao = prisma): Promise<MembroOperacao[]> {
  const pessoas = await cliente.user.findMany({
    where: { OR: [{ id: contaId }, { contaId }], bloqueadoEm: null },
    select: { id: true, name: true, email: true, image: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return pessoas.map((pessoa) => ({
    id: pessoa.id,
    nome: nomeDaPessoa(pessoa),
    email: pessoa.email,
    imagem: pessoa.image,
    papel: pessoa.role,
    podeEditar: podeEditar(pessoa.role, "TAREFAS_EDITAR"),
  }));
}

export async function idsDaConta(contaId: string, ids: string[], cliente: ClienteTransacao = prisma): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const pessoas = await cliente.user.findMany({
    where: { id: { in: ids }, OR: [{ id: contaId }, { contaId }], bloqueadoEm: null },
    select: { id: true },
  });
  return new Set(pessoas.map((p) => p.id));
}

export async function proximoNumero(cliente: ClienteTransacao, contaId: string, chave: string): Promise<number> {
  const linhas = await cliente.$queryRaw<Array<{ valor: number }>>`
    INSERT INTO "sequencias_conta" ("contaId", "chave", "valor")
    VALUES (${contaId}, ${chave}, 1)
    ON CONFLICT ("contaId", "chave") DO UPDATE SET "valor" = "sequencias_conta"."valor" + 1
    RETURNING "valor"`;
  return Number(linhas[0].valor);
}

export async function garantirEstruturaPadrao(contaId: string, userId: string): Promise<void> {
  const existentes = await prisma.quadroTarefas.count({ where: { contaId } });
  if (existentes > 0) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`operacao:${contaId}`}))`;
    if ((await tx.quadroTarefas.count({ where: { contaId } })) > 0) return;
    await tx.quadroTarefas.create({
      data: {
        contaId,
        nome: NOME_QUADRO_PADRAO,
        descricao: "O dia a dia da loja: compras, estoque, Full, anúncios e financeiro.",
        cor: "azul",
        posicao: ESPACO_POSICAO,
        padrao: true,
        criadoPorId: userId,
        colunas: {
          create: COLUNAS_PADRAO.map((coluna, indice) => ({
            nome: coluna.nome,
            papel: coluna.papel,
            posicao: (indice + 1) * ESPACO_POSICAO,
          })),
        },
      },
    });
    await tx.etiquetaTarefa.createMany({
      data: ETIQUETAS_PADRAO.map((etiqueta) => ({ contaId, nome: etiqueta.nome, cor: etiqueta.cor })),
      skipDuplicates: true,
    });
  });
}
