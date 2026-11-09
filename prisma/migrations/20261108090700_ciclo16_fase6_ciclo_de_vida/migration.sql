-- CreateEnum
CREATE TYPE "TipoMotivoCancelamento" AS ENUM ('PRECO', 'FALTOU_RECURSO', 'DIFICIL', 'PAROU_DE_VENDER', 'OUTRA_FERRAMENTA', 'OUTRO');

-- CreateTable
CREATE TABLE "automacoes_email" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atrasoHoras" INTEGER NOT NULL DEFAULT 0,
    "assunto" TEXT NOT NULL,
    "preCabecalho" TEXT NOT NULL,
    "corpoMarkdown" TEXT NOT NULL,
    "rotuloBotao" TEXT,
    "urlBotao" TEXT,
    "categoria" "CategoriaEmail" NOT NULL DEFAULT 'CICLO_DE_VIDA',
    "cupomCodigo" TEXT,
    "atualizadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automacoes_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motivos_cancelamento" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "userId" TEXT,
    "motivo" "TipoMotivoCancelamento" NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motivos_cancelamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automacoes_email_chave_key" ON "automacoes_email"("chave");

-- CreateIndex
CREATE INDEX "motivos_cancelamento_contaId_createdAt_idx" ON "motivos_cancelamento"("contaId", "createdAt");

-- CreateIndex
CREATE INDEX "motivos_cancelamento_motivo_createdAt_idx" ON "motivos_cancelamento"("motivo", "createdAt");
