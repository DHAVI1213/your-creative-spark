import { useEffect, useRef, useState } from "react";
import { Film, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDevice } from "@/lib/device";
import { useAuth } from "@/lib/auth";
import { servicoEditor } from "@/lib/editor-original/servicos";
import { SystemHeader } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { receberNoEditor } from "@/lib/viral/transferencia";

type EditorWindow = Window & {
  importarVideosMinerador?: (files: File[]) => Promise<number[]>;
  iniciarEditor?: (deps: {
    criarFFmpeg: typeof criarFFmpeg;
    servidor: typeof servidor;
    maxVideoMB: number;
    abrirConexoes: () => void;
    usuario: string;
  }) => Promise<void>;
  api?: { destruir: () => void };
  atualizarConexoesEditor?: () => Promise<void>;
};
async function criarFFmpeg() {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);
  const ffmpeg = new FFmpeg();
  const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
  const js = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
  const wasm = await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm");
  try {
    await ffmpeg.load({ coreURL: js, wasmURL: wasm });
    return ffmpeg;
  } catch (e) {
    ffmpeg.terminate();
    throw e;
  } finally {
    URL.revokeObjectURL(js);
    URL.revokeObjectURL(wasm);
  }
}
async function servidor(acao: string, payload: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Entre na sua conta novamente.");
  return servicoEditor({ data: { token, acao: acao as "configurar", payload } });
}

export function EditorOriginal() {
  const frame = useRef<HTMLIFrameElement>(null);
  const encerrar = useRef<(() => void) | undefined>(undefined);
  const { maxVideoMB, ready } = useDevice();
  const { user } = useAuth();
  const [configurando, setConfigurando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => () => encerrar.current?.(), []);
  async function iniciar() {
    try {
      await (frame.current?.contentWindow as EditorWindow | null)?.iniciarEditor?.({
        criarFFmpeg,
        servidor,
        maxVideoMB,
        abrirConexoes: () => setConfigurando(true),
        usuario: user?.id ?? "",
      });
      encerrar.current = (frame.current?.contentWindow as EditorWindow | null)?.api?.destruir;
      const editor = frame.current?.contentWindow as EditorWindow | null;
      if (user && editor?.importarVideosMinerador) {
        try {
          const lote = await receberNoEditor(user.id, (files) =>
            editor.importarVideosMinerador!(files),
          );
          if (lote?.importados)
            toast.success(`${lote.importados} vídeo(s) do minerador chegaram na mesa.`);
          if (lote?.pendentes)
            toast.error(
              `${lote.pendentes} vídeo(s) não puderam ser importados e foram preservados. Recarregue para tentar novamente.`,
            );
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Não foi possível receber os vídeos do minerador.",
          );
        }
      }
    } catch {
      setErro("Não foi possível abrir o editor. Recarregue esta página.");
    }
  }
  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    const form = new FormData(e.currentTarget),
      valores: Record<string, unknown> = {};
    for (const [key, value] of form)
      if (typeof value === "string" && value.trim()) valores[key] = value.trim();
    try {
      await servidor("configurar", valores);
      toast.success("Conexões salvas no servidor.");
      setConfigurando(false);
      await (frame.current?.contentWindow as EditorWindow | null)?.atualizarConexoesEditor?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SystemHeader
          label="Estúdio"
          title="Editor em Massa"
          icon={Film}
          description="Edite um vídeo, aplique ao lote e exporte."
        />
        <Button variant="outline" onClick={() => setConfigurando(true)}>
          <Settings className="size-4" />
          Conexões de IA e agenda
        </Button>
      </div>
      {erro && (
        <p role="alert" className="text-destructive">
          {erro}
        </p>
      )}
      {ready && (
        <iframe
          ref={frame}
          src="/editor-original/index.html"
          title="Estúdio do Editor em Massa"
          className="block w-full rounded-sm border border-primary/25 bg-background"
          style={{ height: "max(680px, calc(100dvh - 155px))" }}
          onLoad={() => void iniciar()}
          allow="fullscreen"
        />
      )}
      <Dialog open={configurando} onOpenChange={setConfigurando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conexões de IA e agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            As chaves ficam na sua conta, no servidor. Deixe um campo vazio para manter a conexão
            atual. Legendas automáticas usam OpenAI.
          </p>
          <form onSubmit={(e) => void salvar(e)} className="space-y-3">
            {(
              [
                ["openai", "Chave OpenAI"],
                ["gemini", "Chave Gemini"],
                ["claude", "Chave Claude"],
                ["cloudUrl", "Endereço da sua nuvem (https://…workers.dev)"],
                ["cloudKey", "Chave da sua nuvem"],
              ] as const
            ).map(([name, label]) => (
              <div key={name} className="space-y-1">
                <Label htmlFor={`editor-${name}`}>{label}</Label>
                <Input
                  id={`editor-${name}`}
                  name={name}
                  type={name === "cloudUrl" ? "url" : "password"}
                  autoComplete="off"
                  maxLength={500}
                />
              </div>
            ))}
            <Button type="submit" disabled={salvando} className="w-full">
              {salvando ? "Salvando…" : "Salvar conexões"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
