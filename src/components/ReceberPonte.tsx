import { useCallback, useEffect, useState } from "react";
import { Download, Inbox, Loader2, X } from "lucide-react";
import { Button, Input } from "./ui";
import { PONTE_KIT, baixarRecebido, codigoSalvo, esquecerRecebido, listarRecebidos, salvarCodigo, type Recebido } from "../lib/ponte";

/** Vídeos baixados pela extensão Minerador Viral através da Ponte NK (no PC do cliente). */
export default function ReceberPonte({ destino, usar, rotulo }: { destino: "mesa" | "cortes"; usar: (f: File) => Promise<void> | void; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState(codigoSalvo);
  const [itens, setItens] = useState<Recebido[]>([]);
  const [erro, setErro] = useState("");
  const [trazendo, setTrazendo] = useState("");

  const atualizar = useCallback(async () => {
    if (!codigo) return;
    try {
      setItens((await listarRecebidos(codigo)).filter((r) => r.destino === destino));
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [codigo, destino]);

  useEffect(() => {
    if (!aberto || !codigo) return;
    void atualizar();
    const t = setInterval(() => void atualizar(), 5000);
    return () => clearInterval(t);
  }, [aberto, codigo, atualizar]);

  const trazer = async (r: Recebido) => {
    setTrazendo(r.id);
    try {
      await usar(await baixarRecebido(codigo, r));
      await esquecerRecebido(codigo, r).catch(() => undefined);
      setItens((x) => x.filter((y) => y.id !== r.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setTrazendo("");
    }
  };

  return (
    <div className="rounded-xl border border-border">
      <button className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs" onClick={() => setAberto(!aberto)}>
        <span className="flex items-center gap-2 font-semibold">
          <Inbox className="size-4 text-lime" /> {rotulo}
          {itens.length > 0 && <span className="rounded-full bg-lime px-1.5 text-[10px] text-bg">{itens.length}</span>}
        </span>
        <span className="text-tmuted">{aberto ? "fechar" : "abrir"}</span>
      </button>
      {aberto && (
        <div className="space-y-3 border-t border-border p-3 text-xs">
          <p className="text-tmuted">
            Vídeos que a extensão <b>Minerador Viral</b> baixou no seu PC pela <b>Ponte NK</b> (botão ➜ Editor ou aba Link).{" "}
            <a href={PONTE_KIT} download className="text-lime underline">
              Baixar a Ponte NK
            </a>{" "}
            · <a href="/app/viral" className="text-lime underline">tutorial</a>
          </p>
          <div className="flex gap-2">
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Código da ponte (ex.: AB12-CD34)" className="!py-1.5 text-xs" />
            <Button
              variant="outline"
              className="!py-1.5 text-xs"
              onClick={() => {
                salvarCodigo(codigo);
                void atualizar();
              }}
            >
              Conectar
            </Button>
          </div>
          {erro && <p className="text-red-400">{erro}</p>}
          {codigo && !erro && !itens.length && <p className="text-tmuted">Nenhum vídeo novo. Mande pela extensão e eles aparecem aqui sozinhos.</p>}
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {itens.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg bg-surface2 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate" title={r.nome}>
                  {r.nome} <span className="text-tmuted">· {(r.tamanho / 1024 ** 2).toFixed(1)} MB</span>
                </span>
                <Button className="!px-2 !py-1 text-[11px]" disabled={!!trazendo} onClick={() => void trazer(r)}>
                  {trazendo === r.id ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                  {destino === "cortes" ? "Usar" : "➜ Mesa"}
                </Button>
                <button title="Esquecer" className="cursor-pointer text-tmuted hover:text-red-400" onClick={() => void esquecerRecebido(codigo, r).then(atualizar)}>
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
