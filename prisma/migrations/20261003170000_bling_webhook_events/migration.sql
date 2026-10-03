CREATE TABLE "bling_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "companyId" TEXT,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "bling_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bling_webhook_events_eventId_key" ON "bling_webhook_events"("eventId");

CREATE INDEX "bling_webhook_events_companyId_idx" ON "bling_webhook_events"("companyId");

CREATE INDEX "bling_webhook_events_processado_idx" ON "bling_webhook_events"("processado");
