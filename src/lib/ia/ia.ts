/**
 * Motores de IA usados pelos Cortes Virais e pelas Frases com IA — porte do chamarIA do desktop.
 * As chamadas saem direto do navegador do cliente com a chave dele (nada passa pelo nosso servidor).
 * A configuração fica guardada só neste navegador.
 */
export type Provedor = "gemini" | "openai" | "claude" | "ollama" | "nenhum";
export type IaConfig = { provedor: Provedor; url: string; chave: string; modelo: string };
export type MotorTranscricao = "navegador-turbo" | "navegador-small" | "groq" | "openai";
export type TranscricaoConfig = { motor: MotorTranscricao; chave: string; idioma: string };

export const IA_PADRAO: Record<Exclude<Provedor, "nenhum">, string> = {
  ollama: "qwen2.5:14b",
  gemini: "gemini-2.5-flash",
  openai: "gpt-4.1-mini",
  claude: "claude-haiku-5-5",
};
export const URL_PADRAO: Partial<Record<Provedor, string>> = {
  ollama: "http://127.0.0.1:11434",
  openai: "https://api.openai.com/v1",
};
export const NOMES: Record<Provedor, string> = {
  gemini: "Gemini",
  openai: "OpenAI / compatível",
  claude: "Claude",
  ollama: "Ollama (no seu PC)",
  nenhum: "Sem IA",
};
export const DICAS: Record<Provedor, string> = {
  gemini: "Rápido e com cota grátis. Crie a chave em aistudio.google.com → “Get API key” e cole aqui.",
  openai: "OpenAI ou qualquer serviço compatível (Groq, OpenRouter, LM Studio): troque o endereço e o modelo. Groq: https://api.groq.com/openai/v1 e modelo llama-3.3-70b-versatile.",
  claude: "Chave da API da Anthropic (console.anthropic.com).",
  ollama:
    "Roda no seu PC: grátis e sem limite. Instale em ollama.com, baixe um modelo (ex.: qwen2.5:14b) e libere o site: feche o Ollama e abra de novo com a variável OLLAMA_ORIGINS=* (no Windows: setx OLLAMA_ORIGINS * e reinicie o Ollama).",
  nenhum: "Sem IA: escolhe pelos ganchos na fala, ritmo e volume. Serve para testar; com IA os cortes ficam bem melhores.",
};

const CHAVE = "nk.ia";
type Guardado = { provedor: Provedor; por: Partial<Record<Provedor, Omit<IaConfig, "provedor">>>; transcricao: TranscricaoConfig };
const PADRAO_GUARDADO: Guardado = { provedor: "gemini", por: {}, transcricao: { motor: "navegador-small", chave: "", idioma: "pt" } };

function ler(): Guardado {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (g && typeof g === "object") return { ...PADRAO_GUARDADO, ...g, transcricao: { ...PADRAO_GUARDADO.transcricao, ...(g.transcricao || {}) } };
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return structuredClone(PADRAO_GUARDADO);
}
function gravar(g: Guardado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(g));
  } catch {
    /* modo privado: fica só nesta aba */
  }
}

export function iaSalva(provedor?: Provedor): IaConfig {
  const g = ler();
  const p = provedor ?? g.provedor;
  const c = g.por[p] || { url: "", chave: "", modelo: "" };
  return { provedor: p, url: c.url || "", chave: c.chave || "", modelo: c.modelo || "" };
}
export function salvarIa(ia: IaConfig) {
  const g = ler();
  g.provedor = ia.provedor;
  g.por[ia.provedor] = { url: ia.url.trim(), chave: ia.chave.trim(), modelo: ia.modelo.trim() };
  gravar(g);
}
export function transcricaoSalva(): TranscricaoConfig {
  return ler().transcricao;
}
export function salvarTranscricao(t: TranscricaoConfig) {
  const g = ler();
  g.transcricao = { ...t, chave: t.chave.trim() };
  gravar(g);
}

/** Preenche endereço e modelo padrão quando o cliente deixou em branco. */
export function completar(ia: IaConfig): IaConfig {
  return {
    ...ia,
    url: ia.url.trim() || URL_PADRAO[ia.provedor] || "",
    modelo: ia.modelo.trim() || (ia.provedor !== "nenhum" ? IA_PADRAO[ia.provedor] : ""),
  };
}

export function extrairJSON<T = unknown>(txt: string): T {
  let t = String(txt || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t) as T;
}

export async function chamarIA(iaBruta: IaConfig, sistema: string, usuario: string, limiteMs: number, sinal?: AbortSignal): Promise<string> {
  const ia = completar(iaBruta);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), limiteMs);
  const repassar = () => ctrl.abort();
  sinal?.addEventListener("abort", repassar);
  try {
    let r: Response;
    let j: Record<string, unknown> & { error?: { message?: string } | string };
    if (ia.provedor === "ollama") {
      r = await fetch(ia.url.replace(/\/+$/, "") + "/api/chat", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: ia.modelo,
          stream: false,
          format: "json",
          think: false,
          options: { temperature: 0.4, num_ctx: 16384 },
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: usuario },
          ],
        }),
      });
      j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(String(j.error || `Ollama respondeu ${r.status}`));
      return String((j.message as { content?: string })?.content || "");
    }
    if (ia.provedor === "gemini") {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ia.modelo)}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": ia.chave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      });
      j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((typeof j.error === "object" && j.error?.message) || `Gemini respondeu ${r.status}`);
      const c = (j.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0];
      return (c?.content?.parts || []).map((p) => p.text || "").join("");
    }
    if (ia.provedor === "openai") {
      r = await fetch(ia.url.replace(/\/+$/, "") + "/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: "Bearer " + ia.chave },
        body: JSON.stringify({
          model: ia.modelo,
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: usuario },
          ],
        }),
      });
      j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((typeof j.error === "object" && j.error?.message) || `A API respondeu ${r.status}`);
      return String((j.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content || "");
    }
    if (ia.provedor === "claude") {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": ia.chave,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: ia.modelo, max_tokens: 4096, temperature: 0.4, system: sistema, messages: [{ role: "user", content: usuario }] }),
      });
      j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((typeof j.error === "object" && j.error?.message) || `Claude respondeu ${r.status}`);
      return ((j.content as { type: string; text?: string }[]) || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("");
    }
    throw new Error("Escolha um motor de IA");
  } catch (err) {
    if (sinal?.aborted) throw new Error("Cancelado");
    if (err instanceof Error && err.name === "AbortError") throw new Error("A IA demorou demais para responder");
    if (ia.provedor === "ollama" && err instanceof TypeError)
      throw new Error("Não consegui falar com o Ollama. Deixe ele aberto e libere o site com OLLAMA_ORIGINS=* (veja a dica).");
    throw err;
  } finally {
    clearTimeout(timer);
    sinal?.removeEventListener("abort", repassar);
  }
}

/** Testa a IA escolhida (e lista os modelos do Ollama). */
export async function testarIA(iaBruta: IaConfig): Promise<{ ok: boolean; msg: string; modelos?: string[] }> {
  const ia = completar(iaBruta);
  try {
    if (ia.provedor === "nenhum") return { ok: true, msg: "Sem IA: os cortes saem pelas regras (gancho, ritmo e volume)." };
    if (ia.provedor === "ollama") {
      const r = await fetch(ia.url.replace(/\/+$/, "") + "/api/tags").catch(() => null);
      if (!r || !r.ok) return { ok: false, msg: "O Ollama não respondeu. Deixe ele aberto e libere o site com OLLAMA_ORIGINS=*." };
      const j = (await r.json()) as { models?: { name: string }[] };
      const modelos = (j.models || []).map((m) => m.name);
      if (!modelos.length) return { ok: false, modelos, msg: "O Ollama está aberto mas sem modelos. No terminal: ollama pull qwen2.5:14b" };
      if (!modelos.includes(ia.modelo) && !modelos.includes(ia.modelo + ":latest"))
        return { ok: false, modelos, msg: `O modelo ${ia.modelo} não está instalado. Escolha um da lista.` };
      return { ok: true, modelos, msg: `Ollama ok · ${modelos.length} modelo(s)` };
    }
    if (!ia.chave) return { ok: false, msg: "Cole a chave da API" };
    extrairJSON(await chamarIA(ia, "Responda só JSON.", 'Responda {"ok":true}', 60e3));
    return { ok: true, msg: "Conectado!" };
  } catch (err) {
    return { ok: false, msg: err instanceof Error ? err.message : String(err) };
  }
}

// ------------------------------------------------------------ Frases com IA (vídeos sem texto)
export const ESTILOS_FRASE: Record<string, [string, string]> = {
  curta: ["Frase curta e forte", "frase curta e impactante, de 6 a 14 palavras, que funcione sozinha na tela"],
  reflexao: ["Reflexão (2–3 frases)", "reflexão de 2 ou 3 frases curtas (até 35 palavras no total), que faça a pessoa parar e pensar"],
  pergunta: ["Pergunta + resposta", "pergunta provocativa seguida de uma resposta curta e forte (até 25 palavras)"],
  lista: ["Lista em 3 linhas", 'mini lista em 3 linhas curtas (ex.: "Acorde cedo. | Treine. | Não desista."), separadas por " | "'],
};
export const TEMAS_RAPIDOS = ["Disciplina", "Foco", "Superação", "Fé em Deus", "Dinheiro e sucesso", "Estudos", "Treino e academia", "Amor-próprio", "Família", "Mentalidade", "Empreender", "Recomeço"];

const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type PedidoFrases = { ia: IaConfig; tema: string; estilo: string; publico: string; emoji: boolean; legendaPost: boolean; quantidade: number; evitar: string[] };
export async function gerarFrases(o: PedidoFrases): Promise<{ texto: string; legenda: string }[]> {
  if (!o.ia.provedor || o.ia.provedor === "nenhum") throw new Error("Escolha uma IA em Cortes Virais → Inteligência (Gemini, OpenAI, Claude ou Ollama).");
  const n = Math.max(1, Math.min(200, Math.round(o.quantidade) || 1));
  const estilo = (ESTILOS_FRASE[o.estilo] || ESTILOS_FRASE.curta!)[1];
  const usadas = new Set((o.evitar || []).map(semAcento));
  const out: { texto: string; legenda: string }[] = [];
  let tentativas = 0;
  while (out.length < n && tentativas < Math.ceil(n / 20) + 3) {
    tentativas++;
    const pedir = Math.min(25, n - out.length + 2);
    const evitar = [...(o.evitar || []), ...out.map((x) => x.texto)].slice(-60);
    const usuario = `Crie ${pedir} textos ORIGINAIS para colocar escritos em vídeos curtos (Reels/TikTok/Shorts) sobre o tema: "${String(o.tema || "motivação").slice(0, 200)}".
Tipo de texto: ${estilo}.
${o.publico ? "Público: " + String(o.publico).slice(0, 200) + "\n" : ""}Regras:
- Escreva em português do Brasil, com linguagem simples e direta, que gere identificação e vontade de compartilhar.
- Cada texto precisa ser diferente dos outros (ideia diferente, não só trocar palavras).
- Não invente autor, não use aspas e não cite pessoas famosas.
- ${o.emoji ? "Pode terminar com no máximo 1 emoji que combine." : "Não use emojis."}
- Use " | " só onde quiser quebrar a linha na tela.
${o.legendaPost ? '- Para cada texto, escreva também "legenda": uma legenda para o post (1 ou 2 frases chamando para comentar ou salvar) terminando com 4 a 6 hashtags do tema.\n' : ""}${evitar.length ? "Não repita nem parafraseie estes, que já foram usados:\n" + evitar.map((x) => "- " + x).join("\n") + "\n" : ""}
Responda só JSON: {"textos":[{"texto":"..."${o.legendaPost ? ',"legenda":"..."' : ""}}]}`;
    let resp: { textos?: unknown[]; frases?: unknown[] };
    try {
      resp = extrairJSON(
        await chamarIA(
          o.ia,
          "Você é um copywriter brasileiro especialista em conteúdo motivacional viral para redes sociais. Responda SEMPRE e SOMENTE com JSON válido.",
          usuario,
          o.ia.provedor === "ollama" ? 5 * 60e3 : 2 * 60e3,
        ),
      );
    } catch (err) {
      if (!out.length && tentativas >= 2) throw err;
      continue;
    }
    for (const t of resp.textos || resp.frases || []) {
      const obj = (t && typeof t === "object" ? t : {}) as { texto?: string; frase?: string; legenda?: string };
      const texto = String(obj.texto || obj.frase || (typeof t === "string" ? t : "")).replace(/^["“”']+|["“”']+$/g, "").trim();
      if (!texto || texto.length > 300) continue;
      const k = semAcento(texto);
      if (usadas.has(k)) continue;
      usadas.add(k);
      out.push({ texto, legenda: o.legendaPost ? String(obj.legenda || "").trim().slice(0, 2200) : "" });
      if (out.length >= n) break;
    }
  }
  if (!out.length) throw new Error("A IA não devolveu frases. Tente de novo ou troque o modelo.");
  return out;
}
