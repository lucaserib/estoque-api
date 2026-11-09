type Registro = Record<string, unknown>;

interface Armazem {
  contador: number;
  preapprovals: Map<string, Registro>;
  preferencias: Map<string, Registro>;
  pagamentos: Map<string, Registro>;
}

const global = globalThis as typeof globalThis & { __mercadoPagoFalso?: Armazem };

function armazem(): Armazem {
  global.__mercadoPagoFalso ??= { contador: 1000, preapprovals: new Map(), preferencias: new Map(), pagamentos: new Map() };
  return global.__mercadoPagoFalso;
}

export function usarMercadoPagoFalso(): boolean {
  return process.env.MP_PROVEDOR_FALSO === "1" && process.env.VERCEL_ENV !== "production";
}

function urlBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function proximoId(): number {
  return ++armazem().contador;
}

export function responderMercadoPagoFalso(caminho: string, metodo: string, corpo: Registro | null): unknown {
  const dados = armazem();
  const [rota] = caminho.split("?");

  if (rota === "/preapproval" && metodo === "POST") {
    const id = `pre-falso-${proximoId()}`;
    const registro = { ...corpo, id, status: "pending", init_point: `${urlBase()}/api/teste/mercadopago/autorizar?preapproval=${id}` };
    dados.preapprovals.set(id, registro);
    return registro;
  }
  const preapproval = rota.match(/^\/preapproval\/(.+)$/);
  if (preapproval) {
    const atual = dados.preapprovals.get(preapproval[1]);
    if (!atual) throw new Error(`Mercado Pago falso: preapproval ${preapproval[1]} não existe`);
    if (metodo === "PUT" && corpo) {
      const recorrencia = { ...(atual.auto_recurring as Registro), ...((corpo.auto_recurring as Registro | undefined) ?? {}) };
      const atualizado = { ...atual, ...corpo, auto_recurring: recorrencia };
      dados.preapprovals.set(preapproval[1], atualizado);
      return atualizado;
    }
    return atual;
  }
  if (rota === "/checkout/preferences" && metodo === "POST") {
    const id = `pref-falso-${proximoId()}`;
    const registro = { ...corpo, id, init_point: `${urlBase()}/api/teste/mercadopago/pagar?preferencia=${id}` };
    dados.preferencias.set(id, registro);
    return registro;
  }
  const reembolso = rota.match(/^\/v1\/payments\/(.+)\/refunds$/);
  if (reembolso) {
    const pagamento = dados.pagamentos.get(reembolso[1]);
    if (pagamento) dados.pagamentos.set(reembolso[1], { ...pagamento, status: "refunded" });
    return { id: proximoId(), status: "approved" };
  }
  const pagamento = rota.match(/^\/v1\/payments\/(.+)$/);
  if (pagamento) {
    const atual = dados.pagamentos.get(pagamento[1]);
    if (!atual) throw new Error(`Mercado Pago falso: pagamento ${pagamento[1]} não existe`);
    return atual;
  }
  throw new Error(`Mercado Pago falso: rota não simulada ${metodo} ${caminho}`);
}

export function preferenciaFalsa(id: string): Registro | undefined {
  return armazem().preferencias.get(id);
}

export function preapprovalFalso(id: string): Registro | undefined {
  return armazem().preapprovals.get(id);
}

export function registrarPagamentoFalso(pagamento: Registro): Registro {
  const id = String(proximoId());
  const registro = { ...pagamento, id: Number(id) };
  armazem().pagamentos.set(id, registro);
  return registro;
}
