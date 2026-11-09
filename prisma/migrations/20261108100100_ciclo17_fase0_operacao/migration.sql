-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "PapelColunaTarefa" AS ENUM ('A_FAZER', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "OrigemTarefa" AS ENUM ('MANUAL', 'CAPTURA_RAPIDA', 'NOTA', 'RECORRENCIA', 'ROTINA_SUGERIDA', 'CENTRAL_CONTROLE', 'REPOSICAO', 'SAUDE_ANUNCIOS', 'PRODUTO', 'PEDIDO_COMPRA');

-- CreateEnum
CREATE TYPE "TipoVinculoTarefa" AS ENUM ('PRODUTO', 'ANUNCIO_ML', 'PEDIDO_COMPRA', 'FORNECEDOR', 'TELA');

-- CreateEnum
CREATE TYPE "TipoAtividadeTarefa" AS ENUM ('CRIADA', 'EDITADA', 'MOVIDA', 'ATRIBUIDA', 'PRAZO', 'PRIORIDADE', 'ETIQUETAS', 'CONCLUIDA', 'REABERTA', 'ARQUIVADA', 'RESTAURADA', 'COMENTARIO', 'CHECKLIST', 'RECORRENCIA');

-- CreateEnum
CREATE TYPE "TipoNotaOperacao" AS ENUM ('NOTA', 'IDEIA');

-- CreateEnum
CREATE TYPE "VisibilidadeNota" AS ENUM ('EQUIPE', 'PRIVADA');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TAREFA';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailTarefas" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "quadros_tarefas" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT NOT NULL DEFAULT 'azul',
    "posicao" DOUBLE PRECISION NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "arquivadoEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quadros_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colunas_tarefas" (
    "id" TEXT NOT NULL,
    "quadroId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "PapelColunaTarefa" NOT NULL DEFAULT 'A_FAZER',
    "posicao" DOUBLE PRECISION NOT NULL,
    "limite" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colunas_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "quadroId" TEXT NOT NULL,
    "colunaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "prioridade" "PrioridadeTarefa" NOT NULL DEFAULT 'MEDIA',
    "posicao" DOUBLE PRECISION NOT NULL,
    "responsavelId" TEXT,
    "criadoPorId" TEXT,
    "prazo" TIMESTAMP(3),
    "prazoComHora" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" TIMESTAMP(3),
    "concluidaPorId" TEXT,
    "arquivadaEm" TIMESTAMP(3),
    "origem" "OrigemTarefa" NOT NULL DEFAULT 'MANUAL',
    "chaveOrigem" TEXT,
    "vinculoTipo" "TipoVinculoTarefa",
    "vinculoId" TEXT,
    "vinculoRotulo" TEXT,
    "vinculoHref" TEXT,
    "recorrencia" JSONB,
    "serieId" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas_tarefas" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etiquetas_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas_etiquetas" (
    "tarefaId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "tarefas_etiquetas_pkey" PRIMARY KEY ("tarefaId","etiquetaId")
);

-- CreateTable
CREATE TABLE "itens_checklist_tarefa" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "posicao" DOUBLE PRECISION NOT NULL,
    "concluidoPorId" TEXT,
    "concluidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_checklist_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios_tarefa" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "autorId" TEXT,
    "corpo" TEXT NOT NULL,
    "mencoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades_tarefa" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "autorId" TEXT,
    "tipo" "TipoAtividadeTarefa" NOT NULL,
    "dados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_operacao" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "autorId" TEXT,
    "tipo" "TipoNotaOperacao" NOT NULL DEFAULT 'NOTA',
    "titulo" TEXT,
    "conteudo" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT 'amarelo',
    "fixada" BOOLEAN NOT NULL DEFAULT false,
    "visibilidade" "VisibilidadeNota" NOT NULL DEFAULT 'EQUIPE',
    "posicao" DOUBLE PRECISION NOT NULL,
    "apoios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tarefaId" TEXT,
    "arquivadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_operacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequencias_conta" (
    "contaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,

    CONSTRAINT "sequencias_conta_pkey" PRIMARY KEY ("contaId","chave")
);

-- CreateIndex
CREATE INDEX "quadros_tarefas_contaId_arquivadoEm_idx" ON "quadros_tarefas"("contaId", "arquivadoEm");

-- CreateIndex
CREATE INDEX "colunas_tarefas_quadroId_posicao_idx" ON "colunas_tarefas"("quadroId", "posicao");

-- CreateIndex
CREATE INDEX "tarefas_contaId_arquivadaEm_concluidaEm_idx" ON "tarefas"("contaId", "arquivadaEm", "concluidaEm");

-- CreateIndex
CREATE INDEX "tarefas_contaId_responsavelId_concluidaEm_idx" ON "tarefas"("contaId", "responsavelId", "concluidaEm");

-- CreateIndex
CREATE INDEX "tarefas_contaId_prazo_idx" ON "tarefas"("contaId", "prazo");

-- CreateIndex
CREATE INDEX "tarefas_colunaId_posicao_idx" ON "tarefas"("colunaId", "posicao");

-- CreateIndex
CREATE UNIQUE INDEX "tarefas_contaId_numero_key" ON "tarefas"("contaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "tarefas_contaId_chaveOrigem_key" ON "tarefas"("contaId", "chaveOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "tarefas_serieId_prazo_key" ON "tarefas"("serieId", "prazo");

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_tarefas_contaId_nome_key" ON "etiquetas_tarefas"("contaId", "nome");

-- CreateIndex
CREATE INDEX "tarefas_etiquetas_etiquetaId_idx" ON "tarefas_etiquetas"("etiquetaId");

-- CreateIndex
CREATE INDEX "itens_checklist_tarefa_tarefaId_posicao_idx" ON "itens_checklist_tarefa"("tarefaId", "posicao");

-- CreateIndex
CREATE INDEX "comentarios_tarefa_tarefaId_createdAt_idx" ON "comentarios_tarefa"("tarefaId", "createdAt");

-- CreateIndex
CREATE INDEX "atividades_tarefa_tarefaId_createdAt_idx" ON "atividades_tarefa"("tarefaId", "createdAt");

-- CreateIndex
CREATE INDEX "notas_operacao_contaId_arquivadaEm_idx" ON "notas_operacao"("contaId", "arquivadaEm");

-- CreateIndex
CREATE INDEX "notas_operacao_autorId_idx" ON "notas_operacao"("autorId");

-- AddForeignKey
ALTER TABLE "quadros_tarefas" ADD CONSTRAINT "quadros_tarefas_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colunas_tarefas" ADD CONSTRAINT "colunas_tarefas_quadroId_fkey" FOREIGN KEY ("quadroId") REFERENCES "quadros_tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_quadroId_fkey" FOREIGN KEY ("quadroId") REFERENCES "quadros_tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_colunaId_fkey" FOREIGN KEY ("colunaId") REFERENCES "colunas_tarefas"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etiquetas_tarefas" ADD CONSTRAINT "etiquetas_tarefas_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_etiquetas" ADD CONSTRAINT "tarefas_etiquetas_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_etiquetas" ADD CONSTRAINT "tarefas_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas_tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_checklist_tarefa" ADD CONSTRAINT "itens_checklist_tarefa_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_checklist_tarefa" ADD CONSTRAINT "itens_checklist_tarefa_concluidoPorId_fkey" FOREIGN KEY ("concluidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarefa" ADD CONSTRAINT "comentarios_tarefa_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_tarefa" ADD CONSTRAINT "comentarios_tarefa_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades_tarefa" ADD CONSTRAINT "atividades_tarefa_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades_tarefa" ADD CONSTRAINT "atividades_tarefa_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_operacao" ADD CONSTRAINT "notas_operacao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_operacao" ADD CONSTRAINT "notas_operacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_operacao" ADD CONSTRAINT "notas_operacao_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequencias_conta" ADD CONSTRAINT "sequencias_conta_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

