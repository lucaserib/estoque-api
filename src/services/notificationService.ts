import { prisma } from "@/lib/prisma";
import { NotificationType, Notification } from "@prisma/client";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export class NotificationService {
  static async create(
    input: CreateNotificationInput
  ): Promise<Notification | null> {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        link: input.link ?? null,
        readAt: null,
      },
    });

    if (existing) {
      return null;
    }

    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });
  }

  static async notifyBlingExpired(userId: string): Promise<void> {
    await this.create({
      userId,
      type: "BLING_EXPIRADO",
      title: "Conexão com o Bling expirou",
      body: "Reconecte sua conta do Bling para continuar importando produtos e sincronizando estoque.",
      link: "/produtos/importar",
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação Bling:", error)
    );
  }

  static async notifyMLExpired(userId: string): Promise<void> {
    await this.create({
      userId,
      type: "ML_EXPIRADO",
      title: "Conexão com o Mercado Livre expirou",
      body: "Reconecte sua conta do Mercado Livre para continuar sincronizando anúncios e vendas.",
      link: "/configuracoes",
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação ML:", error)
    );
  }

  static async notifySyncError(
    userId: string,
    detail: string
  ): Promise<void> {
    await this.create({
      userId,
      type: "SYNC_ERRO",
      title: "Falha na sincronização com o Mercado Livre",
      body: detail,
      link: "/configuracoes",
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de sync:", error)
    );
  }

  static async notifyEstoqueCritico(
    userId: string,
    produtoNome: string,
    produtoId: string
  ): Promise<void> {
    await this.create({
      userId,
      type: "ESTOQUE_CRITICO",
      title: "Produto em estoque crítico",
      body: `${produtoNome} atingiu o estoque de segurança. Programe a reposição.`,
      link: `/reposicao?produtoId=${produtoId}`,
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de estoque:", error)
    );
  }

  static async notifyPedidoConcluido(
    userId: string,
    fornecedorNome: string
  ): Promise<void> {
    await this.create({
      userId,
      type: "PEDIDO_CONCLUIDO",
      title: "Pedido de compra concluído",
      body: `O pedido do fornecedor ${fornecedorNome} foi recebido e o estoque atualizado.`,
      link: "/gestao-pedidos",
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de pedido:", error)
    );
  }
}
