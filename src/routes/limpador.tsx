import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eraser,
  FileImage,
  FileVideo,
  Loader2,
  MapPin,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDevice } from "@/lib/device";
import {
  cleanImage,
  readImageMeta,
  type ImageMetaReport,
  type MetaEntry,
} from "@/lib/metadata/image";
import { cleanVideo, loadFFmpeg, readVideoMeta } from "@/lib/metadata/video";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/limpador")({
  head: () => ({ meta: [{ title: "Limpador de Metadados · Fábrica de Conteúdo" }] }),
  component: Limpador,
});

type Status = "lendo" | "pronto" | "limpando" | "limpo" | "erro";

type Item = {
  id: string;
  file: File;
  kind: "imagem" | "video";
  status: Status;
  entries: MetaEntry[];
  report?: ImageMetaReport;
  cleaned?: Blob;
  cleanedName?: string;
  progress: number;
  error?: string | undefined;
  preview?: string | undefined;
};

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function outputName(file: File, blob: Blob) {
  const base = file.name.replace(/\.[^.]+$/, "");
  const originalExt = file.name.split(".").pop() ?? "";
  const ext =
    blob.type && blob.type !== file.type ? (EXT_BY_TYPE[blob.type] ?? originalExt) : originalExt;
  return `${base}_limpo.${ext}`;
}

function formatSize(bytes: number) {
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Roda tarefas com um limite de quantas ao mesmo tempo. */
async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (next !== undefined) await task(next);
    }
  });
  await Promise.all(workers);
}

function Limpador() {
  const device = useDevice();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<"parado" | "carregando" | "pronto" | "erro">("parado");
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  // Libera as miniaturas da memória ao sair da página.
  useEffect(
    () => () => {
      itemsRef.current.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
    },
    [],
  );

  const ensureEngine = useCallback(async () => {
    if (engine === "pronto") return true;
    setEngine("carregando");
    try {
      await loadFFmpeg();
      setEngine("pronto");
      return true;
    } catch {
      setEngine("erro");
      toast.error("Não deu para carregar o motor de vídeo. Verifique a internet e tente de novo.");
      return false;
    }
  }, [engine]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const accepted = Array.from(files).filter(
        (f) =>
          f.type.startsWith("image/") ||
          f.type.startsWith("video/") ||
          /\.(heic|mov|mkv)$/i.test(f.name),
      );
      if (!accepted.length) {
        toast.error("Escolha fotos ou vídeos.");
        return;
      }
      const fresh: Item[] = accepted.map((file) => {
        const kind =
          file.type.startsWith("video/") || /\.(mov|mkv)$/i.test(file.name) ? "video" : "imagem";
        return {
          id: crypto.randomUUID(),
          file,
          kind,
          status: "lendo",
          entries: [],
          progress: 0,
          preview: kind === "imagem" ? URL.createObjectURL(file) : undefined,
        };
      });
      setItems((list) => [...list, ...fresh]);

      const images = fresh.filter((i) => i.kind === "imagem");
      const videos = fresh.filter((i) => i.kind === "video");

      await runPool(images, device.concurrency * 2, async (it) => {
        try {
          const report = await readImageMeta(it.file);
          patch(it.id, { status: "pronto", report, entries: report.entries });
        } catch {
          patch(it.id, { status: "pronto", entries: [] });
        }
      });

      if (videos.length) {
        if (!(await ensureEngine())) {
          videos.forEach((v) =>
            patch(v.id, { status: "erro", error: "Motor de vídeo indisponível" }),
          );
          return;
        }
        for (const it of videos) {
          try {
            const entries = await readVideoMeta(it.file);
            patch(it.id, { status: "pronto", entries });
          } catch {
            patch(it.id, { status: "pronto", entries: [] });
          }
        }
      }
    },
    [device.concurrency, ensureEngine, patch],
  );

  const cleanAll = async () => {
    const pending = itemsRef.current.filter((i) => i.status === "pronto" || i.status === "erro");
    if (!pending.length) return;
    setBusy(true);
    let done = 0;
    const images = pending.filter((i) => i.kind === "imagem");
    const videos = pending.filter((i) => i.kind === "video");

    await runPool(images, device.concurrency, async (it) => {
      patch(it.id, { status: "limpando", progress: 0.5, error: undefined });
      try {
        const blob = await cleanImage(it.file, it.report ?? (await readImageMeta(it.file)));
        done++;
        patch(it.id, {
          status: "limpo",
          cleaned: blob,
          cleanedName: outputName(it.file, blob),
          progress: 1,
        });
      } catch (e) {
        patch(it.id, { status: "erro", error: e instanceof Error ? e.message : "Falha ao limpar" });
      }
    });

    if (videos.length && (await ensureEngine())) {
      // FFmpeg no navegador processa um vídeo por vez.
      for (const it of videos) {
        patch(it.id, { status: "limpando", progress: 0, error: undefined });
        try {
          const blob = await cleanVideo(it.file, (r) => patch(it.id, { progress: r }));
          done++;
          patch(it.id, {
            status: "limpo",
            cleaned: blob,
            cleanedName: outputName(it.file, blob),
            progress: 1,
          });
        } catch (e) {
          patch(it.id, {
            status: "erro",
            error: e instanceof Error ? e.message : "Falha ao limpar",
          });
        }
      }
    }

    setBusy(false);
    toast.success(`${done} arquivo${done === 1 ? "" : "s"} limpo${done === 1 ? "" : "s"}.`);
  };

  const cleanedItems = items.filter((i) => i.status === "limpo" && i.cleaned);

  const downloadAll = async () => {
    if (cleanedItems.length === 1) {
      const it = cleanedItems[0]!;
      downloadBlob(it.cleaned!, it.cleanedName!);
      return;
    }
    const { zip } = await import("fflate");
    const files: Record<string, [Uint8Array, { level: 0 }]> = {};
    const used = new Set<string>();
    for (const it of cleanedItems) {
      let name = it.cleanedName!;
      for (let n = 2; used.has(name); n++) name = it.cleanedName!.replace(/(\.[^.]+)$/, `_${n}$1`);
      used.add(name);
      files[name] = [new Uint8Array(await it.cleaned!.arrayBuffer()), { level: 0 }];
    }
    zip(files, (err, data) => {
      if (err) {
        toast.error("Não deu para montar o .zip.");
        return;
      }
      downloadBlob(
        new Blob([data as BlobPart], { type: "application/zip" }),
        "arquivos_limpos.zip",
      );
    });
  };

  const canShareFiles =
    device.isMobile &&
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    cleanedItems.length > 0 &&
    navigator.canShare({
      files: cleanedItems
        .slice(0, 1)
        .map((i) => new File([i.cleaned!], i.cleanedName!, { type: i.cleaned!.type })),
    });

  const shareAll = async () => {
    const files = cleanedItems.map(
      (i) => new File([i.cleaned!], i.cleanedName!, { type: i.cleaned!.type }),
    );
    try {
      await navigator.share({ files });
    } catch {
      /* usuário cancelou */
    }
  };

  const removeItem = (id: string) => {
    setItems((list) => {
      const it = list.find((i) => i.id === id);
      if (it?.preview) URL.revokeObjectURL(it.preview);
      return list.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
    setItems([]);
  };

  const sensitiveCount = items.reduce(
    (n, i) => n + (i.status !== "limpo" && i.entries.some((e) => e.sensitive) ? 1 : 0),
    0,
  );
  const readyCount = items.filter((i) => i.status === "pronto" || i.status === "erro").length;
  const reading = items.some((i) => i.status === "lendo");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Eraser className="size-4" /> Limpador de Metadados
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Tire seus dados das fotos e vídeos
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Remove localização, modelo do aparelho, datas e dados de edição. Os arquivos não saem do
          seu {device.isMobile ? "celular" : "computador"}: tudo é feito aqui mesmo, sem upload.
        </p>
      </header>

      {/* Área de arquivos */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/40 px-6 py-10 text-center transition-colors",
          dragging && "border-primary bg-primary/10",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Upload className="size-6" />
        </span>
        <div>
          <p className="font-medium">
            {device.isMobile
              ? "Escolha fotos e vídeos da galeria"
              : "Arraste fotos e vídeos para cá"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG, WebP, MP4, MOV · {device.isMobile ? "" : "ou "}vários de uma vez
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()} className="mt-1">
          {device.isMobile ? "Abrir galeria" : "Selecionar arquivos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,.heic,.mov,.mkv"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {engine === "carregando" && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Preparando o motor de vídeo (só na primeira vez)…
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Barra de ações */}
          <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/90 p-3 backdrop-blur md:top-4">
            <div className="mr-auto text-sm">
              <span className="font-medium">{items.length}</span>{" "}
              <span className="text-muted-foreground">arquivo{items.length > 1 ? "s" : ""}</span>
              {sensitiveCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-chart-3">
                  <AlertTriangle className="size-3.5" /> {sensitiveCount} com dados pessoais
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={busy}>
              <Trash2 className="size-4" /> Limpar lista
            </Button>
            {cleanedItems.length > 0 && canShareFiles && (
              <Button variant="secondary" size="sm" onClick={shareAll}>
                <Share2 className="size-4" /> Salvar / enviar
              </Button>
            )}
            {cleanedItems.length > 0 && (
              <Button variant="secondary" size="sm" onClick={downloadAll}>
                <Download className="size-4" />
                {cleanedItems.length > 1 ? `Baixar tudo (.zip)` : "Baixar"}
              </Button>
            )}
            <Button size="sm" onClick={cleanAll} disabled={busy || reading || readyCount === 0}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Eraser className="size-4" />}
              Limpar {readyCount > 0 ? readyCount : ""}
            </Button>
          </div>

          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((it) => (
              <FileCard
                key={it.id}
                item={it}
                tooBig={it.kind === "video" && it.file.size > device.maxVideoMB * 1024 * 1024}
                onRemove={() => removeItem(it.id)}
              />
            ))}
          </ul>
        </>
      )}

      {items.length === 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: MapPin,
              t: "Localização",
              d: "Coordenadas GPS de onde a foto ou vídeo foi feito.",
            },
            {
              icon: FileImage,
              t: "Aparelho",
              d: "Marca, modelo, lente e número de série da câmera.",
            },
            {
              icon: ShieldCheck,
              t: "Qualidade intacta",
              d: "JPG, PNG e vídeos saem sem recompressão.",
            },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-border bg-card/40 p-4">
              <c.icon className="mb-2 size-5 text-primary" />
              <p className="text-sm font-medium">{c.t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileCard({
  item,
  tooBig,
  onRemove,
}: {
  item: Item;
  tooBig: boolean;
  onRemove: () => void;
}) {
  const sensitive = item.entries.filter((e) => e.sensitive);
  const others = item.entries.filter((e) => !e.sensitive);

  return (
    <li className="flex gap-3 rounded-xl border border-border bg-card/60 p-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {item.preview ? (
          <img src={item.preview} alt="" className="size-full object-cover" />
        ) : (
          <FileVideo className="size-6 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(item.file.size)}
              {item.cleaned && ` → ${formatSize(item.cleaned.size)}`}
            </p>
          </div>
          <StatusBadge status={item.status} />
          {item.status !== "limpando" && (
            <button
              onClick={onRemove}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Remover"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {item.status === "limpando" && <Progress value={item.progress * 100} className="h-1.5" />}

        {item.status === "erro" && <p className="text-xs text-destructive">{item.error}</p>}

        {tooBig && item.status !== "limpo" && (
          <p className="text-xs text-chart-3">
            Vídeo grande para este aparelho. Pode demorar ou faltar memória; num PC vai mais rápido.
          </p>
        )}

        {item.status === "limpo" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-success">Nenhum metadado pessoal no arquivo novo.</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => downloadBlob(item.cleaned!, item.cleanedName!)}
            >
              <Download className="size-3.5" /> Baixar
            </Button>
          </div>
        ) : item.status !== "lendo" ? (
          item.entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum metadado encontrado.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sensitive.slice(0, 4).map((e, i) => (
                <Badge
                  key={`s${i}`}
                  variant="outline"
                  className="max-w-full border-chart-3/40 text-chart-3"
                >
                  <span className="truncate">
                    {e.label}: {e.value}
                  </span>
                </Badge>
              ))}
              {others.slice(0, 2).map((e, i) => (
                <Badge key={`o${i}`} variant="outline" className="max-w-full text-muted-foreground">
                  <span className="truncate">
                    {e.label}: {e.value}
                  </span>
                </Badge>
              ))}
              {item.entries.length > 6 && (
                <Badge variant="outline" className="text-muted-foreground">
                  +{item.entries.length - 6}
                </Badge>
              )}
            </div>
          )
        ) : null}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "lendo")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> lendo
      </span>
    );
  if (status === "limpando")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <Loader2 className="size-3.5 animate-spin" /> limpando
      </span>
    );
  if (status === "limpo")
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="size-3.5" /> limpo
      </span>
    );
  if (status === "erro")
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="size-3.5" /> erro
      </span>
    );
  return null;
}
