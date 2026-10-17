import { useRef, useState } from "react";
import { Download, FileImage, FolderOpen, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { cleanImage, readImageMeta, type ImageMetaReport } from "../lib/metadata/image";
import { cleanVideo, nomesSequenciais, pastaDe, readVideoMeta } from "../lib/metadata/video";
import type { MetaEntry } from "../lib/metadata/image";
import { baixarBlob } from "../lib/utils";
import { Badge, Button, Card, Empty, Progress } from "../components/ui";
import { cn } from "../lib/utils";

type Arquivo = {
  id: string;
  file: File;
  /** Caminho relativo quando veio de uma pasta (ex.: "Reels/parte 2/a.mp4"). */
  caminho: string;
  url: string;
  tipo: "imagem" | "video";
  meta: MetaEntry[];
  formato: string;
  status: "analisando" | "pronto" | "limpando" | "limpo" | "erro";
  progresso: number;
  erro?: string;
  saida?: Blob;
  removidos?: number;
  relatorio?: ImageMetaReport;
};

const EXT_VIDEO = /\.(mp4|mov|m4v|mkv|webm|avi)$/i;
const ehVideo = (f: File) => f.type.startsWith("video/") || EXT_VIDEO.test(f.name);
const ehImagem = (f: File) => f.type.startsWith("image/");
const caminhoDe = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
/** Quantas pastas abaixo da pasta escolhida o arquivo está (0 = direto nela). */
const nivel = (c: string) => Math.max(0, c.split("/").length - 2);

export default function WorkspaceLimpador() {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [subpastas, setSubpastas] = useState(false);
  const [renomear, setRenomear] = useState(true);
  const [limpandoTudo, setLimpandoTudo] = useState(false);
  const pastaRef = useRef<HTMLInputElement>(null);

  const adicionar = async (lista: FileList | File[], dePasta = false) => {
    const novos: Arquivo[] = [...lista]
      .filter((f) => ehImagem(f) || ehVideo(f))
      .filter((f) => !dePasta || subpastas || nivel(caminhoDe(f)) === 0)
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        caminho: dePasta ? caminhoDe(file) : file.name,
        url: URL.createObjectURL(file),
        tipo: ehVideo(file) ? ("video" as const) : ("imagem" as const),
        meta: [],
        formato: (file.name.split(".").pop() || "?").toUpperCase(),
        status: "analisando" as const,
        progresso: 0,
      }));
    if (!novos.length) return;
    setArquivos((a) => [...a, ...novos]);
    for (const arq of novos) {
      try {
        if (arq.tipo === "imagem") {
          const rel = await readImageMeta(arq.file);
          setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, meta: rel.entries, relatorio: rel, status: "pronto" } : x)));
        } else {
          const meta = await readVideoMeta(arq.file);
          setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, meta, status: "pronto" } : x)));
        }
      } catch (e) {
        setArquivos((a) =>
          a.map((x) => (x.id === arq.id ? { ...x, status: "erro", erro: e instanceof Error ? e.message : "Falha ao ler o arquivo." } : x)),
        );
      }
    }
  };

  const limpar = async (arq: Arquivo) => {
    setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, status: "limpando", progresso: 0, erro: undefined } : x)));
    try {
      let saida: Blob;
      let removidos = arq.meta.length;
      if (arq.tipo === "imagem") {
        saida = await cleanImage(arq.file, arq.relatorio ?? { format: "outro", entries: [], orientation: 1, hasMetadata: true });
      } else {
        const r = await cleanVideo(arq.file, (p) => setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, progresso: p } : x))));
        saida = r.blob;
        removidos = r.removidos;
      }
      setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, status: "limpo", saida, removidos, progresso: 1 } : x)));
    } catch (e) {
      setArquivos((a) =>
        a.map((x) => (x.id === arq.id ? { ...x, status: "erro", erro: e instanceof Error ? e.message : "Falha ao limpar." } : x)),
      );
    }
  };

  // Um por vez: o FFmpeg do navegador é um só.
  const limparTodos = async () => {
    setLimpandoTudo(true);
    for (const a of arquivos.filter((x) => x.status === "pronto" || x.status === "erro")) await limpar(a);
    setLimpandoTudo(false);
  };

  const nomeFinal = (lista: Arquivo[]) => {
    const videos = lista.filter((a) => a.tipo === "video").map((a) => a.caminho);
    const novos = renomear ? nomesSequenciais(videos) : new Map<string, string>();
    return (a: Arquivo) => novos.get(a.caminho) ?? a.caminho;
  };

  const baixarZip = async () => {
    const limpos = arquivos.filter((a) => a.status === "limpo" && a.saida);
    if (!limpos.length) return;
    const { zipSync } = await import("fflate");
    const nome = nomeFinal(limpos);
    const conteudo: Record<string, Uint8Array> = {};
    for (const a of limpos) conteudo[nome(a)] = [new Uint8Array(await a.saida!.arrayBuffer()), { level: 0 }] as never;
    baixarBlob(new Blob([zipSync(conteudo) as BlobPart], { type: "application/zip" }), "arquivos-limpos.zip");
  };

  const remover = (id: string) => {
    setArquivos((a) => {
      const alvo = a.find((x) => x.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return a.filter((x) => x.id !== id);
    });
  };

  const prontos = arquivos.filter((a) => a.status === "pronto" || a.status === "erro").length;
  const limpos = arquivos.filter((a) => a.status === "limpo");
  const pastas = new Set(arquivos.map((a) => pastaDe(a.caminho))).size;
  const nome = nomeFinal(limpos);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          adicionar(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          arrastando ? "border-lime bg-lime/5" : "border-border bg-surface1 hover:border-tmuted",
        )}
        onClick={() => document.getElementById("up-limpador")?.click()}
      >
        <Upload className="size-10 text-lime" />
        <p className="mt-4 font-semibold">Arraste fotos ou vídeos aqui</p>
        <p className="mt-1 text-sm text-tmuted">ou clique para escolher · tudo processado no seu navegador, nada é enviado</p>
        <input
          id="up-limpador"
          type="file"
          multiple
          accept="image/*,video/*,.mkv,.avi"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) adicionar(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button variant="dark" onClick={() => pastaRef.current?.click()}>
            <FolderOpen className="size-4" /> Escolher uma pasta inteira
          </Button>
          <input
            ref={pastaRef}
            type="file"
            multiple
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => {
              if (e.target.files) adicionar(e.target.files, true);
              e.target.value = "";
            }}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-tsecondary">
            <input type="checkbox" checked={subpastas} onChange={(e) => setSubpastas(e.target.checked)} className="accent-lime" />
            Incluir os vídeos das subpastas
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-tsecondary">
            <input type="checkbox" checked={renomear} onChange={(e) => setRenomear(e.target.checked)} className="accent-lime" />
            Renomear para "vídeo 1", "vídeo 2"...
          </label>
        </div>
        <p className="mt-3 text-xs text-tmuted">
          O vídeo não é refeito: mesma qualidade, mesmo tamanho, nada cortado e a capa embutida continua. Saem título, data de
          criação, aparelho, localização, comentários, programa usado e os dados que o codificador grava dentro do vídeo.
          Antes de entregar, o resultado é conferido (mesma duração e mesmas faixas); se algo não bater, o arquivo fica como estava.
          {renomear && pastas > 1 && " A numeração é separada em cada pasta."}
        </p>
      </Card>

      {(prontos > 0 || limpos.length > 0) && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {prontos > 0 && (
            <Button onClick={limparTodos} disabled={limpandoTudo}>
              {limpandoTudo ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {limpandoTudo ? "Limpando..." : `Limpar todos (${prontos})`}
            </Button>
          )}
          {limpos.length > 0 && (
            <Button variant="dark" onClick={baixarZip}>
              <Download className="size-4" /> Baixar {limpos.length} limpo(s) em ZIP
            </Button>
          )}
        </div>
      )}

      {arquivos.length === 0 ? (
        <Card className="mt-6">
          <Empty
            icon={<FileImage className="size-7" />}
            titulo="Nenhum arquivo ainda"
            descricao="Envie fotos, vídeos ou uma pasta inteira para ver quais metadados eles carregam (GPS, aparelho, datas) e removê-los com 1 clique."
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {arquivos.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex gap-4">
                {a.tipo === "imagem" ? (
                  <img src={a.url} alt={a.file.name} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                ) : (
                  <video src={a.url} className="h-24 w-24 shrink-0 rounded-xl bg-black object-cover" muted />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={a.caminho}>{a.caminho}</p>
                  {a.status === "limpo" && nome(a) !== a.caminho && (
                    <p className="truncate text-xs text-lime">→ {nome(a).slice(nome(a).lastIndexOf("/") + 1)}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge>{a.formato}</Badge>
                    {a.status === "limpo" ? (
                      <Badge tone="lime">Limpo · {a.removidos ?? 0} removido(s)</Badge>
                    ) : a.meta.length > 0 ? (
                      <Badge tone="warn">{a.meta.length} metadados</Badge>
                    ) : (
                      a.status === "pronto" && <Badge>Nada sensível</Badge>
                    )}
                  </div>
                  {a.status === "analisando" && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-tmuted">
                      <Loader2 className="size-3.5 animate-spin" /> Analisando...
                    </p>
                  )}
                  {a.status === "limpando" && (
                    <div className="mt-2">
                      <Progress value={a.progresso} />
                      <p className="mt-1 text-xs text-tmuted">Limpando e conferindo...</p>
                    </div>
                  )}
                  {a.status === "erro" && <p className="mt-2 text-xs text-red-400">{a.erro}</p>}
                  {a.meta.length > 0 && a.status !== "limpo" && (
                    <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-surface2 p-2 text-xs">
                      {a.meta.slice(0, 8).map((m, i) => (
                        <p key={i} className={m.sensitive ? "text-amber-400" : "text-tmuted"}>
                          {m.label}: {m.value}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {(a.status === "pronto" || a.status === "erro") && (
                      <Button variant="dark" className="!px-3 !py-2 text-xs" onClick={() => limpar(a)} disabled={limpandoTudo}>
                        <ShieldCheck className="size-3.5" /> Limpar metadados
                      </Button>
                    )}
                    {a.status === "limpo" && a.saida && (
                      <Button className="!px-3 !py-2 text-xs" onClick={() => baixarBlob(a.saida!, nome(a).slice(nome(a).lastIndexOf("/") + 1))}>
                        <Download className="size-3.5" /> Baixar limpo
                      </Button>
                    )}
                    <button onClick={() => remover(a.id)} className="cursor-pointer rounded-lg p-2 text-tmuted hover:text-red-400" title="Remover">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
