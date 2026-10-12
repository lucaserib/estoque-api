-- Ciclo 7 Fase 8: notificações novas ligadas ao módulo financeiro
-- (contas a vencer/vencidas, venda com prejuízo, divergência de conciliação).

-- NotificationType: CONTA_A_VENCER, CONTA_VENCIDA, VENDA_COM_PREJUIZO, DIVERGENCIA_CONCILIACAO
ALTER TYPE "NotificationType" ADD VALUE 'CONTA_A_VENCER';
ALTER TYPE "NotificationType" ADD VALUE 'CONTA_VENCIDA';
ALTER TYPE "NotificationType" ADD VALUE 'VENDA_COM_PREJUIZO';
ALTER TYPE "NotificationType" ADD VALUE 'DIVERGENCIA_CONCILIACAO';
