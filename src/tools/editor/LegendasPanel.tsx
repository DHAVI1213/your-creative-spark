import { useEffect, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button, Input, Select, Textarea } from "../../components/ui";
import type { EditorJob, EmojiMark, Settings, Word } from "../../lib/editor/model";
import { ESTILOS, gerarEmojis, realinhar } from "../../lib/editor/legendas";
import { NOMES_MOTOR } from "../../lib/cortes/transcricao";
import { salvarTranscricao, transcricaoSalva, type TranscricaoConfig } from "../../lib/ia/ia";
import { Field, type Update } from "./Controls";
import { cn } from "../../lib/utils";

const EMOJIS_RAPIDOS = ["🔥", "💰", "😂", "🤯", "💯", "🙏", "❤️", "💪", "🧠", "🎯", "🚀", "😱", "👀", "⚠️", "✅", "🏆"];
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export type Transcrevendo = { rodando: boolean; msg: string; pct: number };

export default function LegendasPanel({
  s,
  update,
  job,
  time,
  busy,
  estado,
  transcrever,
  cancelar,
  setWords,
  setEmojis,
  irPara,
}: {
  s: Settings;
  update: Update;
  job?: EditorJob;
  time: number;
  busy: boolean;
  estado: Transcrevendo;
  transcrever: () => void;
  cancelar: () => void;
  setWords: (w: Word[]) => void;
  setEmojis: (e: EmojiMark[]) => void;
  irPara: (t: number) => void;
}) {
  const la = s.legendaAnim;
  const [cfg, setCfg] = useState<TranscricaoConfig>(() => transcricaoSalva());
  const [texto, setTexto] = useState("");
  const [novo, setNovo] = useState("🔥");
  const n = job?.words?.length ?? 0;
  useEffect(() => setTexto(n ? job!.words!.map((w) => w.w).join(" ") : ""), [job?.id, job?.words]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => salvarTranscricao(cfg), [cfg]);

  const seg = (path: string, atual: string | number, opcoes: [string | number, string][]) => (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map(([v, nome]) => (
        <Button key={String(v)} variant={atual === v ? "primary" : "ghost"} className="!px-2.5 !py-1.5 text-[11px]" onClick={() => update(path, v)}>
          {nome}
        </Button>
      ))}
    </div>
  );
  const f = (path: string, label: string, type: "check" | "color" | "range", min?: number, max?: number, step?: number) => (
    <Field spec={{ path, label, type, min, max, step }} s={s} update={update} notify={() => undefined} />
  );

  return (
    <div className="space-y-4 pt-4">
      {f("legendaAnim.ativo", "Legenda animada — palavra por palavra, no tempo da fala", "check")}
      <p className="rounded-lg bg-surface2 p-3 text-xs">
        {!job ? (
          <span className="text-tmuted">Abra um vídeo para ver a legenda dele.</span>
        ) : n ? (
          <>
            <b>💬 {n} palavras</b> neste vídeo{job.corte ? ` · corte viral 🔥 ${job.corte.nota}` : ""}
            {!la.ativo && <span className="text-amber-400"> · legenda desligada</span>}
          </>
        ) : (
          <span className="text-amber-400">Este vídeo ainda não tem legenda. Clique em Gerar legenda automática.</span>
        )}
      </p>

      <h3 className="text-xs font-semibold">Gerar legenda automática</h3>
      <p className="text-xs text-tmuted">Transcreve a fala dos vídeos do escopo (Este / Seleção / Todos). Os cortes virais já chegam com a legenda pronta.</p>
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Idioma" className="!py-2 text-xs" value={cfg.idioma} onChange={(e) => setCfg({ ...cfg, idioma: e.target.value })}>
          <option value="pt">Português</option>
          <option value="en">Inglês</option>
          <option value="es">Espanhol</option>
          <option value="auto">Detectar</option>
        </Select>
        <Select aria-label="Onde transcrever" className="!py-2 text-xs" value={cfg.motor} onChange={(e) => setCfg({ ...cfg, motor: e.target.value as TranscricaoConfig["motor"] })}>
          {Object.entries(NOMES_MOTOR).map(([k, nome]) => (
            <option key={k} value={k}>{nome.split(" (")[0]}</option>
          ))}
        </Select>
      </div>
      {(cfg.motor === "groq" || cfg.motor === "openai") && (
        <Input type="password" autoComplete="off" aria-label="Chave da transcrição" placeholder={cfg.motor === "groq" ? "Chave da Groq" : "Chave da OpenAI"} className="!py-2 text-xs" value={cfg.chave} onChange={(e) => setCfg({ ...cfg, chave: e.target.value })} />
      )}
      {estado.rodando ? (
        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
            <div className="h-full bg-lime" style={{ width: `${(estado.pct * 100).toFixed(1)}%` }} />
          </div>
          <div className="flex justify-between gap-2 text-[11px] text-tmuted">
            <span>{estado.msg}</span>
            <button className="cursor-pointer text-lime" onClick={cancelar}>
              <Square className="inline size-3" /> cancelar
            </button>
          </div>
        </div>
      ) : (
        <Button className="w-full !py-2 text-xs" disabled={busy} onClick={transcrever}>
          <Mic className="size-4" /> Gerar legenda automática
        </Button>
      )}

      <h3 className="text-xs font-semibold">Estilo</h3>
      {seg("legendaAnim.estilo", la.estilo, Object.entries(ESTILOS) as [string, string][])}
      {seg("legendaAnim.animacao", la.animacao, [["pop", "Pop"], ["subir", "Subir"], ["nenhuma", "Sem animação"]])}
      {la.estilo !== "palavra" && f("legendaAnim.palavras", "Palavras na tela", "range", 1, 6, 1)}
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Fonte da legenda" className="!py-2 text-xs" value={la.fonte} onChange={(e) => update("legendaAnim.fonte", e.target.value)}>
          {["Montserrat", "Poppins", "Anton", "Bebas Neue", "Arial Black", "Impact", "Arial"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
        <Select aria-label="Peso da legenda" className="!py-2 text-xs" value={la.peso} onChange={(e) => update("legendaAnim.peso", Number(e.target.value))}>
          <option value={400}>Normal</option>
          <option value={700}>Negrito</option>
          <option value={800}>Extra</option>
          <option value={900}>Black</option>
        </Select>
      </div>
      {f("legendaAnim.tamanho", "Tamanho", "range", 36, 160, 1)}
      {f("legendaAnim.v", "Posição vertical (%)", "range", 8, 94, 1)}
      {seg("legendaAnim.v", la.v, [[22, "Topo"], [50, "Meio"], [70, "Baixo"], [82, "Rodapé"]])}
      {f("legendaAnim.largura", "Largura máxima (%)", "range", 40, 100, 1)}
      {f("legendaAnim.maiusculas", "MAIÚSCULAS", "check")}
      {f("legendaAnim.semPontuacao", "Tirar pontuação (deixa o “?” das perguntas)", "check")}

      <h3 className="text-xs font-semibold">Cores</h3>
      {f("legendaAnim.cor", "Texto", "color")}
      <div className="grid grid-cols-3 gap-2">
        {f("legendaAnim.destaque", "Destaque 1", "color")}
        {f("legendaAnim.destaque2", "2", "color")}
        {f("legendaAnim.destaque3", "3", "color")}
      </div>
      {f("legendaAnim.trocarCor", "Trocar a cor a cada frase", "check")}
      {la.estilo === "caixa" && f("legendaAnim.caixaTexto", "Texto dentro da caixa", "color")}
      {f("legendaAnim.contorno", "Contorno", "check")}
      {la.contorno && f("legendaAnim.contornoCor", "Cor do contorno", "color")}
      {f("legendaAnim.sombra", "Sombra", "check")}

      <h3 className="text-xs font-semibold">Emojis</h3>
      {f("legendaAnim.emojis", "Emojis automáticos nas palavras importantes", "check")}
      {la.emojis && (
        <div className="space-y-3">
          {f("legendaAnim.emojiTam", "Tamanho do emoji", "range", 50, 220, 1)}
          <div className="flex flex-wrap gap-1.5">
            {(job?.emojis ?? []).length ? (
              job!.emojis!.map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs">
                  <button className="cursor-pointer" title={"Ir para " + fmt(e.s)} onClick={() => irPara(e.s)}>
                    {e.ch} <small className="text-tmuted">{fmt(e.s)}</small>
                  </button>
                  <button className="cursor-pointer text-tmuted hover:text-red-400" title="Tirar" onClick={() => setEmojis(job!.emojis!.filter((_, k) => k !== i))}>
                    ✕
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-tmuted">{n ? "Nenhum emoji neste vídeo." : "Os emojis aparecem depois de gerar a legenda."}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Emoji" maxLength={8} value={novo} onChange={(e) => setNovo(e.target.value)} className="!w-16 !py-1.5 text-center" />
            <Button
              variant="outline"
              className="!py-1.5 text-xs"
              disabled={!job}
              onClick={() => {
                if (!job) return;
                const lista = (job.emojis ?? []).filter((x) => Math.abs(x.s - time) > 0.3);
                lista.push({ s: time, e: time + 1.6, ch: novo.trim() || "🔥" });
                lista.sort((a, b) => a.s - b.s);
                for (let i = 0; i < lista.length - 1; i++) lista[i]!.e = Math.min(lista[i]!.s + 1.6, lista[i + 1]!.s);
                setEmojis(lista);
              }}
            >
              + No momento atual
            </Button>
            <button className="cursor-pointer text-xs text-lime" disabled={!n} onClick={() => job?.words && setEmojis(gerarEmojis(job.words, job.corte?.emojis))}>
              refazer automáticos
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {EMOJIS_RAPIDOS.map((e) => (
              <button key={e} className={cn("cursor-pointer rounded p-1 text-lg hover:bg-surface2", novo === e && "bg-surface2")} onClick={() => setNovo(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-xs font-semibold">Texto da legenda deste vídeo</h3>
      <Textarea aria-label="Texto da legenda" rows={6} disabled={!n} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Gere a legenda automática para aparecer o texto aqui." className="text-xs" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-tmuted">Corrija palavras erradas: os tempos são mantidos.</span>
        <Button
          variant="outline"
          className="!py-1.5 text-xs"
          disabled={!n}
          onClick={() => {
            const novas = realinhar(job?.words, texto);
            if (novas.length) setWords(novas);
          }}
        >
          Salvar texto
        </Button>
      </div>
    </div>
  );
}
