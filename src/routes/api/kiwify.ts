import { createFileRoute } from "@tanstack/react-router";

import { decidir, hmacSha1Hex, iguais, valorCentavos, type KiwifyPayload } from "@/lib/kiwify";

/**
 * Recebe os avisos da Kiwify (compra aprovada, renovação, cancelamento, reembolso...)
 * e libera ou bloqueia o acesso do cliente. Configure na Kiwify:
 *   Apps → Webhooks → URL: https://SEU-SITE/api/kiwify  (todos os eventos)
 * e cole o token do webhook no Painel do dono.
 */

const MAX_BYTES = 256 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/kiwify")({
  server: {
    handlers: {
      GET: async () => json({ ok: true, servico: "webhook Kiwify da Fábrica de Conteúdo" }),

      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_BYTES) return json({ ok: false, erro: "aviso grande demais" }, 413);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let payload: KiwifyPayload;
        try {
          payload = JSON.parse(raw) as KiwifyPayload;
        } catch {
          return json({ ok: false, erro: "JSON inválido" }, 400);
        }

        // 1) Confere se o aviso veio mesmo da Kiwify (assinatura HMAC-SHA1 com o token).
        const { data: segredo } = await supabaseAdmin
          .from("app_secrets")
          .select("valor")
          .eq("chave", "kiwify_token")
          .maybeSingle();
        const token = segredo?.valor ?? "";
        const assinatura = new URL(request.url).searchParams.get("signature") ?? "";
        const valida =
          token.length > 0 &&
          assinatura.length > 0 &&
          iguais(await hmacSha1Hex(token, raw), assinatura.toLowerCase());

        const evento = {
          tipo: payload.webhook_event_type ?? null,
          status_pedido: payload.order_status ?? null,
          email: payload.Customer?.email?.toLowerCase() ?? null,
          produto: payload.Product?.product_name ?? null,
          order_id: payload.order_id ?? null,
          valor_centavos: valorCentavos(payload),
          assinatura_valida: valida,
          payload: valida ? (payload as never) : null, // não guarda dados de avisos falsos
        };

        if (!valida) {
          await supabaseAdmin.from("eventos_kiwify").insert({
            ...evento,
            erro: token ? "assinatura inválida" : "token da Kiwify não configurado",
          });
          return json({ ok: false, erro: "assinatura inválida" }, 401);
        }

        // 2) Decide o que fazer com o plano do cliente.
        const decisao = decidir(payload);
        if (decisao.acao === "ignorar") {
          await supabaseAdmin
            .from("eventos_kiwify")
            .insert({ ...evento, processado: true, erro: decisao.motivo });
          return json({ ok: true, ignorado: decisao.motivo });
        }

        const { data: atual } = await supabaseAdmin
          .from("assinaturas")
          .select("*")
          .eq("email", decisao.email)
          .maybeSingle();

        // Quem já é vitalício não perde o acesso por causa de um evento de plano mensal.
        if (
          atual?.plano === "vitalicio" &&
          atual.status === "ativo" &&
          decisao.plano === "mensal"
        ) {
          await supabaseAdmin
            .from("eventos_kiwify")
            .insert({ ...evento, processado: true, erro: "cliente já é vitalício; mantido" });
          return json({ ok: true, ignorado: "cliente já é vitalício" });
        }

        const registro = {
          email: decisao.email,
          plano: decisao.plano,
          status: decisao.status,
          origem: "kiwify" as const,
          kiwify_order_id: decisao.order_id ?? atual?.kiwify_order_id ?? null,
          kiwify_subscription_id: decisao.subscription_id ?? atual?.kiwify_subscription_id ?? null,
          valor_centavos: decisao.valor_centavos ?? atual?.valor_centavos ?? null,
          ...(decisao.valido_ate !== undefined ? { valido_ate: decisao.valido_ate } : {}),
        };

        const { error } = await supabaseAdmin
          .from("assinaturas")
          .upsert(registro, { onConflict: "email" });
        await supabaseAdmin
          .from("eventos_kiwify")
          .insert({ ...evento, processado: !error, erro: error?.message ?? null });

        if (error) return json({ ok: false, erro: "falha ao salvar" }, 500);
        return json({
          ok: true,
          email: decisao.email,
          status: decisao.status,
          plano: decisao.plano,
        });
      },
    },
  },
});
