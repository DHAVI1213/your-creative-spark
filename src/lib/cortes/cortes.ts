/**
 * Cortes Virais — porte do cortes.js do desktop: acha os melhores momentos de um vídeo longo
 * (IA ou regras sem IA) e corta cada um num MP4 separado, com o tempo de cada palavra para a legenda animada.
 */
import type { Word } from "../editor/model";
import { chamarIA, extrairJSON, type IaConfig } from "../ia/ia";
import { mmss, type Montado } from "./transcricao";

export const TIPOS: Record<string, [string, string]> = {
  auto: ["Descobrir sozinho", "Descubra sozinho o tipo de conteúdo."],
  podcast: ["Podcast / conversa", "Podcast/conversa: procure opiniões fortes, histórias pessoais, revelações, momentos engraçados e debates."],
  motivacao: ["Motivacional", "Vídeo motivacional: procure frases de impacto, superação, disciplina, mentalidade e chamadas para ação."],
  palestra: ["Palestra / pregação", "Palestra/pregação: procure ensinamentos claros, insights, histórias que ilustram e frases memoráveis."],
  entrevista: ["Entrevista", "Entrevista: procure respostas marcantes, revelações e opiniões polêmicas do entrevistado."],
  aula: ["Aula / curso", 'Aula/curso: procure dicas práticas, explicações rápidas que resolvem um problema e "você está fazendo errado".'],
  humor: ["Humor", "Humor: procure piadas completas com preparação e punchline, reações e momentos absurdos."],
};

export type Frase = { id: number; s: number; e: number; w0: number; w1: number; texto: string };
export type Emoji = { palavra: string; emoji: string };
export type Corte = {
  a: number;
  b: number;
  s: number;
  e: number;
  nota: number;
  titulo: string;
  gancho: string;
  descricao: string;
  emojis: Emoji[];
  origem: "ia" | "regras";
  sA?: number;
  eB?: number;
  n?: number;
};
export type Opcoes = { quantidade: number; min: number; max: number; tipo: string; instrucoes: string; ia: IaConfig };
type ProgIa = (etapa: "ia", pct: number, msg: string) => void;

const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------- frases
export function frases(words: Word[]): Frase[] {
  const out: Frase[] = [];
  let ini = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const nx = words[i + 1];
    const fim = !nx || /[.!?…]["”]?$/.test(w.w) || nx.s - w.e > 1.0 || i - ini >= 34;
    if (fim) {
      const ws = words.slice(ini, i + 1);
      out.push({ id: out.length, s: ws[0]!.s, e: ws[ws.length - 1]!.e, w0: ini, w1: i, texto: ws.map((x) => x.w).join(" ") });
      ini = i + 1;
    }
  }
  return out;
}

/** Ajusta um trecho (frase a até frase b) para caber entre min e max segundos. */
export function ajustar(F: Frase[], words: Word[], a: number, b: number, min: number, max: number) {
  a = Math.max(0, Math.min(a, F.length - 1));
  b = Math.max(a, Math.min(b, F.length - 1));
  while (b > a && F[b]!.e - F[a]!.s > max) b--;
  while (F[b]!.e - F[a]!.s < min && b + 1 < F.length && F[b + 1]!.e - F[a]!.s <= max && F[b + 1]!.s - F[b]!.e < 2.5) b++;
  const s = F[a]!.s;
  let e = F[b]!.e;
  if (e - s > max) {
    // uma frase só já passa do máximo: corta na última palavra que cabe (de preferência numa vírgula)
    let ultima: Word | null = null;
    let virgula: Word | null = null;
    for (let i = F[a]!.w0; i <= F[b]!.w1 && words[i]!.e - s <= max; i++) {
      ultima = words[i]!;
      if (/[,;:]$/.test(words[i]!.w)) virgula = words[i]!;
    }
    if (virgula && virgula.e - s >= max * 0.7) e = virgula.e;
    else if (ultima) e = ultima.e;
  }
  if (e - s < Math.min(min * 0.6, max)) return null;
  const prox = F[b + 1];
  const cauda = prox ? Math.max(0, Math.min(0.4, prox.s - e - 0.03)) : 0.4;
  return { a, b, s: Math.max(0, s - 0.12), e: e + cauda };
}

// ---------------------------------------------------------- sem IA: regras de "potencial viral"
const GANCHOS =
  /\b(segredo|verdade|ninguem|nunca|sempre|a maioria|o problema|o maior|o pior|o melhor|voce precisa|voce nao|para de|pare de|o que ninguem|eu descobri|a real|presta atencao|escuta|olha so|imagina|sabe por que|por que|como eu|eu perdi|eu ganhei|milhoes|milhao|morri|morreu|erro|mentira|absurdo|incrivel|deus|dinheiro|rico|pobre|fracasso|sucesso)\b/;
const FRACOS = /^(entao|e ai|tipo|ne|bom|beleza|enfim|e |mas |ai |e entao|ok|certo|uhum|hum|ah|eh)\b/;

function notaRegra(F: Frase[], words: Word[], energia: number[], c: { a: number; b: number; s: number; e: number }, mediana: number) {
  const ws = words.slice(F[c.a]!.w0, F[c.b]!.w1 + 1);
  const primeira = semAcento(F[c.a]!.texto);
  const tudo = semAcento(ws.map((w) => w.w).join(" "));
  let n = 40;
  if (GANCHOS.test(primeira)) n += 18;
  if (/\?/.test(F[c.a]!.texto)) n += 8;
  if (FRACOS.test(primeira)) n -= 14;
  const fortes = (tudo.match(new RegExp(GANCHOS.source, "g")) || []).length;
  n += Math.min(16, fortes * 3);
  if (/\d/.test(tudo)) n += 4;
  if (/!/.test(ws.map((w) => w.w).join(" "))) n += 4;
  const dur = c.e - c.s;
  const ritmo = ws.length / Math.max(1, dur);
  if (ritmo >= 2.2 && ritmo <= 4.2) n += 8;
  else if (ritmo < 1.5) n -= 10;
  if (energia.length) {
    const seg = energia.slice(Math.floor(c.s), Math.ceil(c.e));
    if (seg.length) {
      const media = seg.reduce((a, b) => a + b, 0) / seg.length;
      const desvio = Math.sqrt(seg.reduce((a, b) => a + (b - media) ** 2, 0) / seg.length);
      n += Math.max(-10, Math.min(12, (media - mediana) * 1.5));
      n += Math.min(6, desvio);
    }
  }
  return Math.max(5, Math.min(95, Math.round(n)));
}

export function candidatosRegra(F: Frase[], words: Word[], energia: number[], min: number, max: number): Corte[] {
  const ord = energia.slice().sort((a, b) => a - b);
  const mediana = ord.length ? ord[Math.floor(ord.length / 2)]! : 0;
  const out: Corte[] = [];
  for (let a = 0; a < F.length; a++) {
    let b = a;
    while (b + 1 < F.length && F[b + 1]!.e - F[a]!.s <= (min + max) / 2) b++;
    const c = ajustar(F, words, a, b, min, max);
    if (!c) continue;
    const nota = notaRegra(F, words, energia, c, mediana);
    const titulo = F[c.a]!.texto.split(/\s+/).slice(0, 8).join(" ").replace(/[,.;:]+$/, "");
    out.push({ ...c, nota, titulo, gancho: "Escolhido pelas regras (sem IA)", descricao: "", emojis: [], origem: "regras" });
  }
  return out;
}

// ---------------------------------------------------------- IA
export const SISTEMA = `Você é um editor profissional de cortes virais para Reels, TikTok e YouTube Shorts, especialista em podcasts, vídeos motivacionais e palestras.
Seu trabalho é ler a transcrição e escolher os trechos com mais chance de viralizar quando postados sozinhos.
Responda SEMPRE e SOMENTE com JSON válido, sem texto antes ou depois.`;

export function promptJanela(F: Frase[], i0: number, i1: number, k: number, opts: Pick<Opcoes, "tipo" | "instrucoes" | "min" | "max">) {
  const linhas: string[] = [];
  for (let i = i0; i <= i1; i++) linhas.push(`#${F[i]!.id} [${mmss(F[i]!.s)}] ${F[i]!.texto.slice(0, 400)}`);
  return `Tipo de conteúdo: ${(TIPOS[opts.tipo] || TIPOS.auto!)[1]}
${opts.instrucoes ? "Pedido do editor: " + opts.instrucoes + "\n" : ""}
Abaixo está um trecho da transcrição (de ${mmss(F[i0]!.s)} até ${mmss(F[i1]!.e)} do vídeo). Cada linha é uma frase no formato: #ID [minuto:segundo] texto.

Encontre até ${k} momentos que dariam os MELHORES cortes virais.
Regras:
- Cada corte deve ter entre ${opts.min} e ${opts.max} segundos. Use os tempos [minuto:segundo] para calcular.
- O corte deve começar numa frase que prenda nos primeiros 3 segundos: afirmação forte ou polêmica, pergunta, número, começo de história ou revelação. Não comece com "então", "e aí", cumprimentos ou contexto morno.
- O corte precisa fazer sentido sozinho, sem o resto do vídeo, e terminar fechando a ideia (conclusão, punchline ou frase de impacto). Não termine no meio de um raciocínio.
- Prefira: frases de impacto, conselhos práticos, histórias pessoais, momentos engraçados, emoção forte, opiniões polêmicas, dados surpreendentes.
- Evite: propaganda/patrocínio, cumprimentos, avisos, partes confusas ou que dependem de imagem.
- Os cortes não podem se sobrepor.
- Dê uma nota de 0 a 100 de potencial viral. Seja exigente: 90 ou mais só para algo realmente forte.
- Escreva título e descrição no mesmo idioma da transcrição.

Formato da resposta:
{"cortes":[{"inicio":ID_da_primeira_frase,"fim":ID_da_ultima_frase,"nota":85,"titulo":"título curto e chamativo para escrever na tela (até 8 palavras)","gancho":"em uma frase, por que esse trecho prende","descricao":"legenda para o post, com 3 a 5 hashtags no final","emojis":[{"palavra":"palavra que aparece no trecho","emoji":"🔥"}]}]}
Use de 2 a 5 emojis por corte, ligados a palavras importantes que são ditas no trecho.
Se nada neste trecho for bom, responda {"cortes":[]}.

TRANSCRIÇÃO:
${linhas.join("\n")}`;
}

type Janela = { F: Frase[]; words: Word[]; i0: number; i1: number; n: number };

/**
 * Agenda da IA: analisa cada trecho de ~25 min (15 no Ollama) assim que a transcrição dele fica pronta
 * (não espera o vídeo inteiro) e manda 2–3 trechos ao mesmo tempo para a IA.
 */
export function criarAgendaIA(opts: Opcoes, duracao: number, sinal: AbortSignal) {
  const ollama = opts.ia.provedor === "ollama";
  const janelaSeg = ollama ? 900 : 1500;
  const passo = janelaSeg - 60; // volta ~1 min para não perder momentos na emenda
  const nJanelas = Math.max(1, Math.ceil(Math.max(1, duracao - 60) / passo));
  const k = Math.max(2, Math.min(10, Math.ceil((opts.quantidade * 2.5) / nJanelas)));
  const limite = ollama ? 15 * 60e3 : 4 * 60e3;
  const paralelo = ollama ? 2 : 3;
  const out: Corte[] = [];
  const fila: Janela[] = [];
  let enviadas = 0;
  let feitas = 0;
  let falhas = 0;
  let rodando = 0;
  let ultimoErro = "";
  let erroFatal: Error | null = null;
  let fim = false;
  let words: Word[] = [];
  const dormindo: (() => void)[] = [];
  const esperar = () => Promise.race([new Promise<void>((r) => dormindo.push(r)), pausa(1000)]);
  const cutucar = () => {
    while (dormindo.length) dormindo.shift()!();
  };

  async function analisar(jan: Janela) {
    const { F: Fj, words: Wj, i0, i1, n } = jan;
    let resp: { cortes?: unknown[]; clips?: unknown[] } | null = null;
    for (let tentativa = 0; tentativa < 2 && !resp; tentativa++) {
      try {
        resp = extrairJSON(await chamarIA(opts.ia, SISTEMA, promptJanela(Fj, i0, i1, k, opts), limite, sinal));
      } catch (err) {
        if (sinal.aborted) throw err;
        ultimoErro = err instanceof Error ? err.message : String(err);
        if (/chave|key|401|403|permission|Ollama|not found|não encontrado/i.test(ultimoErro) && n === 0) throw err;
        await pausa(1500);
      }
    }
    if (!resp) {
      falhas++;
      return;
    }
    for (const bruto of (resp.cortes || resp.clips || []).slice(0, k + 2)) {
      const c = (bruto || {}) as Record<string, unknown>;
      const a = parseInt(String(c.inicio), 10);
      const b = parseInt(String(c.fim), 10);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < i0 - 2 || b > i1 + 2 || !Fj[Math.min(a, b)] || !Fj[Math.max(a, b)]) continue;
      const aj = ajustar(Fj, Wj, Math.min(a, b), Math.max(a, b), opts.min, opts.max);
      if (!aj) continue;
      out.push({
        ...aj,
        sA: Fj[aj.a]!.s,
        eB: Fj[aj.b]!.e,
        nota: Math.max(0, Math.min(100, Number(c.nota) || 50)),
        titulo: String(c.titulo || "").trim().slice(0, 90) || Fj[aj.a]!.texto.split(/\s+/).slice(0, 8).join(" "),
        gancho: String(c.gancho || "").trim().slice(0, 200),
        descricao: String(c.descricao || "").trim().slice(0, 2200),
        emojis: Array.isArray(c.emojis) ? (c.emojis as Emoji[]).filter((e) => e && e.palavra && e.emoji).slice(0, 6) : [],
        origem: "ia",
      });
    }
  }

  const trabalhadores = Array.from({ length: paralelo }, async () => {
    for (;;) {
      if (erroFatal || sinal.aborted) return;
      const jan = fila.shift();
      if (!jan) {
        if (fim) return;
        await esperar();
        continue;
      }
      rodando++;
      try {
        await analisar(jan);
      } catch (err) {
        erroFatal = err instanceof Error ? err : new Error(String(err));
      } finally {
        rodando--;
        feitas++;
        cutucar();
      }
    }
  });

  /** Monta os trechos que já estão totalmente transcritos. */
  function alimentar(novasWords: Word[], ateSeg: number, final: boolean) {
    words = novasWords;
    const F = frases(words);
    for (;;) {
      const tIni = enviadas * passo;
      if (enviadas > 0 && tIni >= (final ? duracao : ateSeg) - 30) break;
      const tFim = tIni + janelaSeg;
      const ultima = tFim >= duracao - 30;
      if (!final && ateSeg < Math.min(tFim, duracao) + 30) break;
      const i0 = F.findIndex((x) => x.s >= tIni);
      let i1 = -1;
      for (let i = F.length - 1; i >= 0; i--)
        if (ultima || F[i]!.s < tFim) {
          i1 = i;
          break;
        }
      if (i0 >= 0 && i1 >= i0) fila.push({ F, words, i0, i1, n: enviadas });
      enviadas++;
      if (ultima) break;
    }
    if (final) fim = true;
    cutucar();
  }

  async function terminar(prog: ProgIa): Promise<Corte[]> {
    fim = true;
    const total = () => Math.max(enviadas, 1);
    for (;;) {
      if (erroFatal) throw erroFatal;
      if (sinal.aborted) throw new Error("Cancelado");
      if (!fila.length && rodando === 0) break;
      prog("ia", feitas / total(), `IA analisando os trechos (${feitas} de ${total()} prontos, ${Math.min(paralelo, rodando + fila.length)} ao mesmo tempo) · ${out.length} momentos achados`);
      cutucar();
      await pausa(400);
    }
    await Promise.all(trabalhadores);
    if (erroFatal) throw erroFatal;
    // refaz o ajuste com as frases finais (as frases do fim de cada trecho podem ter crescido)
    const Ff = frases(words);
    const finais: Corte[] = [];
    for (const c of out) {
      const a = Ff.findIndex((x) => Math.abs(x.s - (c.sA ?? c.s)) < 0.02);
      let b = -1;
      for (let i = Ff.length - 1; i >= 0; i--)
        if (Ff[i]!.e <= (c.eB ?? c.e) + 0.02) {
          b = i;
          break;
        }
      const aj = a >= 0 && b >= a ? ajustar(Ff, words, a, b, opts.min, opts.max) : { a: c.a, b: c.b, s: c.s, e: c.e };
      if (aj) finais.push({ ...c, ...aj });
    }
    prog("ia", 1, `IA terminou · ${finais.length} momentos encontrados`);
    if (!finais.length && falhas) throw new Error("A IA não respondeu direito: " + ultimoErro);
    return finais;
  }

  return { alimentar, terminar, status: () => ({ feitas, enviadas, achados: out.length }) };
}

export function escolher(cands: Corte[], n: number) {
  const ord = cands.slice().sort((x, y) => y.nota - x.nota || x.s - y.s);
  const esc: Corte[] = [];
  for (const c of ord) {
    if (esc.length >= n) break;
    if (esc.some((x) => c.s < x.e - 0.5 && c.e > x.s + 0.5)) continue;
    esc.push(c);
  }
  return esc;
}

/** Junta a escolha da IA com as regras quando a IA achou menos que o pedido, e separa os extras. */
export function montarResultado(cands: Corte[], regras: Corte[], quantidade: number) {
  const usouRegras = !cands.length;
  const base = usouRegras ? regras : cands;
  const escolhidos = escolher(base, quantidade);
  if (escolhidos.length < quantidade && !usouRegras) {
    for (const r of regras.slice().sort((x, y) => y.nota - x.nota)) {
      if (escolhidos.length >= quantidade) break;
      if (escolhidos.some((x) => r.s < x.e - 0.5 && r.e > x.s + 0.5)) continue;
      escolhidos.push({ ...r, nota: Math.min(r.nota, 60) });
    }
  }
  escolhidos.forEach((c, i) => (c.n = i + 1));
  const resto = (usouRegras ? regras : cands.concat(regras.map((r) => ({ ...r, nota: Math.min(r.nota, 60) })))).filter(
    (c) => !escolhidos.some((x) => c.s < x.e - 0.5 && c.e > x.s + 0.5),
  );
  return { escolhidos, extras: escolher(resto, 30) };
}

/** Palavras do trecho com o tempo relativo ao arquivo cortado. */
export function palavrasDoCorte(words: Word[], c: { s: number; e: number }): Word[] {
  return words
    .filter((w) => w.s >= c.s - 0.05 && w.s < c.e - 0.05)
    .map((w) => ({ w: w.w, s: +(w.s - c.s).toFixed(3), e: +(Math.min(w.e, c.e) - c.s).toFixed(3) }));
}
export const textoDe = (words: Word[], c: { s: number; e: number }) =>
  words
    .filter((w) => w.s >= c.s && w.s < c.e)
    .map((w) => w.w)
    .join(" ");

export const nomeSeguro = (s: string, p = "corte") =>
  String(s || "")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 60) || p;

/** Corta um momento num MP4 (mesma resolução do original; o Editor ajusta o formato depois). */
export async function cortar(m: Montado, c: { s: number; e: number }, aoProgresso: (p: number) => void, sinal: AbortSignal): Promise<Blob> {
  const dur = c.e - c.s;
  const saida = `corte_${crypto.randomUUID().slice(0, 8)}.mp4`;
  const ouvir = ({ time }: { time: number }) => aoProgresso(Math.max(0, Math.min(1, time / 1e6 / dur)));
  const parar = () => void import("../editor/engine").then((e) => e.cancelEngine());
  sinal.addEventListener("abort", parar, { once: true });
  m.f.on("progress", ouvir);
  const threads = (await import("../editor/engine")).engineThreads();
  try {
    const code = await m.f.exec([
      "-y", "-hide_banner", "-ss", c.s.toFixed(3), "-i", m.caminho, "-t", dur.toFixed(3),
      "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "ultrafast", "-threads", String(threads), "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-map_metadata", "-1", "-movflags", "+faststart", saida,
    ]);
    if (sinal.aborted) throw new Error("Cancelado");
    if (code !== 0) throw new Error("Falha ao cortar o trecho.");
    const data = await m.f.readFile(saida);
    return new Blob([data as BlobPart], { type: "video/mp4" });
  } finally {
    sinal.removeEventListener("abort", parar);
    m.f.off("progress", ouvir);
    await m.f.deleteFile(saida).catch(() => undefined);
  }
}
