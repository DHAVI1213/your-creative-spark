import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/lib/device";
import { useEditor } from "@/lib/editor/store";

export function AreaDeEnvio() {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const { maxVideoMB } = useDevice();
  const { adicionar, carregando } = useEditor();
  const enviar = (files: File[]) => {
    const validos = files.filter((file) => {
      if (!file.type.startsWith("video/")) {
        toast.error(`${file.name}: escolha um arquivo de vídeo.`);
        return false;
      }
      if (file.size > maxVideoMB * 1024 * 1024) {
        toast.error(`${file.name}: o limite neste aparelho é ${maxVideoMB} MB por vídeo.`);
        return false;
      }
      return true;
    });
    void adicionar(validos);
  };
  return (
    <SystemWindow title="Envie seus vídeos">
      <div
        className={`space-y-3 p-6 text-center ${arrastando ? "bg-primary/10" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(event) => {
          event.preventDefault();
          setArrastando(false);
          enviar(Array.from(event.dataTransfer.files));
        }}
      >
        <Upload className="mx-auto size-7 text-primary" />
        <p className="text-sm">Arraste seus vídeos para cá ou escolha os arquivos.</p>
        <Button onClick={() => input.current?.click()}>Escolher vídeos</Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="video/*"
          className="hidden"
          aria-label="Escolher vídeos"
          onChange={(event) => {
            enviar(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <p className="text-xs text-muted-foreground">
          Até 50 vídeos na mesa · até {maxVideoMB} MB por vídeo
        </p>
        {carregando && (
          <p role="status" className="text-sm text-primary">
            Lendo seus vídeos…
          </p>
        )}
      </div>
    </SystemWindow>
  );
}
