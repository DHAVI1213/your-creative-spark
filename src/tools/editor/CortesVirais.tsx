import { useEffect, useRef, useState } from "react";
import { Download, Flame, Loader2, Scissors, Send, Square, Upload } from "lucide-react";
import { zipSync } from "fflate";
import { Badge, Button, Card, Input, Select, Textarea } from "../../components/ui";
import { baixarBlob, cn } from "../../lib/utils";
import {
  DICAS,
  NOMES,
  completar,
  iaSalva,
  salvarIa,
  salvarTranscricao,
  testarIA,
  transcricaoSalva,
  type IaConfig,
  type Provedor,
  type TranscricaoConfig,
} from "../../lib/ia/ia";
import { NOMES_MOTOR, jaTranscrito, mmss, montar, sondar, transcrever, type Info, type Montado } from "../../lib/cortes/transcricao";
import {
  TIPOS,
  candidatosRegra,
  criarAgendaIA,
  cortar,
  frases,
  montarResultado,
  nomeSeguro,
  palavrasDoCorte,
  textoDe,
  type Corte,
} from "../../lib/cortes/cortes";
import { gerarEmojis } from "../../lib/editor/legendas";
import type { CorteMesa, FormatoCorte, OpcoesMesa } from "../../lib/cortes/mesa";
import type { Word } from "../../lib/editor/model";
import ReceberPonte from "../../components/ReceberPonte";

const ETAPAS = [
  ["preparar", "Preparar"],
  ["audio", "Áudio"],
  ["transcrever", "Transcrever"],
  ["ia", "Achar momentos"],
  ["cortar", "Cortar"],
] as const;
type Etapa = (typeof ETAPAS)[number][0];
const PESOS: Record<Etapa, [number, number]> = { preparar: [0, 0.04], audio: [0.04, 0.1], transcrever: [0.1, 0.68], ia: [0.68, 0.88], cortar: [0.88, 1] };
const CHAVE = "nk.cortes";
const QTDS = [5, 10, 20, 30, 50];
const DURS: [number, number, string][] = [
  [15, 30, "15–30s"],
  [30, 60, "30–60s"],
  [45, 90, "45–90s"],
  [60, 180, "1–3 min"],
];

type Pronto = Corte & { blob: Blob; url: string; words: Word[]; naMesa: boolean };
type Extra = Corte & { texto: string };
type Prefs = { qtd: number; min: number; max: number; tipo: string; instr: string; formato: FormatoCorte; legenda: boolean; emojis: boolean; titulo: boolean; mesa: boolean };
const PREFS: Prefs = { qtd: 10, min: 30, max: 60, tipo: "auto", instr: "", formato: "cheio", legenda: true, emojis: true, titulo: true, mesa: true };

function lerPrefs(): Prefs {
  try {
    return { ...PREFS, ...(JSON.parse(localStorage.getItem(CHAVE) || "{}") as Partial<Prefs>) };
  } catch {
    return { ...PREFS };
  }
}

export default function CortesVirais({ onMesa, recebido }: { onMesa: (itens: CorteMesa[], opts: OpcoesMesa) => Promise<void>; recebido?: File | null }) {
  const [prefs, setPrefs] = useState<Prefs>(lerPrefs);
  const [ia, setIa] = useState<IaConfig>(() => iaSalva());
  const [trans, setTrans] = useState<TranscricaoConfig>(() => transcricaoSalva());
  const [iaStatus, setIaStatus] = useState<{ msg: string; ok?: boolean }>({ msg: "" });
  const [modelos, setModelos] = useState<string[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [info, setInfo] = useState<(Info & { transcrito: boolean }) | null>(null);
  const [lendo, setLendo] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [prog, setProg] = useState<{ etapa: Etapa; geral: number; msg: string }>({ etapa: "preparar", geral: 0, msg: "" });
  const [prontos, setProntos] = useState<Pronto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extrasSel, setExtrasSel] = useState<number[]>([]);
  const [aviso, setAviso] = useState("");
  const parar = useRef<AbortController | null>(null);
  const analise = useRef<{ words: Word[]; n: number } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(prefs));
    } catch {
      /* sem armazenamento */
    }
  }, [prefs]);
  useEffect(() => salvarIa(ia), [ia]);
  useEffect(() => salvarTranscricao(trans), [trans]);
  useEffect(() => () => prontos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (recebido) void escolher(recebido);
  }, [recebido]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((x) => ({ ...x, [k]: v }));
  const progresso = (etapa: Etapa, pct: number, msg: string) => {
    const [a, b] = PESOS[etapa];
    const c = Math.max(0, Math.min(1, pct));
    setProg({ etapa, geral: a + (b - a) * c, msg });
  };

  async function escolher(file: File) {
    if (rodando) {
      setAviso("Espere terminar ou cancele antes de trocar o vídeo.");
      return;
    }
    setArquivo(file);
    setInfo(null);
    setLendo(true);
    setAviso("");
    let m: Montado | null = null;
    try {
      m = await montar(file);
      const i = await sondar(m);
      setInfo({ ...i, transcrito: await jaTranscrito(file, trans, i.duracao) });
    } catch (e) {
      setAviso("Não consegui ler este vídeo: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      await m?.soltar();
      setLendo(false);
    }
  }

  const trocarProvedor = (prov: Provedor) => {
    salvarIa(ia);
    setIa(iaSalva(prov));
    setIaStatus({ msg: "" });
    setModelos([]);
  };
  const testar = async () => {
    setIaStatus({ msg: "Testando…" });
    const r = await testarIA(ia);
    if (r.modelos) setModelos(r.modelos);
    setIaStatus({ msg: r.msg, ok: r.ok });
    return r.ok;
  };

  const estimativa = () => {
    if (!info) return "";
    const fator = trans.motor === "groq" ? 150 : trans.motor === "openai" ? 40 : trans.motor === "navegador-small" ? 2 : 0.7;
    const est = info.duracao / fator;
    return est > 90 ? `~${Math.round(est / 60)} min` : `~${Math.max(10, Math.round(est))} s`;
  };

  async function gerar() {
    if (rodando || !arquivo || !info) return;
    setAviso("");
    if (!info.temAudio) return setAviso("Este vídeo não tem áudio: não dá para achar os momentos.");
    const qtd = Math.round(prefs.qtd);
    const { min, max } = prefs;
    if (!(qtd >= 1 && qtd <= 100)) return setAviso("Quantidade de cortes: de 1 a 100.");
    if (!(min >= 5) || !(max >= min + 5)) return setAviso("A duração máxima precisa ser pelo menos 5 s maior que a mínima.");
    if (qtd * min > info.duracao * 0.95) return setAviso(`O vídeo tem ${mmss(info.duracao)}: não cabem ${qtd} cortes de ${min}s ou mais. Diminua a quantidade ou a duração.`);
    if (["gemini", "openai", "claude"].includes(ia.provedor) && !ia.chave) return setAviso("Cole a chave da API da IA (ou escolha Sem IA).");
    if ((trans.motor === "groq" || trans.motor === "openai") && !trans.chave) return setAviso("Cole a chave da transcrição (ou escolha transcrever no navegador).");
    if (ia.provedor === "ollama" && !(await testar())) return setAviso("O Ollama não está pronto: veja o aviso no quadro da IA.");

    const ctrl = new AbortController();
    parar.current = ctrl;
    setRodando(true);
    prontos.forEach((x) => URL.revokeObjectURL(x.url));
    setProntos([]);
    setExtras([]);
    setExtrasSel([]);
    progresso("preparar", 0, "Começando…");
    const inicio = Date.now();
    let m: Montado | null = null;
    try {
      m = await montar(arquivo);
      const opts = { quantidade: qtd, min, max, tipo: prefs.tipo, instrucoes: prefs.instr.trim().slice(0, 500), ia: completar(ia) };
      const usaIA = ia.provedor !== "nenhum";
      const agenda = usaIA ? criarAgendaIA(opts, info.duracao, ctrl.signal) : null;
      const t = await transcrever(
        arquivo,
        m,
        info,
        trans,
        (etapa, pct, msg) => {
          let texto = msg;
          if (agenda && etapa === "transcrever") {
            const st = agenda.status();
            if (st.enviadas) texto += ` · IA já está analisando (${st.feitas}/${st.enviadas} trechos, ${st.achados} momentos)`;
          }
          progresso(etapa, pct, texto);
        },
        ctrl.signal,
        agenda ? (ws, ate) => agenda.alimentar(ws, ate, false) : undefined,
      );
      if (!t.words.length) throw new Error("Não encontrei fala no vídeo.");
      setInfo((i) => (i ? { ...i, transcrito: true } : i));
      const F = frases(t.words);
      let cands: Corte[] = [];
      if (agenda) {
        agenda.alimentar(t.words, t.duracao, true);
        cands = await agenda.terminar((e, pct, msg) => progresso(e, pct, msg));
      }
      const regras = candidatosRegra(F, t.words, t.energia, min, max);
      if (!cands.length) progresso("ia", 1, "Escolhendo os momentos pelas regras (sem IA)…");
      const { escolhidos, extras: sobras } = montarResultado(cands, regras, qtd);
      analise.current = { words: t.words, n: escolhidos.length };
      const feitos = await cortarLista(m, escolhidos, t.words, ctrl.signal, 0, escolhidos.length);
      setExtras(sobras.map((c) => ({ ...c, texto: textoDe(t.words, c) })));
      progresso("cortar", 1, `Pronto! ${feitos.length} cortes.`);
      const minutos = Math.round((Date.now() - inicio) / 60000);
      if (prefs.mesa) {
        await mandar(feitos);
        setAviso(`🔥 ${feitos.length} cortes prontos em ${minutos < 1 ? "menos de 1 min" : minutos + " min"} e já estão na mesa do Editor.`);
      } else setAviso(`🔥 ${feitos.length} cortes prontos. Revise e mande para a mesa.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAviso(
        ctrl.signal.aborted || msg === "Cancelado"
          ? "Cortes cancelados. Se gerar de novo no mesmo vídeo, a transcrição continua de onde parou."
          : "Não deu para gerar os cortes: " + msg,
      );
    } finally {
      await m?.soltar().catch(() => undefined);
      parar.current = null;
      setRodando(false);
    }
  }

  async function cortarLista(m: Montado, lista: Corte[], words: Word[], sinal: AbortSignal, base: number, total: number) {
    const feitos: Pronto[] = [];
    for (let i = 0; i < lista.length; i++) {
      if (sinal.aborted) throw new Error("Cancelado");
      const c = lista[i]!;
      const blob = await cortar(m, c, (pp) => progresso("cortar", (base + i + pp) / total, `Cortando ${base + i + 1} de ${total}…`), sinal);
      const pronto: Pronto = { ...c, blob, url: URL.createObjectURL(blob), words: palavrasDoCorte(words, c), naMesa: false };
      feitos.push(pronto);
      setProntos((x) => [...x, pronto]);
    }
    return feitos;
  }

  const nomeArquivo = (c: Pronto) => `${String(c.n || 1).padStart(2, "0")} - ${nomeSeguro(c.titulo)}.mp4`;

  async function mandar(lista: Pronto[]) {
    const novos = lista.filter((c) => !c.naMesa);
    if (!novos.length) return;
    const opts: OpcoesMesa = { formato: prefs.formato, legenda: prefs.legenda, emojis: prefs.emojis, titulo: prefs.titulo };
    await onMesa(
      novos.map((c) => ({
        file: new File([c.blob], nomeArquivo(c), { type: "video/mp4" }),
        titulo: c.titulo,
        words: c.words,
        emojis: gerarEmojis(c.words, c.emojis),
        corte: { nota: c.nota, titulo: c.titulo, descricao: c.descricao, gancho: c.gancho, origem: c.origem, emojis: c.emojis },
      })),
      opts,
    );
    const urls = new Set(novos.map((c) => c.url));
    setProntos((x) => x.map((c) => (urls.has(c.url) ? { ...c, naMesa: true } : c)));
  }

  async function cortarExtras() {
    if (rodando || !arquivo || !analise.current || !extrasSel.length) return;
    const ctrl = new AbortController();
    parar.current = ctrl;
    setRodando(true);
    let m: Montado | null = null;
    try {
      m = await montar(arquivo);
      const lista = extrasSel.slice().sort((a, b) => a - b).map((i) => extras[i]!);
      lista.forEach((c, i) => (c.n = analise.current!.n + i + 1));
      const feitos = await cortarLista(m, lista, analise.current.words, ctrl.signal, 0, lista.length);
      analise.current.n += feitos.length;
      setExtras((x) => x.filter((_, i) => !extrasSel.includes(i)));
      setExtrasSel([]);
      if (prefs.mesa) await mandar(feitos);
      setAviso(`${feitos.length} corte(s) a mais${prefs.mesa ? " na mesa" : ""}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!ctrl.signal.aborted) setAviso(msg);
    } finally {
      await m?.soltar().catch(() => undefined);
      parar.current = null;
      setRodando(false);
    }
  }

  const baixarTodos = () => {
    const entradas: Record<string, Uint8Array> = {};
    void Promise.all(prontos.map(async (c) => (entradas[nomeArquivo(c)] = new Uint8Array(await c.blob.arrayBuffer())))).then(() =>
      baixarBlob(new Blob([zipSync(entradas, { level: 0 }) as BlobPart], { type: "application/zip" }), `cortes-${nomeSeguro(arquivo?.name.replace(/\.[^.]+$/, "") || "video")}.zip`),
    );
  };

  const etapaIdx = ETAPAS.findIndex(([e]) => e === prog.etapa);
  const campo = (rotulo: string, filho: React.ReactNode) => (
    <label className="block space-y-1.5">
      <span className="text-xs text-tsecondary">{rotulo}</span>
      {filho}
    </label>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">1 · Vídeo longo</p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("video/") || /\.(mp4|mov|m4v|mkv|webm|avi|ts|flv)$/i.test(x.name));
              if (f) void escolher(f);
            }}
            onClick={() => entrada.current?.click()}
            className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border px-4 py-6 text-center hover:border-tmuted"
          >
            <Upload className="size-6 text-lime" />
            <p className="mt-2 text-sm font-semibold">🎬 Escolher vídeo <span className="text-tmuted">até 10 horas</span></p>
            <p className="text-xs text-tmuted">ou arraste aqui</p>
          </div>
          <input
            ref={entrada}
            type="file"
            accept="video/*,.mkv,.avi,.ts,.flv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void escolher(f);
              e.target.value = "";
            }}
          />
          {arquivo && (
            <div className="mt-3 space-y-1 rounded-lg bg-surface2 p-3 text-xs">
              <p className="truncate font-semibold" title={arquivo.name}>{arquivo.name}</p>
              {lendo && <p className="text-tmuted">Lendo o vídeo…</p>}
              {info && (
                <>
                  <p className="text-tsecondary">⏱ {mmss(info.duracao)} · {info.largura}×{info.altura}</p>
                  {!info.temAudio ? (
                    <p className="text-red-400">Este vídeo não tem áudio: não dá para achar os momentos.</p>
                  ) : info.transcrito ? (
                    <p className="text-lime">✓ Já transcrito antes: vai direto para a IA.</p>
                  ) : (
                    <p className="text-tmuted">Transcrição estimada: {estimativa()} ({NOMES_MOTOR[trans.motor].split(" (")[0]}).</p>
                  )}
                  {info.duracao > 10.5 * 3600 && <p className="text-amber-400">Passa de 10 horas: pode demorar bastante.</p>}
                </>
              )}
            </div>
          )}
          <div className="mt-3">
            <ReceberPonte destino="cortes" rotulo="Baixados pelo link (Minerador Viral)" usar={(f) => escolher(f)} />
          </div>
          <p className="mt-3 text-xs text-tmuted">
            Podcast, live, palestra, pregação, vídeo motivacional… O vídeo é lido direto do seu computador, sem enviar para nenhum servidor.
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">2 · Quantos cortes</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" min={1} max={100} value={prefs.qtd} onChange={(e) => p("qtd", Number(e.target.value))} className="!w-20 !py-2 text-sm" aria-label="Quantidade de cortes" />
            {QTDS.map((q) => (
              <Button key={q} variant={prefs.qtd === q ? "primary" : "ghost"} className="!px-3 !py-1.5 text-xs" onClick={() => p("qtd", q)}>
                {q}
              </Button>
            ))}
          </div>
          <p className="text-xs text-tsecondary">Duração de cada corte</p>
          <div className="flex flex-wrap gap-2">
            {DURS.map(([a, b, n]) => (
              <Button key={n} variant={prefs.min === a && prefs.max === b ? "primary" : "ghost"} className="!px-3 !py-1.5 text-xs" onClick={() => setPrefs((x) => ({ ...x, min: a, max: b }))}>
                {n}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo("Mínimo (s)", <Input type="number" min={5} max={600} value={prefs.min} onChange={(e) => p("min", Number(e.target.value))} className="!py-2 text-sm" />)}
            {campo("Máximo (s)", <Input type="number" min={10} max={900} value={prefs.max} onChange={(e) => p("max", Number(e.target.value))} className="!py-2 text-sm" />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo(
              "Tipo de conteúdo",
              <Select value={prefs.tipo} onChange={(e) => p("tipo", e.target.value)} className="!py-2 text-xs">
                {Object.entries(TIPOS).map(([k, [n]]) => (
                  <option key={k} value={k}>{k === "auto" ? "Automático" : n}</option>
                ))}
              </Select>,
            )}
            {campo(
              "Idioma da fala",
              <Select value={trans.idioma} onChange={(e) => setTrans((t) => ({ ...t, idioma: e.target.value }))} className="!py-2 text-xs">
                <option value="pt">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
                <option value="auto">Detectar</option>
              </Select>,
            )}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">3 · Como os cortes chegam na mesa</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["cheio", "9:16 tela cheia", "Corta as laterais e enche a tela em pé"],
                ["meio", "Meio + desfoque", "Vídeo deitado no meio com o fundo desfocado"],
                ["perfil", "Meu perfil", "Usa os ajustes do perfil atual"],
              ] as [FormatoCorte, string, string][]
            ).map(([k, n, t]) => (
              <Button key={k} title={t} variant={prefs.formato === k ? "primary" : "ghost"} className="!px-3 !py-1.5 text-xs" onClick={() => p("formato", k)}>
                {n}
              </Button>
            ))}
          </div>
          {(
            [
              ["legenda", "Legenda animada", "estilo da aba Legendas"],
              ["emojis", "Emojis automáticos", ""],
              ["titulo", "Título do corte no topo", "escrito pela IA"],
              ["mesa", "Mandar direto para a mesa", ""],
            ] as [keyof Prefs, string, string][]
          ).map(([k, n, d]) => (
            <label key={k} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                {n} {d && <small className="text-tmuted">{d}</small>}
              </span>
              <input type="checkbox" className="size-4 accent-lime" checked={Boolean(prefs[k])} onChange={(e) => p(k, e.target.checked as never)} />
            </label>
          ))}
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">4 · Inteligência que escolhe os momentos</p>
          {campo(
            "Motor",
            <Select value={ia.provedor} onChange={(e) => trocarProvedor(e.target.value as Provedor)} className="!py-2 text-sm">
              <option value="gemini">Google Gemini (chave grátis)</option>
              <option value="openai">OpenAI / compatível (Groq, OpenRouter…)</option>
              <option value="claude">Claude (Anthropic)</option>
              <option value="ollama">Ollama (no seu PC, grátis)</option>
              <option value="nenhum">Sem IA (regras rápidas)</option>
            </Select>,
          )}
          {(ia.provedor === "ollama" || ia.provedor === "openai") &&
            campo(ia.provedor === "ollama" ? "Endereço do Ollama" : "Endereço da API", <Input value={ia.url} placeholder={completar({ ...ia, url: "" }).url} onChange={(e) => setIa({ ...ia, url: e.target.value })} className="!py-2 text-sm" />)}
          {["gemini", "openai", "claude"].includes(ia.provedor) &&
            campo("Chave da API", <Input type="password" autoComplete="off" value={ia.chave} placeholder="cole a chave aqui" onChange={(e) => setIa({ ...ia, chave: e.target.value })} className="!py-2 text-sm" />)}
          {ia.provedor !== "nenhum" &&
            campo(
              "Modelo",
              <>
                <Input list="ct-modelos" value={ia.modelo} placeholder={completar({ ...ia, modelo: "" }).modelo} onChange={(e) => setIa({ ...ia, modelo: e.target.value })} className="!py-2 text-sm" />
                <datalist id="ct-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
              </>,
            )}
          <p className="text-xs text-tmuted">{DICAS[ia.provedor]}</p>
          <a href="/app/tutoriais#ia-local" className="text-xs text-lime underline">Tutorial: IA no seu PC (lista por PC fraco, médio e forte) e chaves grátis</a>
          {ia.provedor !== "nenhum" && (
            <Button variant="outline" className="!py-2 text-xs" onClick={() => void testar()}>
              Testar conexão
            </Button>
          )}
          {iaStatus.msg && <p className={cn("text-xs", iaStatus.ok === true ? "text-lime" : iaStatus.ok === false ? "text-red-400" : "text-tmuted")}>{iaStatus.msg}</p>}
          {campo("Pedido extra para a IA (opcional)", <Textarea rows={2} value={prefs.instr} onChange={(e) => p("instr", e.target.value)} placeholder="Ex.: prefira falas sobre dinheiro e família; evite política" className="text-sm" />)}
          <p className="text-[11px] text-tmuted">Usando {NOMES[ia.provedor]}. As chaves ficam guardadas só neste navegador.</p>
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Transcrição (Whisper)</p>
          {campo(
            "Onde transcrever",
            <Select value={trans.motor} onChange={(e) => setTrans((t) => ({ ...t, motor: e.target.value as TranscricaoConfig["motor"] }))} className="!py-2 text-xs">
              {Object.entries(NOMES_MOTOR).map(([k, n]) => (
                <option key={k} value={k}>{n}</option>
              ))}
            </Select>,
          )}
          {(trans.motor === "groq" || trans.motor === "openai") &&
            campo(
              trans.motor === "groq" ? "Chave da Groq (console.groq.com → API Keys)" : "Chave da OpenAI",
              <Input type="password" autoComplete="off" value={trans.chave} onChange={(e) => setTrans((t) => ({ ...t, chave: e.target.value }))} className="!py-2 text-sm" />,
            )}
          <p className="text-xs text-tmuted">
            {trans.motor.startsWith("navegador")
              ? "Grátis e sem enviar o áudio para ninguém. Na primeira vez baixa o modelo. Usa a placa de vídeo quando o navegador deixa (Chrome/Edge); sem ela fica bem mais lento — para vídeos de várias horas prefira a Groq."
              : "O áudio vai em partes de 10 minutos para a transcrição. A Groq tem cota grátis e transcreve 1 hora em poucos minutos."}{" "}
            A transcrição fica salva neste navegador: gerar de novo no mesmo vídeo é rápido.
          </p>
        </Card>

        <Button className="w-full !py-4 text-base" disabled={rodando || !info || lendo} onClick={() => void gerar()}>
          {rodando ? <Loader2 className="size-5 animate-spin" /> : <Flame className="size-5" />}
          {rodando ? "GERANDO CORTES…" : "GERAR CORTES"}
        </Button>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Cortes virais</p>
            <h2 className="text-2xl font-bold">Melhores momentos</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="!py-2 text-xs" disabled={!prontos.length} onClick={baixarTodos}>
              <Download className="size-4" /> Baixar todos (ZIP)
            </Button>
            <Button className="!py-2 text-xs" disabled={!prontos.length || prontos.every((c) => c.naMesa)} onClick={() => void mandar(prontos)}>
              <Send className="size-4" /> Mandar todos para a mesa
            </Button>
          </div>
        </div>

        {aviso && <p role="status" className="rounded-lg border border-lime/30 bg-lime/5 p-3 text-sm text-tsecondary">{aviso}</p>}

        {rodando && (
          <Card className="space-y-3 p-4">
            <ol className="flex flex-wrap gap-2 text-xs">
              {ETAPAS.map(([e, n], i) => (
                <li key={e} className={cn("rounded-full border px-3 py-1", i < etapaIdx ? "border-lime/40 text-lime" : i === etapaIdx ? "border-lime bg-lime/10 text-lime" : "border-border text-tmuted")}>
                  {i < etapaIdx ? "✓ " : ""}
                  {n}
                </li>
              ))}
            </ol>
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div className="h-full bg-lime transition-all" style={{ width: `${(prog.geral * 100).toFixed(1)}%` }} />
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-tsecondary">{prog.msg}</span>
              <span className="font-semibold text-lime">{Math.floor(prog.geral * 100)}%</span>
            </div>
            <Button variant="outline" className="!py-2 text-xs" onClick={() => parar.current?.abort()}>
              <Square className="size-4" /> Cancelar
            </Button>
          </Card>
        )}

        {prontos.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {prontos.map((c) => (
              <Card key={c.url} className="overflow-hidden p-0">
                <div className="relative bg-black">
                  <video src={c.url + "#t=0.1"} controls playsInline preload="metadata" className="aspect-video w-full object-contain" />
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-bold">#{String(c.n || 1).padStart(2, "0")}</span>
                  <span className={cn("absolute right-2 top-2 rounded px-2 py-0.5 text-xs font-bold", c.nota >= 85 ? "bg-lime text-bg" : "bg-black/70")} title={c.origem === "ia" ? "Nota da IA" : "Nota pelas regras"}>
                    🔥 {c.nota}
                  </span>
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs">{mmss(c.e - c.s)}</span>
                </div>
                <div className="space-y-2 p-4">
                  <p className="line-clamp-2 font-semibold" title={c.titulo}>{c.titulo}</p>
                  <p className="text-xs text-tmuted">{mmss(c.s)} → {mmss(c.e)} no original</p>
                  {c.gancho && <p className="text-xs text-tsecondary">{c.gancho}</p>}
                  <div className="flex gap-2">
                    <Button variant={c.naMesa ? "ghost" : "primary"} disabled={c.naMesa} className="!px-3 !py-1.5 text-xs" onClick={() => void mandar([c])}>
                      {c.naMesa ? "✓ Na mesa" : "➜ Mesa"}
                    </Button>
                    <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => baixarBlob(c.blob, nomeArquivo(c))}>
                      <Download className="size-3.5" /> Baixar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          !rodando && (
            <Card className="py-14 text-center">
              <p className="text-4xl">🔥</p>
              <h3 className="mt-3 text-lg font-bold">Corte um vídeo longo em vários virais</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-tmuted">
                Escolha o vídeo, diga quantos cortes quer e clique em <b>Gerar cortes</b>. O app transcreve a fala, a IA escolhe os melhores momentos e cada corte chega na mesa com legenda animada, emojis e título.
              </p>
            </Card>
          )
        )}

        {extras.length > 0 && (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Outros momentos encontrados</h3>
              <Button variant="outline" className="!py-1.5 text-xs" disabled={!extrasSel.length || rodando} onClick={() => void cortarExtras()}>
                <Scissors className="size-4" /> Cortar selecionados
              </Button>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {extras.map((c, i) => (
                <label key={`${c.s}-${i}`} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 text-xs hover:border-tmuted">
                  <input type="checkbox" className="mt-0.5 size-4 accent-lime" checked={extrasSel.includes(i)} onChange={(e) => setExtrasSel((x) => (e.target.checked ? [...x, i] : x.filter((y) => y !== i)))} />
                  <Badge tone={c.nota >= 85 ? "lime" : undefined}>🔥 {c.nota}</Badge>
                  <span className="min-w-0">
                    <b className="block text-sm">{c.titulo}</b>
                    <span className="text-tmuted">
                      {mmss(c.s)} → {mmss(c.e)} · {mmss(c.e - c.s)} — {c.texto.slice(0, 160)}…
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
        )}
        <p className="text-[11px] text-tmuted">Dica: mantenha esta aba aberta enquanto gera: o processamento acontece no seu navegador.</p>
      </section>
    </div>
  );
}
