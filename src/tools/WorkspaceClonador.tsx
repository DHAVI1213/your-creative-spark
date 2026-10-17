import { useState } from "react";
import ExtensaoCard from "../components/ExtensaoCard";
import { Code2, Download, FileArchive, Globe, Loader2, Pencil, ShieldAlert } from "lucide-react";
import {
  clonePageHtml,
  clonePageUrl,
  type ClonePageResult,
} from "../lib/clonador";
import { detectarRecursos, prepararPrevia } from "../lib/clonador-analise";
import { buildSiteZip } from "../lib/clonador-zip";
import { baixarBlob } from "../lib/utils";
import { Badge, Button, Card, Input, Label, Progress, Textarea } from "../components/ui";

type Etapa = "entrada" | "analise";

function ClonadorRapido() {
  const [modo, setModo] = useState<"url" | "colar">("url");
  const [url, setUrl] = useState("");
  const [htmlColado, setHtmlColado] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<ClonePageResult | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("entrada");
  const [busca, setBusca] = useState("");
  const [troca, setTroca] = useState("");
  const [zipProg, setZipProg] = useState<number | null>(null);
  const [zipMsg, setZipMsg] = useState("");

  const buscar = async () => {
    setErro("");
    setCarregando(true);
    try {
      const r =
        modo === "url" ? await clonePageUrl(url) : clonePageHtml(htmlColado, url);
      setResultado(r);
      setEtapa("analise");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao obter a página.");
    } finally {
      setCarregando(false);
    }
  };

  const aplicarTroca = () => {
    if (!resultado || !busca) return;
    const html = resultado.html.split(busca).join(troca);
    setResultado({ ...resultado, html });
    setBusca("");
    setTroca("");
  };

  const baixarHtml = () => {
    if (!resultado) return;
    baixarBlob(
      new Blob([resultado.html], { type: "text/html;charset=utf-8" }),
      "site-clonado.html",
    );
  };

  const baixarZip = async () => {
    if (!resultado) return;
    setZipProg(0);
    setZipMsg("");
    try {
      const rel = await buildSiteZip(resultado.html, resultado.finalUrl, (d, t) =>
        setZipProg(t ? d / t : 0),
      );
      baixarBlob(rel.blob, "site-clonado.zip");
      setZipMsg(
        `${rel.saved} arquivos salvos · ${rel.failed} falharam (ficaram ligados ao original) · ${rel.skipped} pulados`,
      );
    } catch (e) {
      setZipMsg(e instanceof Error ? e.message : "Falha ao montar o zip.");
    } finally {
      setZipProg(null);
    }
  };

  const recursos = resultado ? detectarRecursos(resultado.html) : [];

  if (etapa === "entrada") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <div className="mb-6 grid grid-cols-2 gap-2">
            {(["url", "colar"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold cursor-pointer transition-all ${
                  modo === m ? "border-lime bg-lime/10 text-lime" : "border-border text-tsecondary"
                }`}
              >
                {m === "url" ? "Buscar pelo endereço" : "Colar HTML"}
              </button>
            ))}
          </div>
          {modo === "url" ? (
            <div>
              <Label>Endereço do site</Label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://site-do-cliente.com.br"
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                />
                <Button onClick={buscar} disabled={carregando}>
                  {carregando ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
                  Clonar
                </Button>
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs text-tmuted">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                Clone apenas com autorização do dono. Alguns sites bloqueiam a leitura direta
                (CORS) — nesse caso use o modo “Colar HTML”.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Código-fonte da página (Ctrl+U no navegador, copiar tudo)</Label>
                <Textarea
                  value={htmlColado}
                  onChange={(e) => setHtmlColado(e.target.value)}
                  placeholder="<html>..."
                  className="min-h-[160px] font-mono text-xs"
                />
              </div>
              <div>
                <Label>Endereço original (para resolver imagens e links)</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://site-do-cliente.com.br" />
              </div>
              <Button onClick={buscar} disabled={carregando}>
                {carregando ? <Loader2 className="size-4 animate-spin" /> : <Code2 className="size-4" />}
                Analisar HTML
              </Button>
            </div>
          )}
          {erro && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{erro}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{resultado?.title}</h2>
          <p className="text-sm text-tmuted">{resultado?.finalUrl}</p>
        </div>
        <Button variant="ghost" onClick={() => { setEtapa("entrada"); setResultado(null); }}>
          ← Novo site
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Scripts", resultado!.stats.scripts],
          ["Estilos", resultado!.stats.styles],
          ["Imagens", resultado!.stats.images],
          ["3D/WebGL", resultado!.stats.has3d ? "Sim" : "Não"],
        ].map(([l, v]) => (
          <Card key={l} className="p-4 text-center">
            <p className="text-2xl font-bold text-lime">{v}</p>
            <p className="text-xs text-tmuted">{l}</p>
          </Card>
        ))}
      </div>

      {recursos.length > 0 && (
        <Card>
          <h3 className="mb-3 font-bold">Tecnologias detectadas</h3>
          <div className="flex flex-wrap gap-2">
            {recursos.map((r, i) => (
              <Badge key={i}>{r.nome}</Badge>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="mb-4 flex items-center gap-2 font-bold">
          <Pencil className="size-4 text-lime" /> Editar textos
        </h3>
        <div className="flex flex-col gap-2 md:flex-row">
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Texto original" className="flex-1" />
          <Input value={troca} onChange={(e) => setTroca(e.target.value)} placeholder="Novo texto" className="flex-1" />
          <Button onClick={aplicarTroca} disabled={!busca}>Substituir tudo</Button>
        </div>
        <p className="mt-2 text-xs text-tmuted">Substitui todas as ocorrências no HTML. Repita para cada texto.</p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-bold">Prévia</h3>
          <div className="flex gap-2">
            <Button variant="dark" onClick={baixarHtml} className="!py-2 text-xs">
              <Download className="size-3.5" /> Baixar HTML
            </Button>
            <Button onClick={baixarZip} disabled={zipProg !== null} className="!py-2 text-xs">
              {zipProg !== null ? <Loader2 className="size-3.5 animate-spin" /> : <FileArchive className="size-3.5" />}
              Baixar .zip completo
            </Button>
          </div>
        </div>
        {zipProg !== null && <div className="px-6 pt-4"><Progress value={zipProg} /></div>}
        {zipMsg && <p className="px-6 pt-3 text-xs text-tsecondary">{zipMsg}</p>}
        <iframe
          title="Prévia do site"
          srcDoc={prepararPrevia(resultado!.html)}
          sandbox="allow-scripts"
          className="h-[600px] w-full bg-white"
        />
      </Card>
    </div>
  );
}

export default function WorkspaceClonador() {
  return (
    <div className="space-y-6">
      <ExtensaoCard
        nome="Clonador de Sites"
        arquivo="/downloads/clonador-de-sites.zip"
        versao="1.3.0"
        resumo="Copia um site do jeito que aparece na tela (ou completo, com animações e 3D), deixa editar textos, imagens, WhatsApp e cores antes de baixar, copia só um componente para a Lovable e manda o projeto pronto para o GitHub. Use só em sites com autorização do dono."
        usar={[
          <>Abra o site e clique no ícone da extensão.</>,
          <><b>Cópia visual</b>: a página como aparece, sem scripts (ótima para editar). <b>Cópia completa</b>: leva JavaScript, animações e 3D; para abrir, extraia o ZIP e dê dois cliques em ABRIR-SITE.bat.</>,
          <><b>Editar antes de copiar</b>: clique em qualquer parte para trocar texto, imagem, link, nome da loja, WhatsApp e cores (Ctrl+Z desfaz).</>,
          <><b>Copiar só um componente</b>: passe o mouse, clique no bloco e exporte em HTML ou React (.tsx) para a Lovable.</>,
          <><b>Projeto para Lovable/GitHub</b>: gera um projeto pronto; marque “Enviar para o GitHub”, escreva o repositório e cole um token só daquele repositório.</>,
        ]}
        extra={<p className="text-[11px] text-tmuted">Dica: em “Detalhes” da extensão, ligue “Permitir acesso a URLs de arquivo” para editar também as cópias abertas do seu PC. Os arquivos vão para Downloads\copias-de-sites.</p>}
      />
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">Versão rápida no navegador (sem extensão, só para sites simples)</summary>
        <div className="mt-4">
          <ClonadorRapido />
        </div>
      </details>
    </div>
  );
}
