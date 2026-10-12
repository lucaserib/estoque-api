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

  static async notifyCadastroIncompleto(
    userId: string,
    quantidadePendenciasCriticas: number
  ): Promise<void> {
    await this.create({
      userId,
      type: "CADASTRO_INCOMPLETO",
      title: "Pendências de cadastro aumentaram",
      body: `${quantidadePendenciasCriticas} produto(s) com pendências críticas (sem custo, sem fornecedor, sem preço ou margem negativa).`,
      link: "/produtos",
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de cadastro:", error)
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

  static async notifyContaAVencer(
    userId: string,
    lancamentoId: string,
    descricao: string,
    valor: number
  ): Promise<void> {
    await this.create({
      userId,
      type: "CONTA_A_VENCER",
      title: "Conta vence amanhã",
      body: `${descricao} (${(valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) vence amanhã.`,
      link: `/financeiro/lancamentos?destaque=${lancamentoId}`,
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de conta a vencer:", error)
    );
  }

  static async notifyContaVencida(
    userId: string,
    lancamentoId: string,
    descricao: string,
    valor: number
  ): Promise<void> {
    await this.create({
      userId,
      type: "CONTA_VENCIDA",
      title: "Conta vencida",
      body: `${descricao} (${(valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) está vencida e ainda não foi paga.`,
      link: `/financeiro/lancamentos?destaque=${lancamentoId}`,
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de conta vencida:", error)
    );
  }

  static async notifyVendaComPrejuizo(
    userId: string,
    vendaId: string,
    pedidoExternoId: string,
    margemContribuicao: number
  ): Promise<void> {
    await this.create({
      userId,
      type: "VENDA_COM_PREJUIZO",
      title: "Venda com prejuízo",
      body: `Pedido #${pedidoExternoId} fechou com margem negativa (${(margemContribuicao / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`,
      link: `/financeiro/vendas?destaque=${vendaId}`,
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de venda com prejuízo:", error)
    );
  }

  static async notifyDivergenciaConciliacao(
    userId: string,
    mesReferencia: string,
    tipo: string,
    diferenca: number
  ): Promise<void> {
    await this.create({
      userId,
      type: "DIVERGENCIA_CONCILIACAO",
      title: "Divergência na conciliação do mês",
      body: `${tipo} de ${mesReferencia} diverge ${(diferenca / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} entre os pedidos e a fatura.`,
      link: `/financeiro/configuracoes?mesConciliacao=${mesReferencia}`,
    }).catch((error) =>
      console.error("[NOTIF] Falha ao criar notificação de conciliação:", error)
    );
  }
}
