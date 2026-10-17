import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, CalendarClock, Cloud, Copy, Download, ExternalLink, FilePlus2, Film, Loader2, Play, RefreshCw, Settings2, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "../components/ui";
import { cn } from "../lib/utils";
import {
  KIT_URL,
  REDE,
  TIPO_NOME,
  contaNome,
  countTags,
  lerNuvem,
  lerProntos,
  nuvemApi,
  salvarNuvem,
  normTags,
  parseTimes,
  slots,
  subir,
  type Conta,
  type Nuvem,
  type Plataforma,
  type PostNuvem,
  type Status,
} from "../lib/agendador/agendador";

type Item = {
  uid: string;
  arquivo: Blob;
  nome: string;
  kind: "video" | "image";
  tipo: string;
  legendaVideo: string;
  capa: Blob | null;
  thumb: string;
  quando: number | null;
  legenda: string;
  titulo: string;
  contas: string[];
  shareToFeed: boolean;
};

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const fmtQuando = (ms: number) => new Date(ms).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDia = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const ler = <T,>(k: string, padrao: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? padrao : (JSON.parse(v) as T);
  } catch {
    return padrao;
  }
};
const gravar = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
};
let uidSeq = 1;

function Sigla({ p }: { p: Plataforma }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", REDE[p].cor)}>{REDE[p].sigla}</span>;
}

export default function WorkspaceAgendador() {
  const [cfg, setCfg] = useState<Nuvem | null | undefined>(undefined);
  const [editNuvem, setEditNuvem] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formKey, setFormKey] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [erroStatus, setErroStatus] = useState("");
  const [aviso, setAviso] = useState<{ msg: string; ok?: boolean } | null>(null);
  const [aba, setAba] = useState<"lote" | "nuvem">("lote");
  const [lote, setLote] = useState<Item[]>([]);
  const [nuvem, setNuvem] = useState<PostNuvem[]>([]);
  const [nuvemConta, setNuvemConta] = useState("");
  const [destinos, setDestinos] = useState<Set<string>>(() => new Set(ler<string[]>("nk.agendador.destinos", [])));
  const [buscaConta, setBuscaConta] = useState("");
  const [caixa, setCaixa] = useState<"" | "instagram" | "youtube" | "tiktok">("");
  const [igToken, setIgToken] = useState("");
  const [chaveId, setChaveId] = useState("");
  const espera = useRef<ReturnType<typeof setInterval> | null>(null);
  const [chaveSec, setChaveSec] = useState("");
  // opções do lote
  const [tipo, setTipo] = useState("reels");
  const [inicio, setInicio] = useState(hoje);
  const [horarios, setHorarios] = useState(() => ler("nk.agendador.horarios", "09:00, 12:30, 18:00"));
  const [dias, setDias] = useState<Set<number>>(() => new Set(ler<number[]>("nk.agendador.dias", [0, 1, 2, 3, 4, 5, 6])));
  const [legMode, setLegMode] = useState<"video" | "nova" | "linhas">("video");
  const [legNova, setLegNova] = useState("");
  const [legLinhas, setLegLinhas] = useState("");
  const [tags, setTags] = useState(() => ler("nk.agendador.tags", ""));
  const [feed, setFeed] = useState(true);
  const [usarCapa, setUsarCapa] = useState(true);
  const [ytPriv, setYtPriv] = useState("public");
  const [ttPriv, setTtPriv] = useState("PUBLIC_TO_EVERYONE");
  const [enviando, setEnviando] = useState("");
  const arquivos = useRef<HTMLInputElement>(null);

  const contas = status?.contas ?? [];
  const contaPorId = useCallback((id: string | null) => contas.find((c) => c.id === id), [contas]);

  useEffect(() => {
    void lerNuvem().then((n) => {
      setCfg(n);
      setFormUrl(n?.url || "");
      setFormKey(n?.apiKey || "");
    });
    return () => {
      if (espera.current) clearInterval(espera.current);
    };
  }, []);

  const atualizarStatus = useCallback(async () => {
    try {
      if (!cfg) return;
      const st = await nuvemApi<Status>(cfg, "GET", "/api/status");
      setStatus(st);
      setErroStatus("");
      // primeira vez (nada escolhido ainda): já vem com todas as contas marcadas
      setDestinos((d) => {
        const validos = new Set([...d].filter((id) => st.contas.some((c) => c.id === id)));
        if (!validos.size && st.contas.length && ler<string[]>("nk.agendador.destinos", []).length === 0) st.contas.forEach((c) => validos.add(c.id));
        return validos;
      });
    } catch (e) {
      setErroStatus(e instanceof Error ? e.message : String(e));
    }
  }, [cfg]);
  const atualizarNuvem = useCallback(async () => {
    if (!cfg) return;
    try {
      setNuvem((await nuvemApi<{ posts: PostNuvem[] }>(cfg, "GET", "/api/posts")).posts || []);
    } catch (e) {
      setAviso({ msg: "Não consegui ler a agenda: " + (e instanceof Error ? e.message : String(e)), ok: false });
    }
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return;
    void atualizarStatus();
    void atualizarNuvem();
    const t = setInterval(() => {
      void atualizarStatus();
      void atualizarNuvem();
    }, 30000);
    return () => clearInterval(t);
  }, [cfg, atualizarStatus, atualizarNuvem]);

  useEffect(() => gravar("nk.agendador.destinos", [...destinos]), [destinos]);
  useEffect(() => gravar("nk.agendador.horarios", horarios), [horarios]);
  useEffect(() => gravar("nk.agendador.dias", [...dias]), [dias]);
  useEffect(() => gravar("nk.agendador.tags", tags), [tags]);

  // ------------------------------------------------------------ lote
  const temRede = (it: Item, rede: Plataforma) => it.contas.some((id) => contaPorId(id)?.plataforma === rede);
  const contasValidas = (it: Item) =>
    it.contas.filter((id) => {
      const c = contaPorId(id);
      return c && (it.kind === "video" || c.plataforma === "instagram");
    });

  function legendaPara(it: Item, i: number) {
    let base = legMode === "video" ? it.legendaVideo : legMode === "nova" ? legNova : (legLinhas.split("\n")[i] || "").replace(/\s*\|\s*/g, "\n");
    base = String(base || "").trim();
    return [base, normTags(tags)].filter(Boolean).join("\n\n");
  }

  function montar(lista: Item[], silencioso: boolean) {
    const s = slots(lista.length, inicio, parseTimes(horarios), dias);
    if (!s) {
      if (!silencioso) setAviso({ msg: "Escolha pelo menos um horário e um dia da semana.", ok: false });
      return lista;
    }
    const novo = lista.map((it, i) => ({ ...it, quando: s[i] ?? null, legenda: legendaPara(it, i), shareToFeed: feed, contas: destinos.size ? [...destinos] : it.contas }));
    if (!silencioso) setAviso({ msg: "Agenda montada. Confira a lista e envie.", ok: true });
    return novo;
  }

  function adicionar(lista: { arquivo: Blob; nome: string; legenda?: string; titulo?: string; capa?: Blob | null; thumb?: string }[]) {
    const novos: Item[] = lista
      .filter((x) => !lote.some((y) => y.arquivo === x.arquivo))
      .map((x) => {
        const kind: Item["kind"] = x.arquivo.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(x.nome) ? "image" : "video";
        return {
          uid: "u" + uidSeq++,
          arquivo: x.arquivo,
          nome: x.nome,
          kind,
          tipo: kind === "image" && tipo === "reels" ? "foto" : kind === "video" && tipo === "foto" ? "reels" : tipo,
          legendaVideo: x.legenda || "",
          capa: x.capa || null,
          thumb: x.thumb || (kind === "image" ? URL.createObjectURL(x.arquivo) : ""),
          quando: null,
          legenda: "",
          titulo: x.titulo || "",
          contas: [...destinos],
          shareToFeed: feed,
        };
      });
    if (!novos.length) return setAviso({ msg: "Nada novo para adicionar.", ok: false });
    setLote((l) => montar([...l, ...novos], true));
    setAviso({ msg: `${novos.length} item(ns) no lote.`, ok: true });
  }

  function validar(it: Item) {
    const probs: string[] = [];
    const ig = temRede(it, "instagram");
    const yt = temRede(it, "youtube");
    const tk = temRede(it, "tiktok");
    if (!it.contas.length) probs.push("escolha pelo menos uma conta");
    else if (!contasValidas(it).length) probs.push("foto só pode ir para o Instagram");
    if (ig && it.tipo !== "story" && it.legenda.length > 2200) probs.push("legenda passa de 2.200 caracteres");
    if (tk && it.legenda.length > 2200) probs.push("legenda do TikTok passa de 2.200 caracteres");
    if (yt && it.kind === "video" && it.legenda.length > 5000) probs.push("descrição do YouTube passa de 5.000 caracteres");
    if (ig && it.tipo !== "story" && countTags(it.legenda) > 30) probs.push("mais de 30 hashtags");
    if (ig && it.kind === "image" && it.tipo === "reels") probs.push("foto não pode ser Reels");
    if (ig && it.kind === "video" && it.tipo === "foto") probs.push("vídeo no feed deve ser Reels");
    if (!it.quando) probs.push("sem horário");
    else if (it.quando < Date.now() + 60000) probs.push("horário já passou");
    return probs;
  }

  const mudar = (uid: string, campos: Partial<Item>) => setLote((l) => l.map((x) => (x.uid === uid ? { ...x, ...campos } : x)));

  async function enviar() {
    if (enviando || !lote.length || !cfg) return;
    const ruins = lote.filter((it) => validar(it).length);
    if (ruins.length) return setAviso({ msg: `Resolva os avisos em ${ruins.length} item(ns) antes de enviar.`, ok: false });
    const feitos = new Set<string>();
    let posts = 0;
    let falha = "";
    for (let i = 0; i < lote.length; i++) {
      const it = lote[i]!;
      const rotulo = `Enviando ${i + 1}/${lote.length}`;
      setEnviando(rotulo + "…");
      try {
        const mediaKey = await subir(cfg, it.arquivo, it.nome, (pp) => setEnviando(`${rotulo} · ${Math.round(pp * 100)}%`));
        const capaKey = usarCapa && it.tipo === "reels" && it.capa ? await subir(cfg, it.capa, it.nome.replace(/\.[^.]+$/, "") + "_capa.jpg", () => undefined) : null;
        // um post por conta marcada (o arquivo sobe uma vez só)
        const lista = contasValidas(it).map((id) => {
          const c = contaPorId(id)!;
          const base = { contaId: id, mediaKey, mediaKind: it.kind, quando: it.quando, nome: it.nome, shareToFeed: it.shareToFeed };
          if (c.plataforma === "instagram") return { ...base, tipo: it.tipo, legenda: it.tipo === "story" ? "" : it.legenda, capaKey };
          if (c.plataforma === "youtube") return { ...base, tipo: "short", legenda: it.legenda, privacidade: ytPriv, titulo: it.titulo.trim() || null };
          return { ...base, tipo: "video", legenda: it.legenda, privacidade: ttPriv };
        });
        await nuvemApi(cfg, "POST", "/api/posts", lista);
        feitos.add(it.uid);
        posts += lista.length;
      } catch (e) {
        falha = e instanceof Error ? e.message : String(e);
        break;
      }
    }
    setLote((l) => l.filter((x) => !feitos.has(x.uid)));
    setEnviando("");
    setAviso(
      falha
        ? { msg: `${feitos.size} agendado(s). Parou com erro: ${falha}`, ok: false }
        : { msg: `${feitos.size} arquivo(s) agendados na sua nuvem (${posts} posts). Pode desligar o computador.`, ok: true },
    );
    await Promise.all([atualizarNuvem(), atualizarStatus()]);
    if (!falha) setAba("nuvem");
  }

  // ------------------------------------------------------------ contas
  async function conectarOauth(plataforma: "youtube" | "tiktok") {
    if (!cfg) return;
    try {
      const r = await nuvemApi<{ url: string }>(cfg, "POST", "/api/oauth/iniciar", { plataforma });
      window.open(r.url, "_blank", "noopener");
      setAviso({ msg: `Entre na conta do ${REDE[plataforma].nome} na aba que abriu e autorize. Ela aparece aqui sozinha.`, ok: true });
      const antes = status?.contas.length || 0;
      let n = 0;
      if (espera.current) clearInterval(espera.current);
      espera.current = setInterval(async () => {
        n++;
        const st = await nuvemApi<Status>(cfg, "GET", "/api/status").catch(() => null);
        if (st) setStatus(st);
        if ((st && st.contas.length > antes) || n > 40) {
          if (espera.current) clearInterval(espera.current);
          if (st && st.contas.length > antes) setAviso({ msg: "Conta conectada!", ok: true });
        }
      }, 4000);
    } catch (e) {
      setAviso({ msg: e instanceof Error ? e.message : String(e), ok: false });
    }
  }
  async function salvarChaves(plat: "youtube" | "tiktok") {
    if (!chaveId.trim() || !chaveSec.trim()) return setAviso({ msg: "Preencha as duas chaves.", ok: false });
    if (!cfg) return;
    try {
      await nuvemApi(cfg, "POST", "/api/plataformas", plat === "youtube" ? { youtube: { clientId: chaveId.trim(), clientSecret: chaveSec.trim() } } : { tiktok: { clientKey: chaveId.trim(), clientSecret: chaveSec.trim() } });
      setChaveSec("");
      setCaixa("");
      await atualizarStatus();
      await conectarOauth(plat);
    } catch (e) {
      setAviso({ msg: e instanceof Error ? e.message : String(e), ok: false });
    }
  }
  async function conectarIg() {
    if (!igToken.trim()) return setAviso({ msg: "Cole o token de acesso.", ok: false });
    if (!cfg) return;
    try {
      const r = await nuvemApi<{ id: string; conta: string }>(cfg, "POST", "/api/contas/instagram", { token: igToken.trim() });
      setIgToken("");
      setCaixa("");
      setDestinos((d) => new Set([...d, r.id]));
      setAviso({ msg: `Conta @${r.conta} conectada!`, ok: true });
      await atualizarStatus();
    } catch (e) {
      setAviso({ msg: "Não conectou: " + (e instanceof Error ? e.message : String(e)), ok: false });
    }
  }
  async function remover(c: Conta) {
    if (!confirm(`Desconectar ${contaNome(c)} (${REDE[c.plataforma].nome})? Os posts agendados dela não vão sair.`)) return;
    if (!cfg) return;
    try {
      await nuvemApi(cfg, "DELETE", "/api/contas/" + encodeURIComponent(c.id));
      setDestinos((d) => new Set([...d].filter((x) => x !== c.id)));
      await Promise.all([atualizarStatus(), atualizarNuvem()]);
    } catch (e) {
      setAviso({ msg: e instanceof Error ? e.message : String(e), ok: false });
    }
  }
  const abrirCaixa = (p: "instagram" | "youtube" | "tiktok") => {
    setChaveId("");
    setChaveSec("");
    setCaixa((c) => (c === p ? "" : p));
  };
  const adicionarConta = (p: "instagram" | "youtube" | "tiktok") => {
    if (p !== "instagram" && status?.plataformas[p]) return void conectarOauth(p);
    abrirCaixa(p);
  };

  const redes = useMemo(() => new Set([...destinos].map((id) => contaPorId(id)?.plataforma)), [destinos, contaPorId]);
  const rate = useMemo(() => {
    const t = parseTimes(horarios);
    const lim: string[] = [];
    if (redes.has("instagram")) lim.push("Instagram até 100 por conta");
    if (redes.has("youtube")) lim.push("YouTube cerca de 6 envios no total (cota grátis do Google)");
    if (redes.has("tiktok")) lim.push("TikTok uns 15 por conta");
    return t.length ? `${t.length} post(s) por dia em ${dias.size} dia(s) da semana.${lim.length ? " Limite por dia: " + lim.join(" · ") + "." : ""}` : "Digite os horários assim: 09:00, 12:30, 18:00";
  }, [horarios, dias, redes]);

  const ruins = lote.filter((it) => validar(it).length).length;
  const tempos = lote.map((it) => it.quando).filter((x): x is number => !!x).sort((a, b) => a - b);

  async function guardarNuvem() {
    const url = formUrl.trim().replace(/\/+$/, "");
    if (!/^https:\/\//.test(url) || !formKey.trim()) return setAviso({ msg: "Preencha o endereço (https://…) e a chave da nuvem.", ok: false });
    try {
      await nuvemApi({ url, apiKey: formKey.trim() }, "GET", "/api/status");
    } catch (e) {
      return setAviso({ msg: "A nuvem não respondeu com esses dados: " + (e instanceof Error ? e.message : String(e)), ok: false });
    }
    const n = await salvarNuvem({ url, apiKey: formKey });
    setCfg(n);
    setEditNuvem(false);
    setAviso({ msg: "Nuvem conectada! Agora conecte as contas.", ok: true });
  }

  if (cfg === undefined) return <Loader2 className="mx-auto size-6 animate-spin text-lime" />;
  const caixaNuvem = (
    <Card className="space-y-3 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Minha nuvem (servidor grátis na Cloudflare)</p>
      <p className="text-xs text-tsecondary">
        O Agendador publica pelo <b>seu próprio servidor grátis</b> na Cloudflare: a agenda e os vídeos ficam na sua conta e saem na hora certa, mesmo com o computador desligado. Instala uma vez só, em uns 5 minutos.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={KIT_URL} download className="inline-flex items-center gap-2 rounded-xl bg-lime px-3 py-2 text-xs font-semibold text-bg">
          <Download className="size-4" /> Baixar o instalador
        </a>
        <Link to="/app/tutoriais#nuvem" className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-tsecondary hover:border-lime">
          <BookOpen className="size-4" /> Tutorial passo a passo
        </Link>
      </div>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-tmuted">
        <li>Instale o Node.js (LTS) em nodejs.org.</li>
        <li>Descompacte o instalador e dê dois cliques em instalar-nuvem.bat (Mac: instalar-nuvem.command).</li>
        <li>Entre na Cloudflare (conta grátis) quando o navegador abrir e clique em Allow.</li>
        <li>No fim aparecem o endereço e a chave: cole aqui embaixo.</li>
      </ol>
      <Label>Endereço da nuvem</Label>
      <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://agendador-editor.SEU-NOME.workers.dev" className="!py-2 text-xs" />
      <Label>Chave da nuvem</Label>
      <Input type="password" autoComplete="off" value={formKey} onChange={(e) => setFormKey(e.target.value)} className="!py-2 text-xs" />
      <div className="flex gap-2">
        <Button className="!py-2 text-xs" onClick={() => void guardarNuvem()}>Salvar e conectar</Button>
        {cfg && <Button variant="ghost" className="!py-2 text-xs" onClick={() => setEditNuvem(false)}>Cancelar</Button>}
      </div>
    </Card>
  );
  if (!cfg)
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {aviso && <p role="status" className={cn("rounded-lg border p-3 text-sm", aviso.ok === false ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-lime/30 bg-lime/5 text-tsecondary")}>{aviso.msg}</p>}
        {caixaNuvem}
      </div>
    );

  const campoCopiar = (valor: string) => (
    <div className="flex gap-2">
      <Input readOnly value={valor} className="!py-2 text-xs" />
      <Button variant="outline" className="!px-3 !py-2" title="Copiar" onClick={() => void navigator.clipboard.writeText(valor).then(() => setAviso({ msg: "Endereço copiado.", ok: true }))}>
        <Copy className="size-4" />
      </Button>
    </div>
  );

  const contasFiltradas = contas.filter((c) => !buscaConta.trim() || (contaNome(c) + REDE[c.plataforma].nome).toLowerCase().includes(buscaConta.trim().toLowerCase()));
  const postsLista = [...nuvem].sort((a, b) => a.quando - b.quando).filter((p) => !nuvemConta || p.conta_id === nuvemConta);
  const c = status?.contagem || {};

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="space-y-4">
        {editNuvem ? (
          caixaNuvem
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", status ? "bg-lime" : erroStatus ? "bg-red-400" : "bg-amber-400")} />
              <span className="truncate text-tsecondary" title={cfg.url}>{status ? "Nuvem conectada" : erroStatus ? "Nuvem sem resposta" : "Conectando…"}</span>
            </span>
            <button className="flex cursor-pointer items-center gap-1 text-tmuted hover:text-lime" onClick={() => setEditNuvem(true)}>
              <Settings2 className="size-3.5" /> nuvem
            </button>
          </div>
        )}
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Contas</p>
            <span className="text-xs text-tmuted">{contas.length} conta{contas.length === 1 ? "" : "s"}</span>
          </div>
          {erroStatus && <p className="text-xs text-red-400">A sua nuvem não respondeu: {erroStatus}</p>}
          {contas.length >= 6 && <Input placeholder="Buscar conta" value={buscaConta} onChange={(e) => setBuscaConta(e.target.value)} className="!py-2 text-xs" />}
          <div className="space-y-2">
            {contas.length ? (
              contasFiltradas.map((ct) => (
                <div key={ct.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <Sigla p={ct.plataforma} />
                  {ct.foto && <img src={ct.foto} alt="" className="size-7 rounded-full" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={contaNome(ct)}>{contaNome(ct)}</p>
                    <p className="truncate text-[11px] text-tmuted">
                      {ct.erro ? <span className="text-red-400">⚠ {ct.erro}</span> : ct.acessoAte ? `acesso até ${new Date(ct.acessoAte).toLocaleDateString("pt-BR")}` : "conectada"} · {ct.publicados24h} hoje
                    </p>
                  </div>
                  <button className="cursor-pointer text-xs text-tmuted hover:text-red-400" onClick={() => void remover(ct)}>remover</button>
                </div>
              ))
            ) : (
              <p className="text-xs text-tmuted">Nenhuma conta ainda. Conecte quantas quiser: Instagram, YouTube ou TikTok.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["instagram", "youtube", "tiktok"] as const).map((p) => (
              <Button key={p} variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => adicionarConta(p)}>
                ＋ {REDE[p].nome}
              </Button>
            ))}
          </div>
          {(status?.plataformas.youtube || status?.plataformas.tiktok) && (
            <p className="text-[11px] text-tmuted">
              Trocar chaves do app:{" "}
              <button className="cursor-pointer text-lime" onClick={() => abrirCaixa("youtube")}>YouTube</button> ·{" "}
              <button className="cursor-pointer text-lime" onClick={() => abrirCaixa("tiktok")}>TikTok</button>
            </p>
          )}

          {caixa === "instagram" && (
            <div className="space-y-2 rounded-lg bg-surface2 p-3 text-xs">
              <p className="font-semibold">Como pegar o token do Instagram</p>
              <ol className="list-decimal space-y-1 pl-4 text-tsecondary">
                <li>Abra developers.facebook.com/apps e entre no seu app (ou crie um com o caso de uso “Gerenciar mensagens e conteúdo no Instagram”). A conta precisa ser profissional (comercial ou criador).</li>
                <li>Em Funções do app → Funções, adicione a conta como Testador do Instagram e aceite o convite no Instagram (Configurações → Apps e sites → Convites de testador).</li>
                <li>Em API do Instagram → Configuração da API com login do Instagram → Gerar tokens de acesso, clique em Adicionar conta e entre com a conta.</li>
                <li>Clique em Gerar token, copie e cole abaixo. A sua nuvem renova ele sozinha.</li>
                <li>Para cada conta nova do Instagram, repita a partir do passo 2.</li>
              </ol>
              <Label>Token de acesso</Label>
              <Input type="password" autoComplete="off" value={igToken} onChange={(e) => setIgToken(e.target.value)} className="!py-2 text-xs" />
              <div className="flex gap-2">
                <Button className="!py-1.5 text-xs" onClick={() => void conectarIg()}>Conectar conta</Button>
                <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setCaixa("")}>Cancelar</Button>
              </div>
            </div>
          )}
          {(caixa === "youtube" || caixa === "tiktok") && (
            <div className="space-y-2 rounded-lg bg-surface2 p-3 text-xs">
              {caixa === "youtube" ? (
                <>
                  <p className="font-semibold">Chaves do seu app do Google (uma vez só, vale para todos os canais)</p>
                  <ol className="list-decimal space-y-1 pl-4 text-tsecondary">
                    <li>Abra console.cloud.google.com e crie um projeto (ex.: “Agendador”).</li>
                    <li>Em APIs e serviços → Biblioteca, ative a YouTube Data API v3.</li>
                    <li>Em Tela de consentimento OAuth: tipo Externo, preencha nome e e-mail e use as páginas {cfg.url}/privacidade e {cfg.url}/termos. Em Público, clique em Publicar app (em modo “Teste” o Google desconecta o canal a cada 7 dias).</li>
                    <li>Em Credenciais → Criar credenciais → ID do cliente OAuth, tipo Aplicativo da Web. Em URIs de redirecionamento autorizados, cole o endereço abaixo.</li>
                    <li>Copie o ID do cliente e a Chave secreta para os campos abaixo.</li>
                  </ol>
                  <p className="text-amber-400">Enquanto o Google não verificar o seu app, ele mostra “app não verificado” (clique em Avançado → continuar) e os vídeos podem ficar privados.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Chaves do seu app no TikTok for Developers (uma vez só)</p>
                  <ol className="list-decimal space-y-1 pl-4 text-tsecondary">
                    <li>Abra developers.tiktok.com, entre e crie um app (páginas de privacidade e termos: {cfg.url}/privacidade e {cfg.url}/termos).</li>
                    <li>Adicione os produtos Login Kit e Content Posting API (ligue o Direct Post).</li>
                    <li>Em Login Kit → Redirect URI, cole o endereço abaixo. Peça os escopos user.info.basic e video.publish.</li>
                    <li>Envie o app para revisão e, enquanto não for aprovado, adicione a sua conta como usuária de teste (Sandbox).</li>
                    <li>Copie o Client key e o Client secret para os campos abaixo.</li>
                  </ol>
                  <p className="text-amber-400">Enquanto o TikTok não auditar o app, os vídeos só saem como “Só eu”. Depois da auditoria, sai público.</p>
                </>
              )}
              <Label>Endereço de redirecionamento</Label>
              {campoCopiar(status?.redirect[caixa] || "")}
              <Label>{caixa === "youtube" ? "ID do cliente" : "Client key"}</Label>
              <Input value={chaveId} onChange={(e) => setChaveId(e.target.value)} className="!py-2 text-xs" />
              <Label>{caixa === "youtube" ? "Chave secreta do cliente" : "Client secret"}</Label>
              <Input type="password" autoComplete="off" value={chaveSec} onChange={(e) => setChaveSec(e.target.value)} className="!py-2 text-xs" />
              <div className="flex gap-2">
                <Button className="!py-1.5 text-xs" onClick={() => void salvarChaves(caixa)}>{caixa === "youtube" ? "Salvar e conectar canal" : "Salvar e conectar conta"}</Button>
                <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setCaixa("")}>Cancelar</Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Onde publicar</p>
          {contas.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <button className="cursor-pointer text-lime" onClick={() => setDestinos(new Set(contas.map((x) => x.id)))}>Todas</button>·
              <button className="cursor-pointer text-lime" onClick={() => setDestinos(new Set())}>Nenhuma</button>
              {(["instagram", "youtube", "tiktok"] as const)
                .filter((p) => contas.some((x) => x.plataforma === p))
                .map((p) => (
                  <span key={p}>
                    · <button className="cursor-pointer text-lime" onClick={() => setDestinos(new Set(contas.filter((x) => x.plataforma === p).map((x) => x.id)))}>Só {REDE[p].nome}</button>
                  </span>
                ))}
              <span className="text-tmuted">{destinos.size} de {contas.length} marcadas</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {contas.length ? (
              contas.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() =>
                    setDestinos((d) => {
                      const n = new Set(d);
                      if (n.has(ct.id)) n.delete(ct.id);
                      else n.add(ct.id);
                      setLote((l) => l.map((x) => ({ ...x, contas: [...n] })));
                      return n;
                    })
                  }
                  className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", destinos.has(ct.id) ? "border-lime bg-lime/10 text-tprimary" : "border-border text-tmuted")}
                >
                  <Sigla p={ct.plataforma} />
                  {contaNome(ct)}
                </button>
              ))
            ) : (
              <p className="text-xs text-tmuted">Conecte uma conta na seção Contas, acima.</p>
            )}
          </div>

          {(contas.length === 0 || redes.has("instagram")) && (
            <>
              <Label>Tipo no Instagram</Label>
              <div className="flex gap-1.5">
                {["reels", "story", "foto"].map((t) => (
                  <Button
                    key={t}
                    variant={tipo === t ? "primary" : "ghost"}
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setTipo(t);
                      setLote((l) => l.map((it) => ({ ...it, tipo: it.kind === "image" && t === "reels" ? "foto" : it.kind === "video" && t === "foto" ? "reels" : t })));
                    }}
                  >
                    {TIPO_NOME[t]}
                  </Button>
                ))}
              </div>
              <label className="flex items-center justify-between gap-2 text-xs text-tsecondary">
                Reels também no feed
                <input type="checkbox" className="size-4 accent-lime" checked={feed} onChange={(e) => setFeed(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-2 text-xs text-tsecondary">
                Usar a capa JPG do Editor no Reels
                <input type="checkbox" className="size-4 accent-lime" checked={usarCapa} onChange={(e) => setUsarCapa(e.target.checked)} />
              </label>
            </>
          )}
          {redes.has("youtube") && (
            <label className="block space-y-1 text-xs text-tsecondary">
              Privacidade no YouTube
              <Select value={ytPriv} onChange={(e) => setYtPriv(e.target.value)} className="!py-2 text-xs">
                <option value="public">Público</option>
                <option value="unlisted">Não listado</option>
                <option value="private">Privado</option>
              </Select>
            </label>
          )}
          {redes.has("tiktok") && (
            <label className="block space-y-1 text-xs text-tsecondary">
              Privacidade no TikTok
              <Select value={ttPriv} onChange={(e) => setTtPriv(e.target.value)} className="!py-2 text-xs">
                <option value="PUBLIC_TO_EVERYONE">Todos</option>
                <option value="MUTUAL_FOLLOW_FRIENDS">Amigos</option>
                <option value="FOLLOWER_OF_CREATOR">Seguidores</option>
                <option value="SELF_ONLY">Só eu</option>
              </Select>
            </label>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">Quando</p>
          <label className="block space-y-1 text-xs text-tsecondary">
            Começar no dia
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="!py-2 text-xs" />
          </label>
          <label className="block space-y-1 text-xs text-tsecondary">
            Horários
            <Input value={horarios} onChange={(e) => setHorarios(e.target.value)} placeholder="09:00, 12:30, 18:00" className="!py-2 text-xs" />
          </label>
          <div className="flex gap-1">
            {DIAS.map((d, i) => (
              <button
                key={i}
                onClick={() => setDias((x) => {
                  const n = new Set(x);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })}
                className={cn("size-8 cursor-pointer rounded-lg border text-xs font-semibold", dias.has(i) ? "border-lime bg-lime/10 text-lime" : "border-border text-tmuted")}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-tmuted">{rate}</p>

          <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-lime">Legenda</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["video", "Do vídeo"],
                ["nova", "Mesma em todos"],
                ["linhas", "Uma por linha"],
              ] as const
            ).map(([k, n]) => (
              <Button key={k} variant={legMode === k ? "primary" : "ghost"} className="!px-3 !py-1.5 text-xs" onClick={() => setLegMode(k)}>
                {n}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-tmuted">
            {legMode === "video" ? "Usa o texto da postagem de cada vídeo (Cortes Virais e Frases com IA já preenchem)." : legMode === "nova" ? "A mesma legenda em todos os posts do lote." : "Uma legenda por linha, na ordem do lote. Use | para quebrar linha."}
          </p>
          {legMode === "nova" && <Textarea rows={3} value={legNova} onChange={(e) => setLegNova(e.target.value)} className="text-xs" />}
          {legMode === "linhas" && <Textarea rows={5} value={legLinhas} onChange={(e) => setLegLinhas(e.target.value)} className="text-xs" />}
          <label className="block space-y-1 text-xs text-tsecondary">
            Hashtags (vão no fim de todas)
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#reels #motivacao" className="!py-2 text-xs" />
          </label>
          <Button className="w-full !py-2 text-xs" disabled={!lote.length} onClick={() => setLote((l) => montar(l, false))}>
            <CalendarClock className="size-4" /> Montar agenda do lote
          </Button>
        </Card>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant={aba === "lote" ? "primary" : "ghost"} className="!py-2 text-xs" onClick={() => setAba("lote")}>
              Lote ({lote.length})
            </Button>
            <Button variant={aba === "nuvem" ? "primary" : "ghost"} className="!py-2 text-xs" onClick={() => setAba("nuvem")}>
              <Cloud className="size-4" /> Agenda ({nuvem.filter((p) => p.status !== "publicado").length})
            </Button>
          </div>
          {status && (
            <p className="text-xs text-tmuted">
              Agendados <b className="text-tprimary">{c.agendado || 0}</b> · Publicando <b className="text-tprimary">{c.processando || 0}</b> · Publicados <b className="text-tprimary">{c.publicado || 0}</b> · Com erro <b className="text-tprimary">{c.erro || 0}</b> · Últimas 24h <b className="text-tprimary">{status.publicados24h}</b>
            </p>
          )}
        </div>
        {aviso && (
          <p role="status" className={cn("flex items-start justify-between gap-3 rounded-lg border p-3 text-sm", aviso.ok === false ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-lime/30 bg-lime/5 text-tsecondary")}>
            {aviso.msg}
            <button className="cursor-pointer text-tmuted" onClick={() => setAviso(null)}><X className="size-4" /></button>
          </p>
        )}

        {aba === "lote" ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="!py-2 text-xs"
                onClick={() => {
                  const p = lerProntos();
                  if (!p.length) return setAviso({ msg: "Nenhum vídeo pronto na mesa. Processe os vídeos no Editor em Massa primeiro (sem sair do site).", ok: false });
                  adicionar(p.map((v) => ({ arquivo: v.blob, nome: v.nome, legenda: v.legenda, titulo: v.titulo, capa: v.capa, thumb: v.thumb })));
                }}
              >
                <Film className="size-4" /> Vídeos prontos do Editor
              </Button>
              <Button variant="outline" className="!py-2 text-xs" onClick={() => arquivos.current?.click()}>
                <FilePlus2 className="size-4" /> Arquivos do computador
              </Button>
              <input
                ref={arquivos}
                type="file"
                multiple
                accept="video/*,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) adicionar([...e.target.files].map((f) => ({ arquivo: f, nome: f.name })));
                  e.target.value = "";
                }}
              />
              {lote.length > 0 && (
                <Button variant="ghost" className="ml-auto !py-2 text-xs" onClick={() => confirm("Tirar todos os itens do lote?") && setLote([])}>
                  Limpar lote
                </Button>
              )}
            </div>

            {lote.length === 0 ? (
              <Card className="py-14 text-center">
                <CalendarClock className="mx-auto size-8 text-lime" />
                <h3 className="mt-3 text-lg font-bold">Agende em massa no Instagram, YouTube e TikTok</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-tmuted">Adicione os vídeos, marque onde publicar, escolha os horários e envie. O servidor publica na hora certa, mesmo com o computador desligado.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {lote.map((it, i) => {
                  const probs = validar(it);
                  const ig = temRede(it, "instagram");
                  const yt = temRede(it, "youtube") && it.kind === "video";
                  const story = ig && it.tipo === "story" && it.contas.length === 1;
                  return (
                    <Card key={it.uid} className={cn("flex gap-3 p-3", probs.length && "border-red-500/40")}>
                      <span className="w-6 shrink-0 pt-1 text-xs font-bold text-tmuted">{pad2(i + 1)}</span>
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface2 text-xl">
                        {it.thumb ? <img src={it.thumb} alt="" className="size-full object-cover" /> : it.kind === "image" ? "🖼" : "🎬"}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={it.nome}>{it.nome}</span>
                          {ig && (
                            <Select value={it.tipo} onChange={(e) => mudar(it.uid, { tipo: e.target.value })} className="!w-auto !py-1 text-xs">
                              {["reels", "story", "foto"]
                                .filter((t) => (it.kind === "image" ? t !== "reels" : t !== "foto"))
                                .map((t) => (
                                  <option key={t} value={t}>{TIPO_NOME[t]}</option>
                                ))}
                            </Select>
                          )}
                          <Input type="datetime-local" value={it.quando ? toLocalInput(it.quando) : ""} onChange={(e) => mudar(it.uid, { quando: e.target.value ? new Date(e.target.value).getTime() : null })} className="!w-auto !py-1 text-xs" />
                          <button title="Subir" className="cursor-pointer text-tmuted hover:text-lime" disabled={i === 0} onClick={() => setLote((l) => { const n = [...l]; const a = n[i]!, b = n[i - 1]!; n[i - 1] = { ...a, quando: b.quando }; n[i] = { ...b, quando: a.quando }; return n; })}>
                            <ArrowUp className="size-4" />
                          </button>
                          <button title="Descer" className="cursor-pointer text-tmuted hover:text-lime" disabled={i === lote.length - 1} onClick={() => setLote((l) => { const n = [...l]; const a = n[i]!, b = n[i + 1]!; n[i + 1] = { ...a, quando: b.quando }; n[i] = { ...b, quando: a.quando }; return n; })}>
                            <ArrowDown className="size-4" />
                          </button>
                          <button title="Tirar do lote" className="cursor-pointer text-tmuted hover:text-red-400" onClick={() => setLote((l) => l.filter((x) => x.uid !== it.uid))}>
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        {contas.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {contas.map((ct) => {
                              const on = it.contas.includes(ct.id);
                              const off = it.kind === "image" && ct.plataforma !== "instagram";
                              return (
                                <button
                                  key={ct.id}
                                  title={off ? "Foto só vai para o Instagram" : ""}
                                  onClick={() => mudar(it.uid, { contas: on ? it.contas.filter((x) => x !== ct.id) : [...it.contas, ct.id] })}
                                  className={cn("flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", on ? "border-lime/60 text-tprimary" : "border-border text-tmuted", off && "opacity-40")}
                                >
                                  <Sigla p={ct.plataforma} />
                                  {contaNome(ct)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {yt && <Input maxLength={100} placeholder="Título no YouTube (vazio = 1ª linha da legenda)" value={it.titulo} onChange={(e) => mudar(it.uid, { titulo: e.target.value })} className="!py-1.5 text-xs" />}
                        {story ? (
                          <p className="text-[11px] text-tmuted">Story não tem legenda na API do Instagram: se quiser texto, coloque no próprio vídeo (Editor → Texto).</p>
                        ) : (
                          <Textarea rows={3} placeholder="Legenda do post" value={it.legenda} onChange={(e) => mudar(it.uid, { legenda: e.target.value })} className="text-xs" />
                        )}
                        <div className="flex flex-wrap gap-3 text-[11px] text-tmuted">
                          {!story && (
                            <>
                              <span>{it.legenda.length} caracteres</span>
                              <span>{countTags(it.legenda)} #</span>
                            </>
                          )}
                          {ig && it.capa && it.tipo === "reels" && usarCapa && <span className="text-lime">✓ capa JPG</span>}
                          {probs.length > 0 && <span className="text-red-400">⚠ {probs.join(" · ")}</span>}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="text-xs text-tmuted">
                    {lote.length} post(s){tempos.length ? ` · de ${fmtQuando(tempos[0]!)} até ${fmtQuando(tempos[tempos.length - 1]!)}` : ""}
                    {ruins ? ` · ${ruins} com aviso` : ""}
                    {enviando && ` · ${enviando}`}
                  </span>
                  <Button disabled={!!enviando || !lote.length || !contas.length} title={contas.length ? "" : "Conecte pelo menos uma conta primeiro"} onClick={() => void enviar()}>
                    {enviando ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
                    {enviando || "Agendar no servidor"}
                  </Button>
                </Card>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={nuvemConta} onChange={(e) => setNuvemConta(e.target.value)} className="!w-auto !py-2 text-xs">
                <option value="">Todas as contas</option>
                {contas.map((ct) => (
                  <option key={ct.id} value={ct.id}>{REDE[ct.plataforma].nome} · {contaNome(ct)}</option>
                ))}
              </Select>
              <Button variant="outline" className="!py-2 text-xs" onClick={() => void Promise.all([atualizarStatus(), atualizarNuvem()])}>
                <RefreshCw className="size-4" /> Atualizar
              </Button>
              <Button
                variant="outline"
                className="!py-2 text-xs"
                onClick={async () => {
                  try {
                    const r = await nuvemApi<{ iniciados: number; processando: number; pulado?: string }>(cfg, "POST", "/api/rodar");
                    if (r.pulado) return setAviso({ msg: `Fila não rodou: ${r.pulado}`, ok: false });
                    setAviso({ msg: `Fila rodou: ${r.iniciados} iniciado(s), ${r.processando} em processamento.`, ok: true });
                    setTimeout(() => void atualizarNuvem(), 800);
                  } catch (e) {
                    setAviso({ msg: e instanceof Error ? e.message : String(e), ok: false });
                  }
                }}
              >
                <Play className="size-4" /> Rodar a fila agora
              </Button>
            </div>
            {postsLista.length === 0 ? (
              <Card className="py-12 text-center text-sm text-tmuted">{nuvemConta ? "Nenhum post desta conta." : "Nada agendado ainda. Envie um lote para ver a agenda aqui."}</Card>
            ) : (
              <div className="space-y-2">
                {postsLista.map((p, i) => {
                  const ct = contaPorId(p.conta_id);
                  const rede = ct?.plataforma || p.plataforma || "instagram";
                  const dia = fmtDia(p.quando);
                  const mostraDia = i === 0 || fmtDia(postsLista[i - 1]!.quando) !== dia;
                  const acoes = async (a: "del" | "retry") => {
                    try {
                      if (a === "del") {
                        if (p.status !== "publicado" && !confirm("Cancelar este post agendado?")) return;
                        await nuvemApi(cfg, "DELETE", "/api/posts/" + encodeURIComponent(p.id));
                      } else await nuvemApi(cfg, "PATCH", "/api/posts/" + encodeURIComponent(p.id), { tentarDeNovo: true });
                      await Promise.all([atualizarNuvem(), atualizarStatus()]);
                    } catch (e) {
                      setAviso({ msg: e instanceof Error ? e.message : String(e), ok: false });
                    }
                  };
                  return (
                    <div key={p.id}>
                      {mostraDia && <p className="pb-1 pt-3 text-xs font-semibold capitalize text-lime">{dia}</p>}
                      <Card className="flex gap-3 p-3">
                        <span className="w-12 shrink-0 pt-0.5 text-xs font-bold">{new Date(p.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Sigla p={rede} />
                            <span className="text-xs">{ct ? contaNome(ct) : "conta removida"}</span>
                            <Badge>{TIPO_NOME[p.tipo] || p.tipo}</Badge>
                            <Badge tone={p.status === "publicado" ? "lime" : p.status === "erro" ? "warn" : "default"}>{p.status}</Badge>
                            <span className="truncate text-xs text-tmuted">{p.titulo || p.nome}</span>
                            <span className="ml-auto flex gap-2">
                              {(p.status === "agendado" || p.status === "erro") && <button className="cursor-pointer text-xs text-red-400" onClick={() => void acoes("del")}>Cancelar</button>}
                              {p.status === "erro" && <button className="cursor-pointer text-xs text-lime" onClick={() => void acoes("retry")}>Tentar de novo</button>}
                              {p.permalink && (
                                <a href={p.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-lime">
                                  <ExternalLink className="size-3" /> {REDE[rede].abrir}
                                </a>
                              )}
                              {p.status === "publicado" && <button className="cursor-pointer text-xs text-tmuted" onClick={() => void acoes("del")}>Tirar da lista</button>}
                            </span>
                          </div>
                          {p.tipo !== "story" && !!p.legenda && <p className="line-clamp-2 whitespace-pre-line text-xs text-tsecondary">{p.legenda}</p>}
                          {p.aviso && <p className="text-xs text-amber-400">{p.aviso}</p>}
                          {p.erro && <p className="text-xs text-red-400">{p.erro}</p>}
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        <p className="text-[11px] text-tmuted">
          Limites das redes: Instagram até 100 posts por dia por conta, legenda até 2.200 caracteres e 30 hashtags, Story não aceita legenda pela API. YouTube: a cota grátis do Google dá uns 6 envios por dia. TikTok: enquanto o app não for auditado, os vídeos saem como “Só eu”. Foto não vai para YouTube/TikTok.
        </p>
      </section>
    </div>
  );
}
