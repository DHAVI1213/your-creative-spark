import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Flame,
  Search,
  Download,
  Film,
  Settings,
  Loader2,
  ExternalLink,
  Eye,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { zip } from "fflate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SystemHeader, SystemWindow } from "@/components/system/System";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useDevice } from "@/lib/device";
import { minerar } from "@/lib/viral/servico";
import { filtrarVideos, lerPerfil, type Ranking, type VideoViral } from "@/lib/viral/modelo";
import { guardarNoEditor } from "@/lib/viral/transferencia";

const formatar = (n: number | null) =>
  n === null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const erro = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === "object" && e !== null && "message" in e
      ? String(e.message)
      : "Não foi possível concluir. Tente novamente.";
export function MineradorViral() {
  const { user, isAdmin } = useAuth(),
    { maxVideoMB } = useDevice(),
    navigate = useNavigate();
  const [perfil, setPerfil] = useState(""),
    [limite, setLimite] = useState(100),
    [videos, setVideos] = useState<VideoViral[]>([]),
    [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState(new Set<string>()),
    [ranking, setRanking] = useState<Ranking>("viral");
  const [views, setViews] = useState(0),
    [likes, setLikes] = useState(0),
    [viral, setViral] = useState(0),
    [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false),
    [progresso, setProgresso] = useState(""),
    [mensagem, setMensagem] = useState("");
  const [configurado, setConfigurado] = useState<boolean | null>(null),
    [conexoes, setConexoes] = useState(false),
    [chave, setChave] = useState(""),
    [salvando, setSalvando] = useState(false);
  const vivo = useRef(true),
    cancelado = useRef(false),
    timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  useEffect(() => {
    vivo.current = true;
    const pendentes = timers.current;
    return () => {
      vivo.current = false;
      cancelado.current = true;
      for (const [id, resolve] of pendentes) {
        clearTimeout(id);
        resolve();
      }
      pendentes.clear();
    };
  }, []);
  async function chamar(
    acao: "config" | "iniciar" | "consultar" | "preparar" | "arquivo",
    extra: Record<string, unknown> = {},
  ) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Entre na sua conta novamente.");
    return minerar({ data: { token: data.session.access_token, acao, ...extra } });
  }
  useEffect(() => {
    let ativo = true;
    void chamar("config")
      .then((r) => {
        if (ativo) setConfigurado(r.configurado);
      })
      .catch((e) => {
        if (ativo) setMensagem(erro(e));
      });
    return () => {
      ativo = false;
    };
  }, []);
  async function esperar() {
    await new Promise<void>((resolve) => {
      const id = setTimeout(() => {
        timers.current.delete(id);
        resolve();
      }, 4000);
      timers.current.set(id, resolve);
    });
    if (!vivo.current || cancelado.current)
      throw new Error(
        "Espera interrompida. A coleta iniciada na nuvem pode continuar consumindo saldo; o dono pode encerrá-la no painel Apify.",
      );
  }
  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    try {
      lerPerfil(perfil);
    } catch (e) {
      setMensagem(erro(e));
      return;
    }
    setOcupado(true);
    cancelado.current = false;
    setMensagem("");
    setVideos([]);
    setSelecionados(new Set());
    setProgresso("Localizando o perfil e coletando vídeos…");
    try {
      const inicio = await chamar("iniciar", { perfil, limite });
      if (!inicio.busca) throw new Error("Não foi possível iniciar a busca.");
      setBusca(inicio.busca);
      for (let i = 0; i < 300; i++) {
        await esperar();
        const r = await chamar("consultar", { busca: inicio.busca });
        if (r.status === "pronto") {
          setVideos(r.videos);
          if (!r.videos.length) setMensagem("Nenhum vídeo público encontrado neste perfil.");
          return;
        }
      }
      throw new Error("A busca demorou mais de 20 minutos. Tente novamente mais tarde.");
    } catch (e) {
      if (vivo.current) setMensagem(erro(e));
    } finally {
      if (vivo.current) {
        setOcupado(false);
        setProgresso("");
      }
    }
  }
  const filtrados = filtrarVideos(videos, { views, likes, viral, texto, ranking }),
    escolhidos = [...selecionados]
      .map((id) => videos.find((v) => v.id === id))
      .filter((v): v is VideoViral => v !== undefined);
  function selecionar(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 50) n.add(id);
      else toast.error("Selecione até 50 vídeos por lote.");
      return n;
    });
  }
  async function baixar(destino: "zip" | "editor") {
    setOcupado(true);
    cancelado.current = false;
    setMensagem("");
    const arquivos: File[] = [];
    let total = 0;
    try {
      setProgresso("Preparando os vídeos selecionados…");
      let pronto = false;
      for (let i = 0; i < 300; i++) {
        if (cancelado.current) throw new Error("Download interrompido.");
        const r = await chamar("preparar", { busca, ids: escolhidos.map((v) => v.id) });
        if (r.status === "pronto") {
          pronto = true;
          break;
        }
        await esperar();
      }
      if (!pronto) throw new Error("A preparação demorou demais. Tente novamente mais tarde.");
      for (const [i, v] of escolhidos.entries()) {
        if (cancelado.current || !vivo.current) throw new Error("Download interrompido.");
        setProgresso(`Baixando ${i + 1} de ${escolhidos.length}…`);
        try {
          const r = await chamar("arquivo", { busca, id: v.id });
          if (!r.base64 || !r.nome) throw new Error("O serviço não devolveu o arquivo.");
          const bin = atob(r.base64),
            bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          total += bytes.length;
          if (total > Math.min(200, maxVideoMB) * 1024 * 1024)
            throw new Error("O lote ficou grande demais. Selecione menos vídeos.");
          arquivos.push(
            new File([bytes], r.nome, {
              type: r.nome.endsWith("webm") ? "video/webm" : "video/mp4",
            }),
          );
        } catch (e) {
          throw new Error(`${v.titulo.slice(0, 60)}: ${erro(e)}`);
        }
      }
      if (cancelado.current || !vivo.current) throw new Error("Download interrompido.");
      if (destino === "editor") {
        if (!user) throw new Error("Entre novamente.");
        setProgresso("Enviando para o editor…");
        await guardarNoEditor(user.id, arquivos);
        await navigate({ to: "/editor" });
      } else {
        setProgresso("Montando o ZIP…");
        const conteudo: Record<string, Uint8Array> = {};
        for (const f of arquivos) conteudo[f.name] = new Uint8Array(await f.arrayBuffer());
        const dados = await new Promise<Uint8Array>((resolve, reject) =>
          zip(conteudo, { level: 0 }, (err, bytes) => (err ? reject(err) : resolve(bytes))),
        );
        if (cancelado.current || !vivo.current) return;
        const url = URL.createObjectURL(
            new Blob([new Uint8Array(dados)], { type: "application/zip" }),
          ),
          a = document.createElement("a");
        a.href = url;
        a.download = "videos-virais.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast.success("ZIP preparado com os vídeos selecionados.");
      }
    } catch (e) {
      if (vivo.current) setMensagem(erro(e));
    } finally {
      if (vivo.current) {
        setOcupado(false);
        setProgresso("");
      }
    }
  }
  async function salvar() {
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("admin_set_secret", {
        _chave: "apify_token",
        _valor: chave.trim(),
      });
      if (error) throw error;
      setChave("");
      setConfigurado((await chamar("config")).configurado);
      setConexoes(false);
      toast.success("Serviço conectado.");
    } catch (e) {
      toast.error(erro(e));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SystemHeader
          label="Habilidade 04"
          title="Minerador Viral"
          icon={Flame}
          description="Encontre os vídeos que mais performam e leve os selecionados direto para sua mesa de edição."
        />
        {isAdmin && (
          <Button variant="outline" onClick={() => setConexoes(true)}>
            <Settings className="size-4" />
            Conectar serviço
          </Button>
        )}
      </div>
      {configurado === false && (
        <div className="sys-panel sys-panel-muted rounded-sm p-4 text-sm text-muted-foreground">
          A busca por perfil aguarda a conexão do serviço de coleta.
          {isAdmin
            ? " Use Conectar serviço para configurar."
            : " O dono do aplicativo precisa concluir a configuração."}
        </div>
      )}
      <SystemWindow title="[ Localizar perfil ]">
        <form onSubmit={(e) => void buscar(e)} className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="perfil-viral">Link do perfil</Label>
            <Input
              id="perfil-viral"
              value={perfil}
              onChange={(e) => setPerfil(e.target.value)}
              placeholder="instagram.com/perfil, tiktok.com/@perfil ou youtube.com/@canal"
              disabled={ocupado}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="limite-viral">Vídeos para analisar</Label>
            <select
              id="limite-viral"
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
              className="h-9 rounded-sm border border-input bg-background px-3 text-sm"
              disabled={ocupado}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <Button disabled={ocupado || configurado !== true || !perfil.trim()}>
            <Search className="size-4" />
            Localizar perfil
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Instagram · TikTok · YouTube. O ranking compara os vídeos coletados; não garante
            encontrar todo o histórico do perfil.
          </p>
        </form>
      </SystemWindow>
      {ocupado && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-sm border border-primary/25 p-3 text-sm"
        >
          <Loader2 className="size-4 animate-spin text-primary" />
          {progresso}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              cancelado.current = true;
              setProgresso("Interrompendo…");
            }}
          >
            Interromper
          </Button>
        </div>
      )}
      {mensagem && (
        <p role="alert" className="rounded-sm border border-destructive/30 p-3 text-sm">
          {mensagem}
        </p>
      )}
      {videos.length > 0 && (
        <>
          <SystemWindow title="[ Filtrar e ordenar ]">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="ranking-viral">Ranking</Label>
                <select
                  id="ranking-viral"
                  value={ranking}
                  onChange={(e) => setRanking(e.target.value as Ranking)}
                  className="h-9 w-full rounded-sm border border-input bg-background px-2 text-sm"
                >
                  {[
                    ["viral", "Acima da mediana"],
                    ["views", "Mais visualizados"],
                    ["likes", "Mais curtidos"],
                    ["comentarios", "Mais comentados"],
                    ["engajamento", "Maior engajamento"],
                    ["recentes", "Mais recentes"],
                  ].map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="views-viral">Views mínimas</Label>
                <Input
                  id="views-viral"
                  type="number"
                  min="0"
                  value={views}
                  onChange={(e) => setViews(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="likes-viral">Likes mínimos</Label>
                <Input
                  id="likes-viral"
                  type="number"
                  min="0"
                  value={likes}
                  onChange={(e) => setLikes(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="score-viral">Vezes a mediana</Label>
                <Input
                  id="score-viral"
                  type="number"
                  min="0"
                  step="0.5"
                  value={viral}
                  onChange={(e) => setViral(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="texto-viral">Buscar no título</Label>
                <Input id="texto-viral" value={texto} onChange={(e) => setTexto(e.target.value)} />
              </div>
            </div>
          </SystemWindow>
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-sm border border-primary/25 bg-background/95 p-3 backdrop-blur">
            <span className="mr-auto text-sm text-muted-foreground">
              {filtrados.length} de {videos.length} vídeos · {selecionados.size} selecionados
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={ocupado || !filtrados.length}
              onClick={() => {
                if (filtrados.length > 50) {
                  toast.error("Há mais de 50 resultados. Refine os filtros para selecionar todos.");
                  return;
                }
                setSelecionados(new Set(filtrados.map((v) => v.id)));
              }}
            >
              Selecionar todos os filtrados
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={ocupado || !selecionados.size}
              onClick={() => setSelecionados(new Set())}
            >
              Limpar seleção
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={ocupado || !selecionados.size}
              onClick={() => void baixar("zip")}
            >
              <Download className="size-4" />
              Baixar ZIP
            </Button>
            <Button
              size="sm"
              disabled={ocupado || !selecionados.size}
              onClick={() => void baixar("editor")}
            >
              <Film className="size-4" />
              Importar para o Editor
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Até 50 vídeos por lote, 48 MB por vídeo. A seleção permanece ao mudar filtros. Use
            conteúdos que você pode baixar e editar.
          </p>
          {!filtrados.length && (
            <p className="py-8 text-center text-muted-foreground">
              Nenhum vídeo atende aos filtros atuais.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((v) => (
              <article
                key={v.id}
                className={`overflow-hidden rounded-sm border bg-card ${selecionados.has(v.id) ? "border-primary" : "border-border"}`}
              >
                <label className="relative block cursor-pointer">
                  <div className="aspect-[9/12] bg-background">
                    {v.capa ? (
                      <img
                        src={v.capa}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Film className="size-8" />
                      </div>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${v.titulo}`}
                    checked={selecionados.has(v.id)}
                    onChange={() => selecionar(v.id)}
                    disabled={ocupado}
                    className="absolute left-3 top-3 size-5 accent-primary"
                  />
                  {v.vezesMediana !== null && (
                    <span className="absolute bottom-2 left-2 rounded-sm border border-primary/30 bg-background/90 px-2 py-1 font-mono text-xs text-primary">
                      {v.vezesMediana.toFixed(1)}× a mediana
                    </span>
                  )}
                </label>
                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-sm" title={v.titulo}>
                    {v.titulo}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" />
                      {formatar(v.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" />
                      {formatar(v.likes)}
                    </span>
                  </div>
                  <a
                    href={v.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 text-xs text-primary"
                  >
                    Ver original
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <Dialog open={conexoes} onOpenChange={setConexoes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar coleta de perfis</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Aplique a migração do Minerador Viral na Lovable. Depois, conecte uma conta Apify com
            saldo e acesso aos coletores. A chave fica somente no servidor.
          </p>
          <Label htmlFor="apify-chave">Chave Apify</Label>
          <Input
            id="apify-chave"
            type="password"
            autoComplete="off"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
          />
          <Button disabled={salvando || chave.trim().length < 6} onClick={() => void salvar()}>
            {salvando ? "Salvando…" : "Salvar conexão"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
