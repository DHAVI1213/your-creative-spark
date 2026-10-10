/**
 * Regras da integração com a Kiwify: confere a assinatura do aviso e decide
 * o que acontece com o plano do cliente. Funções puras (testáveis).
 */

export type KiwifyPayload = {
  order_id?: string;
  order_status?: string;
  webhook_event_type?: string;
  product_type?: string;
  Product?: { product_id?: string; product_name?: string };
  Customer?: { email?: string; full_name?: string };
  Subscription?: {
    id?: string;
    status?: string;
    next_payment?: string;
    plan?: { name?: string; frequency?: string };
  } | null;
  subscription_id?: string;
  Commissions?: { charge_amount?: string | number; product_base_price?: string | number };
  [k: string]: unknown;
};

export type Decisao =
  | { acao: "ignorar"; motivo: string }
  | {
      acao: "salvar";
      email: string;
      plano: "mensal" | "vitalicio";
      status: "ativo" | "atrasado" | "cancelado" | "reembolsado";
      valido_ate: string | null | undefined; // undefined = não mexer
      order_id: string | null;
      subscription_id: string | null;
      valor_centavos: number | null;
    };

const DIA = 24 * 60 * 60 * 1000;

/** HMAC-SHA1 em hexadecimal (é o que a Kiwify manda em ?signature=). */
export async function hmacSha1Hex(segredo: string, mensagem: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredo),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(mensagem));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara sem vazar tempo (evita adivinhar a assinatura aos poucos). */
export function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function valorCentavos(p: KiwifyPayload): number | null {
  const v = p.Commissions?.charge_amount ?? p.Commissions?.product_base_price;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

function ehAssinatura(p: KiwifyPayload) {
  return Boolean(p.Subscription?.id || p.subscription_id || p.product_type === "membership");
}

/** Decide o que fazer com um aviso da Kiwify. */
export function decidir(p: KiwifyPayload, agora = new Date()): Decisao {
  const email = p.Customer?.email?.trim().toLowerCase();
  if (!email) return { acao: "ignorar", motivo: "aviso sem e-mail do cliente" };

  const evento = (p.webhook_event_type || "").toLowerCase();
  const status = (p.order_status || "").toLowerCase();
  const plano = ehAssinatura(p) ? "mensal" : "vitalicio";
  const base = {
    acao: "salvar" as const,
    email,
    plano: plano as "mensal" | "vitalicio",
    order_id: p.order_id ?? null,
    subscription_id: p.Subscription?.id ?? p.subscription_id ?? null,
    valor_centavos: valorCentavos(p),
  };

  // Validade do mensal: próxima cobrança + 3 dias de folga; sem data, 33 dias.
  const proxima = p.Subscription?.next_payment ? new Date(p.Subscription.next_payment) : null;
  const validoMensal =
    proxima && !Number.isNaN(proxima.getTime())
      ? new Date(proxima.getTime() + 3 * DIA).toISOString()
      : new Date(agora.getTime() + 33 * DIA).toISOString();

  if (
    evento === "order_refunded" ||
    status === "refunded" ||
    evento === "chargeback" ||
    status === "chargedback"
  ) {
    return { ...base, status: "reembolsado", valido_ate: undefined };
  }
  if (evento === "subscription_canceled") {
    return { ...base, plano: "mensal", status: "cancelado", valido_ate: undefined };
  }
  if (evento === "subscription_late") {
    return { ...base, plano: "mensal", status: "atrasado", valido_ate: undefined };
  }
  if (
    evento === "order_approved" ||
    evento === "subscription_renewed" ||
    status === "paid" ||
    status === "approved"
  ) {
    return {
      ...base,
      status: "ativo",
      valido_ate: base.plano === "vitalicio" ? null : validoMensal,
    };
  }
  return {
    acao: "ignorar",
    motivo: `evento sem efeito no acesso (${evento || status || "desconhecido"})`,
  };
}
