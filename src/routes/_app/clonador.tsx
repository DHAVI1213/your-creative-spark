import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Code2,
  Copy,
  Download,
  Eye,
  FileArchive,
  Loader2,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { SiteManual } from "@/components/clonador/SiteManual";
import { VisualEditor, type VisualEditorHandle } from "@/components/clonador/VisualEditor";
import { SystemHeader, SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { clonePage, type ClonePageResult } from "@/lib/clonador";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/clonador")({
  head: () => ({ meta: [{ title: "Clonador de Sites · Fábrica de Conteúdo" }] }),
  component: Clonador,
});

type Mode = "ver" | "editar" | "codigo";

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

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "site"
  );
}

function Clonador() {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClonePageResult | null>(null);
  const [html, setHtml] = useState("");
  const [mode, setMode] = useState<Mode>("ver");
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const editorRef = useRef<VisualEditorHandle>(null);

  /** Lê de volta o HTML editado dentro do modo de edição. */
  const readEditedHtml = () => editorRef.current?.getHtml() ?? html;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (mode === "editar") setHtml(readEditedHtml());
    setMode(next);
  };

  const currentHtml = () => (mode === "editar" ? readEditedHtml() : html);

  const onClone = async () => {
    if (!authorized) {
      toast.error("Confirme que você tem autorização do dono do site.");
      return;
    }
    setLoading(true);
    try {
      const r = await clonePage({ data: { url } });
      setResult(r);
      setHtml(r.html);
      setMode("ver");
      toast.success("Site clonado. Agora é só editar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para clonar esse site.");
    } finally {
      setLoading(false);
    }
  };

  const downloadHtml = () => {
    const out = currentHtml();
    if (mode === "editar") setHtml(out);
    downloadBlob(new Blob([out], { type: "text/html" }), `${slug(result?.title ?? "site")}.html`);
  };

  const downloadZip = async () => {
    if (!result) return;
    const out = currentHtml();
    if (mode === "editar") {
      setHtml(out);
      setMode("ver");
    }
    setZipProgress(0);
    try {
      const { buildSiteZip } = await import("@/lib/clonador-zip");
      const rep = await buildSiteZip(out, result.finalUrl, (d, t) => setZipProgress(t ? d / t : 1));
      downloadBlob(rep.blob, `${slug(result.title)}.zip`);
      toast.success(
        `${rep.saved} arquivos salvos no .zip` +
          (rep.failed ? ` · ${rep.failed} não baixaram (ficam ligados ao site original)` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para montar o .zip.");
    } finally {
      setZipProgress(null);
    }
  };

  const copyCode = async () => {
    const out = currentHtml();
    await navigator.clipboard.writeText(out);
    toast.success("Código copiado.");
  };

  return (
    <div className="space-y-6">
      <SystemHeader
        label="HAB-02 · Clonador de Sites"
        icon={Copy}
        title="Clonador de Sites"
        description="Copie um site com autorização do dono, edite tudo no editor visual e use os prompts prontos para criar sites novos com IA."
      />

      <SystemWindow title="Alvo" className="sys-pop">
        <form
          className="space-y-4 p-4 md:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            onClone();
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://site-do-cliente.com.br"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className="h-11 font-mono"
            />
            <Button
              type="submit"
              className="sys-btn-glow h-11 sm:w-40"
              disabled={loading || !url.trim()}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
              Clonar
            </Button>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
            <Checkbox
              checked={authorized}
              onCheckedChange={(v) => setAuthorized(v === true)}
              className="mt-0.5"
            />
            <span>
              <ShieldCheck className="mr-1 inline size-4 text-primary" />
              Confirmo que sou o dono deste site ou tenho autorização do dono para copiar e editar.
            </span>
          </label>
        </form>
      </SystemWindow>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
            <Stat label="Scripts" value={result.stats.scripts} />
            <Stat label="Estilos" value={result.stats.styles} />
            <Stat label="Imagens" value={result.stats.images} />
            <Stat label="3D / Canvas" value={result.stats.has3d ? "sim" : "não"} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-sm border border-primary/30 p-0.5">
              <ModeButton active={mode === "ver"} onClick={() => switchMode("ver")} icon={Eye}>
                Ver
              </ModeButton>
              <ModeButton
                active={mode === "editar"}
                onClick={() => switchMode("editar")}
                icon={PencilLine}
              >
                Editar
              </ModeButton>
              <ModeButton
                active={mode === "codigo"}
                onClick={() => switchMode("codigo")}
                icon={Code2}
              >
                Código
              </ModeButton>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={copyCode}>
                <Copy className="size-4" /> Copiar código
              </Button>
              <Button variant="secondary" size="sm" onClick={downloadHtml}>
                <Download className="size-4" /> HTML
              </Button>
              <Button size="sm" onClick={downloadZip} disabled={zipProgress !== null}>
                {zipProgress !== null ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileArchive className="size-4" />
                )}
                Site completo (.zip)
              </Button>
            </div>
          </div>

          {zipProgress !== null && (
            <div className="space-y-1">
              <Progress value={zipProgress * 100} className="h-1.5" />
              <p className="font-mono text-xs text-muted-foreground">
                Baixando imagens, estilos, scripts e fontes…
              </p>
            </div>
          )}

          <SystemWindow muted className="overflow-hidden">
            {mode === "codigo" ? (
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                className="block h-[70dvh] w-full resize-none bg-background/60 p-4 font-mono text-xs leading-5 text-foreground outline-none"
              />
            ) : mode === "editar" ? (
              <VisualEditor ref={editorRef} html={html} />
            ) : (
              <iframe
                key="ver"
                title="Prévia do site"
                srcDoc={html}
                sandbox="allow-scripts allow-forms allow-popups"
                className="block h-[70dvh] w-full bg-white"
              />
            )}
          </SystemWindow>

          <p className="text-xs text-muted-foreground">
            O <b>HTML</b> continua puxando imagens e scripts do site original. O <b>.zip</b> traz os
            arquivos junto — sites muito dinâmicos podem carregar algumas partes do original mesmo
            assim.
          </p>

          <SiteManual html={html} url={result.finalUrl} />
        </>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-xs uppercase tracking-wider transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="sys-panel sys-panel-muted rounded-sm px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}
