import type { ReactNode } from "react";
import { Download, Puzzle } from "lucide-react";
import { Card } from "./ui";

/** Cartão de uma extensão do Chrome: o que faz, botão de baixar e mini tutorial de instalar e usar. */
export default function ExtensaoCard({
  nome,
  arquivo,
  versao,
  resumo,
  usar,
  extra,
}: {
  nome: string;
  arquivo: string;
  versao: string;
  resumo: string;
  usar: ReactNode[];
  extra?: ReactNode;
}) {
  const pasta = arquivo.replace(/^.*\//, "").replace(/\.zip$/, "");
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime">
            <Puzzle className="size-5" />
          </span>
          <div>
            <h2 className="font-bold">
              Extensão {nome} <span className="text-xs font-normal text-tmuted">v{versao} · Chrome e Edge</span>
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-tsecondary">{resumo}</p>
          </div>
        </div>
        <a href={arquivo} download className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-bg">
          <Download className="size-4" /> Baixar extensão
        </a>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-surface2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Instalar (uma vez)</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-tsecondary">
            <li>Baixe e descompacte o ZIP numa pasta que você não vai apagar (ex.: Documentos\{pasta}).</li>
            <li>No Chrome, abra <b>chrome://extensions</b> (no Edge: edge://extensions).</li>
            <li>Ligue o <b>Modo do desenvolvedor</b> (canto de cima, à direita).</li>
            <li>Clique em <b>Carregar sem compactação</b> e escolha a pasta {pasta}.</li>
            <li>Clique no ícone de quebra-cabeça do Chrome e <b>fixe</b> a extensão na barra.</li>
          </ol>
          <p className="mt-2 text-[11px] text-tmuted">Atualizou? Baixe de novo, substitua a pasta e clique no botão de recarregar (seta circular) da extensão em chrome://extensions.</p>
        </div>
        <div className="rounded-xl bg-surface2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Usar</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-tsecondary">
            {usar.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ol>
        </div>
      </div>
      {extra}
    </Card>
  );
}
