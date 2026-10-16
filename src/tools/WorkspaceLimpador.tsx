import { useState } from "react";
import { Download, FileImage, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { cleanImage, readImageMeta, type ImageMetaReport } from "../lib/metadata/image";
import { cleanVideo, readVideoMeta } from "../lib/metadata/video";
import type { MetaEntry } from "../lib/metadata/image";
import { baixarBlob } from "../lib/utils";
import { Badge, Button, Card, Empty, Progress } from "../components/ui";
import { cn } from "../lib/utils";

type Arquivo = {
  id: string;
  file: File;
  url: string;
  tipo: "imagem" | "video";
  meta: MetaEntry[];
  formato: string;
  status: "analisando" | "pronto" | "limpando" | "limpo" | "erro";
  progresso: number;
  erro?: string;
  saida?: Blob;
  relatorio?: ImageMetaReport;
};

const ehVideo = (f: File) => f.type.startsWith("video/");
const ehImagem = (f: File) => f.type.startsWith("image/");

export default function WorkspaceLimpador() {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [arrastando, setArrastando] = useState(false);

  const adicionar = async (lista: FileList | File[]) => {
    const novos: Arquivo[] = [...lista]
      .filter((f) => ehImagem(f) || ehVideo(f))
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
        tipo: ehVideo(file) ? ("video" as const) : ("imagem" as const),
        meta: [],
        formato: file.type.split("/")[1]?.toUpperCase() || "?",
        status: "analisando" as const,
        progresso: 0,
      }));
    if (!novos.length) return;
    setArquivos((a) => [...novos, ...a]);
    for (const arq of novos) {
      try {
        if (arq.tipo === "imagem") {
          const rel = await readImageMeta(arq.file);
          setArquivos((a) =>
            a.map((x) => (x.id === arq.id ? { ...x, meta: rel.entries, relatorio: rel, status: "pronto" } : x)),
          );
        } else {
          const meta = await readVideoMeta(arq.file);
          setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, meta, status: "pronto" } : x)));
        }
      } catch (e) {
        setArquivos((a) =>
          a.map((x) =>
            x.id === arq.id
              ? { ...x, status: "erro", erro: e instanceof Error ? e.message : "Falha ao ler o arquivo." }
              : x,
          ),
        );
      }
    }
  };

  const limpar = async (arq: Arquivo) => {
    setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, status: "limpando", progresso: 0 } : x)));
    try {
      const saida =
        arq.tipo === "imagem"
          ? await cleanImage(arq.file, arq.relatorio ?? { format: "outro", entries: [], orientation: 1, hasMetadata: true })
          : await cleanVideo(arq.file, (p) =>
              setArquivos((a) => a.map((x) => (x.id === arq.id ? { ...x, progresso: p } : x))),
            );
      setArquivos((a) =>
        a.map((x) => (x.id === arq.id ? { ...x, status: "limpo", saida, progresso: 1 } : x)),
      );
    } catch (e) {
      setArquivos((a) =>
        a.map((x) =>
          x.id === arq.id
            ? { ...x, status: "erro", erro: e instanceof Error ? e.message : "Falha ao limpar." }
            : x,
        ),
      );
    }
  };

  const limparTodos = () => arquivos.filter((a) => a.status === "pronto").forEach(limpar);

  const remover = (id: string) => {
    setArquivos((a) => {
      const alvo = a.find((x) => x.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return a.filter((x) => x.id !== id);
    });
  };

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
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          arrastando ? "border-lime bg-lime/5" : "border-border bg-surface1 hover:border-tmuted",
        )}
        onClick={() => document.getElementById("up-limpador")?.click()}
      >
        <Upload className="size-10 text-lime" />
        <p className="mt-4 font-semibold">Arraste fotos ou vídeos aqui</p>
        <p className="mt-1 text-sm text-tmuted">ou clique para escolher · tudo processado no seu navegador</p>
        <input
          id="up-limpador"
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) adicionar(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {arquivos.some((a) => a.status === "pronto") && (
        <div className="mt-4 flex justify-end">
          <Button onClick={limparTodos}>
            <ShieldCheck className="size-4" /> Limpar todos
          </Button>
        </div>
      )}

      {arquivos.length === 0 ? (
        <Card className="mt-6">
          <Empty
            icon={<FileImage className="size-7" />}
            titulo="Nenhum arquivo ainda"
            descricao="Envie fotos ou vídeos para ver quais metadados eles carregam (GPS, aparelho, datas) e removê-los com 1 clique."
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
                  <p className="truncate text-sm font-semibold">{a.file.name}</p>
                  <div className="mt-1 flex gap-2">
                    <Badge>{a.formato}</Badge>
                    {a.status === "limpo" ? (
                      <Badge tone="lime">Limpo</Badge>
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
                      <p className="mt-1 text-xs text-tmuted">Limpando...</p>
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
                      <Button variant="dark" className="!px-3 !py-2 text-xs" onClick={() => limpar(a)}>
                        <ShieldCheck className="size-3.5" /> Limpar metadados
                      </Button>
                    )}
                    {a.status === "limpo" && a.saida && (
                      <Button
                        className="!px-3 !py-2 text-xs"
                        onClick={() => baixarBlob(a.saida!, `limpo-${a.file.name}`)}
                      >
                        <Download className="size-3.5" /> Baixar limpo
                      </Button>
                    )}
                    <button
                      onClick={() => remover(a.id)}
                      className="rounded-lg p-2 text-tmuted hover:text-red-400 cursor-pointer"
                      title="Remover"
                    >
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
