import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decidir, hmacSha1Hex, iguais, type KiwifyPayload } from "@/lib/kiwify";

const agora = new Date("2026-10-10T12:00:00Z");

const compra = (extra: Partial<KiwifyPayload> = {}): KiwifyPayload => ({
  order_id: "ped-1",
  order_status: "paid",
  webhook_event_type: "order_approved",
  Customer: { email: "  Cliente@Email.com ", full_name: "Cliente" },
  Product: { product_name: "Fábrica de Conteúdo" },
  Commissions: { charge_amount: "49700" },
  ...extra,
});

describe("assinatura do aviso (HMAC-SHA1)", () => {
  it("gera o mesmo valor que o Node", async () => {
    const corpo = JSON.stringify(compra());
    const esperado = createHmac("sha1", "token-secreto").update(corpo).digest("hex");
    expect(await hmacSha1Hex("token-secreto", corpo)).toBe(esperado);
  });

  it("compara sem aceitar valores diferentes", () => {
    expect(iguais("abc", "abc")).toBe(true);
    expect(iguais("abc", "abd")).toBe(false);
    expect(iguais("abc", "abcd")).toBe(false);
  });
});

describe("decidir o que fazer com o aviso", () => {
  it("compra única aprovada vira vitalício ativo, sem vencimento", () => {
    const d = decidir(compra(), agora);
    expect(d).toMatchObject({
      acao: "salvar",
      email: "cliente@email.com",
      plano: "vitalicio",
      status: "ativo",
      valido_ate: null,
      valor_centavos: 49700,
    });
  });

  it("assinatura aprovada vira mensal com validade na próxima cobrança + 3 dias", () => {
    const d = decidir(
      compra({ Subscription: { id: "sub-1", next_payment: "2026-11-10T12:00:00Z" } }),
      agora,
    );
    expect(d).toMatchObject({ plano: "mensal", status: "ativo", subscription_id: "sub-1" });
    if (d.acao === "salvar") expect(d.valido_ate).toBe("2026-11-13T12:00:00.000Z");
  });

  it("mensal sem data de próxima cobrança ganha 33 dias", () => {
    const d = decidir(compra({ Subscription: { id: "sub-1" } }), agora);
    if (d.acao === "salvar") expect(d.valido_ate).toBe("2026-11-12T12:00:00.000Z");
  });

  it("renovação mantém ativo", () => {
    const d = decidir(
      compra({ webhook_event_type: "subscription_renewed", Subscription: { id: "sub-1" } }),
      agora,
    );
    expect(d).toMatchObject({ status: "ativo", plano: "mensal" });
  });

  it("reembolso e chargeback bloqueiam", () => {
    expect(
      decidir(compra({ webhook_event_type: "order_refunded", order_status: "refunded" }), agora),
    ).toMatchObject({
      status: "reembolsado",
    });
    expect(
      decidir(compra({ webhook_event_type: "chargeback", order_status: "chargedback" }), agora),
    ).toMatchObject({
      status: "reembolsado",
    });
  });

  it("cancelamento e atraso não mexem na validade", () => {
    const c = decidir(compra({ webhook_event_type: "subscription_canceled" }), agora);
    expect(c).toMatchObject({ status: "cancelado", plano: "mensal" });
    if (c.acao === "salvar") expect(c.valido_ate).toBeUndefined();
    expect(decidir(compra({ webhook_event_type: "subscription_late" }), agora)).toMatchObject({
      status: "atrasado",
    });
  });

  it("Pix gerado ou boleto pendente não libera nada", () => {
    expect(
      decidir(
        compra({ webhook_event_type: "pix_created", order_status: "waiting_payment" }),
        agora,
      ),
    ).toMatchObject({ acao: "ignorar" });
  });

  it("aviso sem e-mail é ignorado", () => {
    expect(decidir(compra({ Customer: {} }), agora)).toMatchObject({ acao: "ignorar" });
  });
});
