import { useRef, useState } from "react";
import { Download, Film, Loader2, Trash2, Type, Upload } from "lucide-react";
import { FILTROS, paraFfmpeg, type Predefinicao } from "../lib/editor/filtros";
import { loadFFmpeg } from "../lib/metadata/video";
import { baixarBlob, cn } from "../lib/utils";
import { Badge, Button, Card, Empty, Input, Label, Progress } from "../components/ui";

type VideoJob = {
  id: string;
  file: File;
  url: string;
  nome: string;
  largura: number;
  altura: number;
  duracao: number;
  status: "pronto" | "processando" | "feito" | "erro";
  progresso: number;
  erro?: string;
  saida?: Blob;
};

function metaVideo(file: File): Promise<{ largura: number; altura: number; duracao: number; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      resolve({ largura: v.videoWidth || 1080, altura: v.videoHeight || 1920, duracao: v.duration || 0, url });
    v.onerror = () => reject(new Error("Não consegui ler esse vídeo."));
    v.src = url;
  });
}

async function textoParaPng(
  linhas: { texto: string; y: number }[],
  largura: number,
  altura: number,
  marca: string,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d")!;
  const base = Math.round(largura / 14);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const { texto, y } of linhas) {
    if (!texto.trim()) continue;
    const t = texto.toUpperCase();
    ctx.font = `900 ${base}px Inter, Arial, sans-serif`;
    const yy = y * altura;
    ctx.lineWidth = Math.max(4, base / 8);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(t, largura / 2, yy);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(t, largura / 2, yy);
  }
  if (marca.trim()) {
    ctx.font = `700 ${Math.round(base * 0.55)}px Inter, Arial, sans-serif`;
    ctx.textAlign = "right";
    const pad = Math.round(largura * 0.04);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(`@${marca}`, largura - pad, altura - pad);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`@${marca}`, largura - pad, altura - pad);
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Falha ao gerar a legenda.");
  return new Uint8Array(await blob.arrayBuffer());
}

export default function WorkspaceEditor() {
  const [videos, setVideos] = useState<VideoJob[]>([]);
  const [topo, setTopo] = useState("");
  const [base, setBase] = useState("");
  const [marca, setMarca] = useState("");
  const [filtro, setFiltro] = useState<Predefinicao>(FILTROS[0]!);
  const [processando, setProcessando] = useState(false);
  const [avisoFfmpeg, setAvisoFfmpeg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const adicionar = async (files: FileList | File[]) => {
    const lista = [...files].filter((f) => f.type.startsWith("video/"));
    for (const file of lista) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        const m = await metaVideo(file);
        setVideos((v) => [
          ...v,
          { id, file, url: m.url, nome: file.name, largura: m.largura, altura: m.altura, duracao: m.duracao, status: "pronto", progresso: 0 },
        ]);
      } catch {
        /* ignora arquivo inválido */
      }
    }
  };

  const remover = (id: string) => {
    setVideos((v) => {
      const alvo = v.find((x) => x.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return v.filter((x) => x.id !== id);
    });
  };

  const processar = async () => {
    if (processando || videos.length === 0) return;
    setProcessando(true);
    try {
      await loadFFmpeg();
    } catch {
      setAvisoFfmpeg(true);
      setProcessando(false);
      return;
    }
    const { fetchFile } = await import("@ffmpeg/util");
    for (const job of videos) {
      if (job.status === "feito") continue;
      setVideos((v) => v.map((x) => (x.id === job.id ? { ...x, status: "processando", progresso: 0, erro: undefined } : x)));
      try {
        const ffmpeg = await loadFFmpeg();
        const tag = Math.random().toString(36).slice(2);
        const entrada = `in_${tag}.mp4`;
        const legenda = `leg_${tag}.png`;
        const saida = `out_${tag}.mp4`;
        await ffmpeg.writeFile(entrada, await fetchFile(job.file));
        const png = await textoParaPng(
          [{ texto: topo, y: 0.12 }, { texto: base, y: 0.86 }],
          job.largura,
          job.altura,
          marca,
        );
        await ffmpeg.writeFile(legenda, png);
        const vf = `${paraFfmpeg(filtro)},overlay=0:0`;
        const onProg = ({ progress }: { progress: number }) =>
          setVideos((v) => v.map((x) => (x.id === job.id ? { ...x, progresso: Math.max(0, Math.min(1, progress)) } : x)));
        ffmpeg.on("progress", onProg);
        try {
          const code = await ffmpeg.exec([
            "-hide_banner", "-i", entrada, "-i", legenda,
            "-filter_complex", `[0:v]${vf}[v]`,
            "-map", "[v]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-movflags", "+faststart",
            "-shortest", saida,
          ]);
          if (code !== 0) throw new Error("O FFmpeg falhou neste vídeo.");
          const data = await ffmpeg.readFile(saida);
          const blob = new Blob([data as BlobPart], { type: "video/mp4" });
          setVideos((v) => v.map((x) => (x.id === job.id ? { ...x, status: "feito", progresso: 1, saida: blob } : x)));
          await ffmpeg.deleteFile(saida).catch(() => {});
        } finally {
          ffmpeg.off("progress", onProg);
          await ffmpeg.deleteFile(entrada).catch(() => {});
          await ffmpeg.deleteFile(legenda).catch(() => {});
        }
      } catch (e) {
        setVideos((v) =>
          v.map((x) => (x.id === job.id ? { ...x, status: "erro", erro: e instanceof Error ? e.message : "Falha ao processar." } : x)),
        );
      }
    }
    setProcessando(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-1">
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Type className="size-5 text-lime" /> Textos iguais em todos
          </h2>
          <div className="space-y-4">
            <div>
              <Label>Texto do topo</Label>
              <Input value={topo} onChange={(e) => setTopo(e.target.value)} placeholder="Ex: PARTE 1" />
            </div>
            <div>
              <Label>Texto da base</Label>
              <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="Ex: SIGA PARA MAIS" />
            </div>
            <div>
              <Label>Sua marca (canto inferior direito)</Label>
              <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="seuperfil" />
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Filtro</h2>
          <div className="grid grid-cols-2 gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.nome}
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition-all",
                  filtro.nome === f.nome ? "border-lime bg-lime/10 text-lime" : "border-border text-tsecondary hover:border-tmuted",
                )}
              >
                {f.nome}
              </button>
            ))}
          </div>
        </Card>
        <Button onClick={processar} disabled={processando || videos.length === 0} className="w-full">
          {processando ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
          {processando ? "Processando..." : `Aplicar em ${videos.length} vídeo(s)`}
        </Button>
        {avisoFfmpeg && (
          <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-400">
            Não consegui carregar o motor de vídeo (~30 MB). Verifique sua conexão e tente de novo.
          </p>
        )}
      </div>

      <div className="lg:col-span-2">
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface1 px-6 py-10 text-center hover:border-tmuted transition-colors"
        >
          <Upload className="size-8 text-lime" />
          <p className="mt-3 font-semibold">Adicionar vídeos</p>
          <p className="text-sm text-tmuted">MP4, WebM ou MOV · quantos quiser</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) adicionar(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {videos.length === 0 ? (
          <Card className="mt-4">
            <Empty
              icon={<Film className="size-7" />}
              titulo="Nenhum vídeo ainda"
              descricao="Envie os vídeos, configure os textos e o filtro uma vez só — o app aplica em todos e você baixa um por um."
            />
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {videos.map((v) => (
              <Card key={v.id} className="p-4">
                <div className="relative">
                  <video src={v.url} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />
                  {(topo || base) && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-3">
                      {topo && (
                        <span className="px-2 text-center text-sm font-black uppercase text-white [text-shadow:2px_2px_0_rgba(0,0,0,0.9)]">
                          {topo}
                        </span>
                      )}
                      {base && (
                        <span className="px-2 text-center text-sm font-black uppercase text-white [text-shadow:2px_2px_0_rgba(0,0,0,0.9)]">
                          {base}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-semibold">{v.nome}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-tmuted">
                  <span>{v.largura}×{v.altura}</span>
                  {v.status === "pronto" && <Badge>Na fila</Badge>}
                  {v.status === "processando" && <Badge tone="lime">Processando</Badge>}
                  {v.status === "feito" && <Badge tone="lime">Pronto</Badge>}
                  {v.status === "erro" && <Badge tone="warn">Erro</Badge>}
                </div>
                {v.status === "processando" && (
                  <div className="mt-2"><Progress value={v.progresso} /></div>
                )}
                {v.status === "erro" && <p className="mt-1 text-xs text-red-400">{v.erro}</p>}
                <div className="mt-3 flex gap-2">
                  {v.status === "feito" && v.saida && (
                    <Button className="!px-3 !py-2 text-xs" onClick={() => baixarBlob(v.saida!, `editado-${v.nome.replace(/\.[^.]+$/, "")}.mp4`)}>
                      <Download className="size-3.5" /> Baixar
                    </Button>
                  )}
                  <button onClick={() => remover(v.id)} className="rounded-lg p-2 text-tmuted hover:text-red-400 cursor-pointer" title="Remover">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
