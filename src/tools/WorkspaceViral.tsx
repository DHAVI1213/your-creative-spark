import { useState } from "react";
import ExtensaoCard from "../components/ExtensaoCard";
import { PONTE_KIT } from "../lib/ponte";
import { BookmarkPlus, ExternalLink, Lightbulb, Trash2 } from "lucide-react";
import {
  NICHOS_VIRAIS,
  listarReferencias,
  referenciasDoNicho,
  removerReferencia,
  salvarReferencia,
  type ReferenciaViral,
} from "../lib/viral";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "../components/ui";
import { cn } from "../lib/utils";

function IdeiasDeFormato() {
  const [nicho, setNicho] = useState(NICHOS_VIRAIS[0]!.id);
  const [url, setUrl] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [salvas, setSalvas] = useState(listarReferencias);
  const [expandida, setExpandida] = useState<string | null>(null);

  const refs = referenciasDoNicho(nicho);

  const salvar = (r: ReferenciaViral) => {
    salvarReferencia({ ...r, url: url.trim(), anotacao: anotacao.trim() });
    setSalvas(listarReferencias());
    setUrl("");
    setAnotacao("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-48 flex-1">
              <Label>Nicho</Label>
              <Select value={nicho} onChange={(e) => setNicho(e.target.value)}>
                {NICHOS_VIRAIS.map((n) => (
                  <option key={n.id} value={n.id}>{n.nome}</option>
                ))}
              </Select>
            </div>
          </div>
          <p className="mt-3 text-xs text-tmuted">
            Painel de formatos que performam no nicho — use como referência para criar os seus.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {refs.map((r) => (
            <Card key={r.id} className={cn("p-5", expandida === r.id && "border-lime/50")}>
              <div className="flex items-start justify-between gap-2">
                <Badge tone="lime">{r.formato}</Badge>
                <span className="text-xs text-tmuted">{r.duracao}</span>
              </div>
              <h3 className="mt-3 font-bold leading-snug">{r.titulo}</h3>
              <p className="mt-1 text-sm text-tsecondary">{r.descricao}</p>
              <div className="mt-3 flex gap-4 text-xs">
                <span><strong className="text-lime">{r.views}</strong> <span className="text-tmuted">views</span></span>
                <span><strong className="text-lime">{r.engajamento}</strong> <span className="text-tmuted">engaj.</span></span>
              </div>
              <button
                onClick={() => setExpandida(expandida === r.id ? null : r.id)}
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-lime cursor-pointer"
              >
                <Lightbulb className="size-3.5" />
                {expandida === r.id ? "Ocultar análise" : "Por que funciona"}
              </button>
              {expandida === r.id && (
                <div className="mt-3 space-y-2 rounded-xl bg-surface2 p-3 text-xs">
                  <p><span className="text-tmuted">Gancho:</span> <span className="text-tprimary">{r.gancho}</span></p>
                  <p><span className="text-tmuted">Análise:</span> <span className="text-tprimary">{r.porQueFunciona}</span></p>
                  <div className="pt-1">
                    <Label>Link do vídeo de referência (opcional)</Label>
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/reel/..." className="!py-2 text-xs" />
                  </div>
                  <div>
                    <Label>Sua anotação</Label>
                    <Textarea value={anotacao} onChange={(e) => setAnotacao(e.target.value)} placeholder="O que vou adaptar..." className="!py-2 text-xs min-h-[60px]" />
                  </div>
                  <Button onClick={() => salvar(r)} className="!py-2 text-xs w-full">
                    <BookmarkPlus className="size-3.5" /> Salvar na minha pasta
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Card className="lg:sticky lg:top-6">
          <h2 className="mb-4 text-lg font-bold">Minha pasta ({salvas.length})</h2>
          {salvas.length === 0 ? (
            <p className="py-6 text-center text-sm text-tmuted">
              Salve referências com link e anotação para consultar depois.
            </p>
          ) : (
            <div className="max-h-[560px] space-y-3 overflow-y-auto">
              {salvas.map((s) => (
                <div key={s.id} className="rounded-xl border border-border p-3">
                  <p className="text-sm font-semibold">{s.titulo}</p>
                  {s.anotacao && <p className="mt-1 text-xs text-tsecondary">{s.anotacao}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-lime">
                        <ExternalLink className="size-3" /> Abrir referência
                      </a>
                    ) : <span />}
                    <button
                      onClick={() => { removerReferencia(s.id); setSalvas(listarReferencias()); }}
                      className="text-tmuted hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function WorkspaceViral() {
  return (
    <div className="space-y-6">
      <ExtensaoCard
        nome="Minerador Viral"
        arquivo="/downloads/minerador-viral.zip"
        versao="1.3.0"
        resumo="Encontra os vídeos que mais performaram num perfil do Instagram, TikTok ou YouTube Shorts (acima da média, potencial viral, mais vistos…), baixa em massa e manda direto para o Editor em Massa e os Cortes Virais."
        usar={[
          <>Clique no ícone 📈 da extensão: o painel abre do lado da página.</>,
          <>Abra um perfil (logado): instagram.com/perfil, tiktok.com/@perfil ou a aba Shorts de um canal do YouTube.</>,
          <>Escolha o ranking, quantos vídeos quer e os filtros mínimos, e clique em <b>⛏ Minerar perfil</b> (ou em ☝ Escolher direto na página).</>,
          <>Marque os vídeos e use <b>⬇ ZIP</b> (Instagram, direto pelo navegador), <b>⋯</b> para planilha e links, ou <b>➜ Editor</b> para mandar para o site.</>,
          <>Aba <b>🔗 Link</b>: cole links de vídeo do YouTube, TikTok ou Instagram (com autorização do dono) para baixar e cortar.</>,
        ]}
        extra={
          <div className="rounded-xl border border-lime/30 bg-lime/5 p-4 text-xs text-tsecondary">
            <p className="font-semibold text-tprimary">➜ Editor e aba Link: precisam da Ponte NK aberta no seu PC</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Instale o Node.js (LTS) em nodejs.org.</li>
              <li>
                <a href={PONTE_KIT} download className="text-lime underline">Baixe a Ponte NK</a>, descompacte e dê dois cliques em <b>iniciar-ponte.bat</b> (Mac: iniciar-ponte.command). Deixe a
                janela aberta: ela baixa TikTok e YouTube com o yt-dlp (só na primeira vez demora um pouco).
              </li>
              <li>Na janela aparece o <b>código da ponte</b>. No site, em Editor em Massa → <b>Receber do Minerador Viral</b>, cole o código uma vez só.</li>
              <li>Os vídeos ficam em Downloads/Minerador e aparecem no Editor (botão ➜ Mesa) ou nos Cortes Virais (links do YouTube).</li>
            </ol>
            <p className="mt-2 text-tmuted">Se o Chrome perguntar se o site pode acessar a sua rede local, clique em Permitir. Sem a ponte, o ⬇ ZIP do Instagram continua funcionando.</p>
          </div>
        }
      />
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">Ideias de formato por nicho</summary>
        <div className="mt-4">
          <IdeiasDeFormato />
        </div>
      </details>
    </div>
  );
}
