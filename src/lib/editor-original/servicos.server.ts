import { createClient } from "@supabase/supabase-js";
import { candidatosPorRegras, enderecoNuvem, limitarCandidatos, type Candidato } from "./regras";
import { z } from "zod";

type Configuracao = {
  openai?: string | undefined;
  gemini?: string | undefined;
  claude?: string | undefined;
  cloudUrl?: string | undefined;
  cloudKey?: string | undefined;
};
const palavra = z.object({
  w: z.string().max(200),
  s: z.number().nonnegative(),
  e: z.number().nonnegative(),
});
const candidato = z.object({
  s: z.number(),
  e: z.number(),
  nota: z.number(),
  titulo: z.string().max(300),
  gancho: z.string().default(""),
  descricao: z.string().default(""),
  origem: z.string().default("ia"),
});
const string = (v: unknown) => (typeof v === "string" ? v : "");

async function jsonFetch(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(120000) });
  const json = (await r.json()) as Record<string, unknown>;
  if (!r.ok)
    throw new Error(
      `O serviço respondeu ${r.status}. Confira a configuração e o saldo da sua conta.`,
    );
  return json;
}

export async function executarServico(data: {
  token: string;
  acao: string;
  payload: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error } = await supabaseAdmin.auth.getUser(data.token);
  if (error || !auth.user) throw new Error("Entre na sua conta novamente.");
  // Mesmo critério de acesso usado pelo app, executado com o JWT do usuário.
  const cliente = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    {
      global: { headers: { Authorization: `Bearer ${data.token}` } },
      auth: { persistSession: false },
    },
  );
  const acesso = await cliente.rpc("tem_acesso");
  if (acesso.error || !acesso.data)
    throw new Error("Seu plano precisa estar ativo para usar o editor.");
  // Nova tabela tem RLS e acesso exclusivo do servidor. O tipo gerado da Lovable
  // não deve ser editado; REST mantém essa integração independente do gerador.
  const dbUrl = process.env["SUPABASE_URL"]!,
    key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const headers: Record<string, string> = {
    apikey: key,
    "content-type": "application/json",
  };
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  const endpoint = `${dbUrl}/rest/v1/editor_conexoes`;
  const resposta = await fetch(`${endpoint}?user_id=eq.${auth.user.id}&select=configuracao`, {
    headers,
  });
  if (!resposta.ok)
    throw new Error(
      "Aplique a migração editor_conexoes na Lovable para configurar IA e agendamento.",
    );
  const registros = (await resposta.json()) as { configuracao: Configuracao }[];
  let cfg: Configuracao = registros[0]?.configuracao ?? {};
  const p = data.payload;
  if (data.acao === "configurar") {
    const nova = z
      .object({
        openai: z.string().max(500).optional(),
        gemini: z.string().max(500).optional(),
        claude: z.string().max(500).optional(),
        cloudUrl: z.string().max(500).optional(),
        cloudKey: z.string().max(500).optional(),
      })
      .parse(p);
    if (nova.cloudUrl) nova.cloudUrl = enderecoNuvem(nova.cloudUrl);
    cfg = { ...cfg, ...nova };
    const gravar = await fetch(`${endpoint}?on_conflict=user_id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: auth.user.id, configuracao: cfg }),
    });
    if (!gravar.ok) throw new Error("Não foi possível salvar as conexões.");
    return { ok: true };
  }
  if (data.acao === "cloud-config")
    return cfg.cloudUrl && cfg.cloudKey
      ? { url: cfg.cloudUrl, apiKey: "configurada-no-servidor" }
      : null;
  if (data.acao === "cloud" || data.acao === "upload") {
    if (!cfg.cloudUrl || !cfg.cloudKey)
      throw new Error("Configure a sua nuvem no editor primeiro.");
    const url = enderecoNuvem(cfg.cloudUrl),
      method = data.acao === "upload" ? "PUT" : string(p["method"]),
      caminho =
        data.acao === "upload"
          ? `/api/upload/${encodeURIComponent(string(p["key"]))}`
          : string(p["path"]);
    if (
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) ||
      !/^\/api\/[a-zA-Z0-9_/%?=&.-]+$/.test(caminho) ||
      caminho.includes("..")
    )
      throw new Error("Pedido inválido.");
    let body: BodyInit | undefined,
      mime = "application/json";
    if (data.acao === "upload") {
      const m = string(p["media"]).match(
        /^data:(video\/mp4|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/,
      );
      if (!m || m[2]!.length > 100 * 1024 * 1024)
        throw new Error("Arquivo inválido ou muito grande para envio.");
      mime = m[1]!;
      body = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
    } else if (p["body"] !== undefined) body = JSON.stringify(p["body"]);
    const init: RequestInit = {
      method,
      headers: { authorization: `Bearer ${cfg.cloudKey}`, "content-type": mime },
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    };
    if (body !== undefined) init.body = body;
    const r = await fetch(url + caminho, init);
    return { status: r.status, data: await r.json() };
  }
  if (data.acao === "transcrever") {
    if (!cfg.openai) throw new Error("Configure uma chave OpenAI para gerar legendas automáticas.");
    const m = string(p["audio"]).match(/^data:audio\/mpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!m || m[1]!.length > 32 * 1024 * 1024)
      throw new Error("Áudio inválido ou maior que o limite.");
    const form = new FormData();
    form.append(
      "file",
      new Blob([Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0))], { type: "audio/mpeg" }),
      "audio.mp3",
    );
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    if (p["idioma"] !== "auto")
      form.append(
        "language",
        z
          .string()
          .regex(/^[a-z]{2}$/)
          .parse(p["idioma"]),
      );
    const r = await jsonFetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.openai}` },
      body: form,
    });
    const ws = z
      .array(z.object({ word: z.string(), start: z.number(), end: z.number() }))
      .parse(r["words"]);
    return { words: ws.map((w) => ({ w: w.word, s: w.start, e: w.end })) };
  }
  const ia = z
    .object({
      provedor: z.enum(["openai", "gemini", "claude", "nenhum"]),
      modelo: z.string().max(100).optional(),
    })
    .parse(p["ia"] ?? { provedor: "openai" });
  async function chamar(prompt: string) {
    let texto = "";
    if (ia.provedor === "gemini") {
      if (!cfg.gemini) throw new Error("Configure a chave Gemini nas conexões.");
      const model = ia.modelo || "gemini-2.5-flash";
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("Modelo inválido.");
      const r = await jsonFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": cfg.gemini },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      const parsed = z
        .object({
          candidates: z.array(
            z.object({ content: z.object({ parts: z.array(z.object({ text: z.string() })) }) }),
          ),
        })
        .parse(r);
      texto = parsed.candidates[0]?.content.parts.map((x) => x.text).join("") ?? "";
    } else if (ia.provedor === "claude") {
      if (!cfg.claude) throw new Error("Configure a chave Claude nas conexões.");
      const r = await jsonFetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.claude,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: ia.modelo || "claude-haiku-5-5",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      texto = z
        .object({ content: z.array(z.object({ text: z.string().optional() })) })
        .parse(r)
        .content.map((x) => x.text ?? "")
        .join("");
    } else {
      if (!cfg.openai) throw new Error("Configure a chave OpenAI nas conexões.");
      const r = await jsonFetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${cfg.openai}` },
        body: JSON.stringify({
          model: ia.modelo || "gpt-4.1-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Responda somente JSON válido, em português do Brasil." },
            { role: "user", content: prompt },
          ],
        }),
      });
      texto =
        z
          .object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })) })
          .parse(r).choices[0]?.message.content ?? "";
    }
    return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Record<string, unknown>;
  }
  if (data.acao === "testar-ia") {
    try {
      if (ia.provedor !== "nenhum") await chamar('Retorne JSON {"ok":true}.');
      return { ok: true, msg: "Serviço disponível." };
    } catch (e) {
      return { ok: false, msg: e instanceof Error ? e.message : "Falha na conexão." };
    }
  }
  if (data.acao === "frases") {
    const quantidade = z.coerce.number().int().min(1).max(50).parse(p["quantidade"]);
    const r = await chamar(
      `Crie ${quantidade} frases diferentes para vídeos curtos, em português do Brasil. Tema: ${string(p["tema"]).slice(0, 200)}. Estilo: ${string(p["estilo"])}. Público: ${string(p["publico"]).slice(0, 200)}. ${p["emoji"] ? "Até um emoji por frase." : "Sem emojis."} Use | para quebra de linha. ${p["legendaPost"] ? "Inclua legenda de post e hashtags." : ""} Não repita ${JSON.stringify(p["evitar"] ?? []).slice(0, 10000)}. JSON {"textos":[{"texto":"...","legenda":"..."}]}.`,
    );
    const textos = z
      .array(
        z.object({ texto: z.string().min(1).max(300), legenda: z.string().max(2200).default("") }),
      )
      .min(1)
      .parse(r["textos"]);
    return textos.slice(0, quantidade);
  }
  const words = z.array(palavra).min(1).max(200000).parse(p["words"]),
    duracao = z
      .number()
      .positive()
      .max(10.5 * 3600)
      .parse(p["duracao"]);
  const min = z.coerce.number().min(5).max(600).parse(p["min"]),
    max = z.coerce
      .number()
      .min(min + 5)
      .max(900)
      .parse(p["max"]),
    quantidade = z.coerce.number().int().min(1).max(100).parse(p["quantidade"]);
  const regras = candidatosPorRegras(words, min, max);
  let candidatos: Candidato[] = [];
  if (ia.provedor !== "nenhum") {
    // Janelas limitadas evitam mandar dez horas de transcrição num só pedido.
    for (let i = 0; i < words.length; i += 1500) {
      const trecho = words.slice(Math.max(0, i - 100), i + 1600);
      const r = await chamar(
        `Escolha momentos completos, com gancho e conclusão, de ${min} a ${max} segundos. Não invente fatos nem tempos. Instruções: ${string(p["instrucoes"]).slice(0, 500)}. JSON {"cortes":[{"s":0,"e":30,"nota":80,"titulo":"Título","gancho":"...","descricao":"..."}]}. Transcrição com tempos: ${JSON.stringify(trecho)}.`,
      );
      candidatos.push(...z.array(candidato).parse(r["cortes"]));
    }
  }
  candidatos = candidatos.concat(regras);
  const cortes = limitarCandidatos(candidatos, duracao, min, max, quantidade);
  if (!cortes.length)
    throw new Error("Não encontrei trechos completos com essa duração. Ajuste os limites.");
  const extras = limitarCandidatos(
    candidatos.filter((c) => !cortes.some((x) => c.s < x.e && c.e > x.s)),
    duracao,
    min,
    max,
    30,
  );
  return { cortes, extras };
}
