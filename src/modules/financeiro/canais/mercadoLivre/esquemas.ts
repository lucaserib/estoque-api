import { z } from "zod";

const idComoString = z.union([z.string(), z.number()]).transform(String);

export const itemPedidoSchema = z.object({
  item: z.object({
    id: idComoString,
    title: z.string(),
    seller_sku: z.string().optional(),
    seller_custom_field: z.string().optional(),
    variation_id: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v))),
  }),
  quantity: z.number(),
  unit_price: z.number(),
  gross_price: z.number().optional(),
  full_unit_price: z.number().optional(),
  sale_fee: z.number().optional(),
});

export const pagamentoSchema = z.object({
  id: idComoString.optional(),
  status: z.string().optional(),
  status_detail: z.string().optional(),
  transaction_amount: z.number().optional(),
  transaction_amount_refunded: z.number().optional(),
  date_approved: z.string().nullish(),
  money_release_date: z.string().nullish(),
});

export const pedidoSchema = z.object({
  id: idComoString,
  status: z.string(),
  date_created: z.string(),
  date_closed: z.string().optional(),
  last_updated: z.string().optional(),
  pack_id: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v))),
  total_amount: z.number().optional(),
  paid_amount: z.number().optional(),
  payments: z.array(pagamentoSchema).optional(),
  shipping: z.record(z.unknown()).optional(),
  order_items: z.array(itemPedidoSchema),
  order_request: z
    .object({
      return: z.union([z.string(), z.null()]).optional(),
      change: z.union([z.string(), z.number(), z.null()]).optional(),
    })
    .optional(),
  mediations: z.array(z.object({ id: idComoString })).optional(),
  cancel_detail: z
    .object({
      code: z.string().optional(),
      group: z.string().optional(),
      date: z.string().optional(),
    })
    .nullish(),
});

const descontoItemSchema = z.object({
  id: idComoString.optional(),
  variation_id: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v))),
  quantity: z.number().optional(),
  amounts: z.object({
    total: z.number().optional(),
    seller: z.number().optional(),
  }),
});

export const descontosSchema = z.object({
  details: z
    .array(
      z.object({
        type: z.string().optional(),
        items: z.array(descontoItemSchema),
        supplier: z
          .object({
            funding_mode: z.string().optional(),
            offer_id: z.string().optional(),
          })
          .optional(),
      })
    )
    .default([]),
});

export const custoEnvioSchema = z.object({
  gross_amount: z.number().optional(),
  receiver: z.object({ cost: z.number().optional() }).optional(),
  senders: z
    .array(
      z.object({
        user_id: idComoString.optional(),
        cost: z.number().optional(),
        compensation: z.number().optional(),
        compensations: z.array(z.object({ amount: z.number().optional() })).optional(),
      })
    )
    .optional(),
});

export const envioSchema = z.object({
  id: idComoString,
  logistic_type: z.string().optional(),
  mode: z.string().optional(),
  status: z.string().optional(),
});

export type PedidoValidado = z.infer<typeof pedidoSchema>;
export type DescontosValidados = z.infer<typeof descontosSchema>;
export type CustoEnvioValidado = z.infer<typeof custoEnvioSchema>;
export type EnvioValidado = z.infer<typeof envioSchema>;
export type PagamentoValidado = z.infer<typeof pagamentoSchema>;
