import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button, Input, Select } from "../../components/ui";
import { ESTILOS_FRASE, NOMES, TEMAS_RAPIDOS, gerarFrases, iaSalva } from "../../lib/ia/ia";
import type { EditorJob } from "../../lib/editor/model";

const ler = <T,>(k: string, padrao: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? padrao : (JSON.parse(v) as T);
  } catch {
    return padrao;
  }
};
const gravar = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
};

/** Frases com IA para vídeos sem texto: uma frase diferente para cada vídeo do escopo. */
export default function FrasesPanel({ alvo, aplicar, busy }: { alvo: EditorJob[]; aplicar: (porId: Record<string, { texto: string; legenda: string }>) => void; busy: boolean }) {
  const [tema, setTema] = useState(() => ler("nk.frTema", ""));
  const [estilo, setEstilo] = useState("curta");
  const [publico, setPublico] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [post, setPost] = useState(true);
  const [soVazios, setSoVazios] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [status, setStatus] = useState("");

  async function gerar() {
    if (rodando) return;
    if (!tema.trim()) return setStatus("Escreva um tema (ou toque num dos temas prontos).");
    let lista = alvo;
    if (!lista.length) return setStatus("Nenhum vídeo no escopo (Este / Seleção / Todos). Importe os vídeos primeiro.");
    if (soVazios) lista = lista.filter((v) => !v.caption.trim());
    if (!lista.length) return setStatus("Todos os vídeos do escopo já têm texto. Desmarque “Só nos vídeos sem texto” para trocar.");
    const ia = iaSalva();
    if (ia.provedor === "nenhum") return setStatus("Escolha uma IA em 🔥 Cortes Virais → Inteligência (Gemini, OpenAI, Claude ou Ollama).");
    setRodando(true);
    setStatus(`Usando ${NOMES[ia.provedor]}…`);
    try {
      const usadas = ler<string[]>("nk.frasesUsadas", []);
      const frases = await gerarFrases({ ia, tema, estilo, publico: publico.trim(), emoji, legendaPost: post, quantidade: lista.length, evitar: usadas.slice(-80) });
      const porId: Record<string, { texto: string; legenda: string }> = {};
      lista.forEach((v, i) => {
        const f = frases[i % frases.length]!;
        porId[v.id] = { texto: f.texto.replace(/\s*\|\s*/g, "\n"), legenda: f.legenda };
      });
      aplicar(porId);
      gravar("nk.frasesUsadas", usadas.concat(frases.map((f) => f.texto)).slice(-400));
      gravar("nk.frTema", tema);
      setStatus(`✨ ${Math.min(frases.length, lista.length)} frase(s) diferentes sobre “${tema}” colocadas em ${lista.length} vídeo(s). Ajuste posição e estilo abaixo e processe.`);
    } catch (e) {
      setStatus("Não deu para gerar as frases: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRodando(false);
    }
  }

  return (
    <details className="border-b border-border pb-3">
      <summary className="cursor-pointer text-xs font-semibold">✨ Frases com IA</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-tmuted">Para vídeos sem texto: a IA cria uma frase diferente para cada vídeo do escopo (Este / Seleção / Todos) e coloca na tela. Usa a IA escolhida em 🔥 Cortes Virais.</p>
        <Input aria-label="Tema" maxLength={200} value={tema} onChange={(e) => setTema(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void gerar()} placeholder="Ex.: disciplina e foco nos estudos" className="!py-2 text-xs" />
        <div className="flex flex-wrap gap-1">
          {TEMAS_RAPIDOS.map((t) => (
            <button key={t} className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-[11px] text-tsecondary hover:border-lime hover:text-lime" onClick={() => setTema(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Tipo de texto" value={estilo} onChange={(e) => setEstilo(e.target.value)} className="!py-2 text-xs">
            {Object.entries(ESTILOS_FRASE).map(([k, [n]]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </Select>
          <Input aria-label="Público" maxLength={200} value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Público (opcional)" className="!py-2 text-xs" />
        </div>
        {(
          [
            [emoji, setEmoji, "Terminar com 1 emoji"],
            [post, setPost, "Gerar também a legenda do post (com hashtags, usada no Agendador)"],
            [soVazios, setSoVazios, "Só nos vídeos sem texto (não troca o que você já escreveu)"],
          ] as [boolean, (v: boolean) => void, string][]
        ).map(([v, set, n]) => (
          <label key={n} className="flex cursor-pointer items-center justify-between gap-3 text-xs text-tsecondary">
            {n}
            <input type="checkbox" className="size-4 accent-lime" checked={v} onChange={(e) => set(e.target.checked)} />
          </label>
        ))}
        <Button className="w-full !py-2 text-xs" disabled={rodando || busy} onClick={() => void gerar()}>
          {rodando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {rodando ? `Criando ${alvo.length} frase(s)…` : "Gerar frases"}
        </Button>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] text-tmuted">{status}</span>
          <button className="shrink-0 cursor-pointer text-[11px] text-lime" title="Esquece as frases já usadas (podem voltar a aparecer)" onClick={() => gravar("nk.frasesUsadas", [])}>
            esquecer usadas
          </button>
        </div>
      </div>
    </details>
  );
}
