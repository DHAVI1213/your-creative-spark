import { createClient } from "@supabase/supabase-js";
import { lerPerfil, normalizarVideos, urlMidia, type Perfil, type VideoViral } from "./modelo";
type Busca = {
  id: string;
  user_id: string;
  perfil: Perfil;
  run_id: string | null;
  download_run: string | null;
  status: string;
  videos: VideoViral[];
  criado_em: string;
  download_iniciado: string | null;
};
type Entrada = {
  token: string;
  acao: string;
  perfil?: string | undefined;
  busca?: string | undefined;
  ids?: string[] | undefined;
  id?: string | undefined;
  limite?: number | undefined;
};
type Resposta = {
  configurado: boolean;
  busca: string | null;
  status: string;
  videos: VideoViral[];
  base64: string | null;
  nome: string | null;
};
const resposta = (p: Partial<Resposta>): Resposta => ({
  configurado: true,
  busca: null,
  status: "pronto",
  videos: [],
  base64: null,
  nome: null,
  ...p,
});
const APIFY = "https://api.apify.com/v2";
export async function executarMinerador(d: Entrada): Promise<Resposta> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error } = await supabaseAdmin.auth.getUser(d.token);
  if (error || !auth.user) throw new Error("Entre na sua conta novamente.");
  const usuario = auth.user.id,
    db = process.env["SUPABASE_URL"]!,
    key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const cliente = createClient(db, key, {
    global: { headers: { Authorization: `Bearer ${d.token}` } },
    auth: { persistSession: false },
  });
  const acesso = await cliente.rpc("tem_acesso");
  if (acesso.error || !acesso.data) throw new Error("Ative seu plano para usar o Minerador Viral.");
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  async function banco(path: string, init: RequestInit = {}) {
    const r = await fetch(`${db}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new Error(
        "Não foi possível acessar o minerador. Aplique a migração viral_buscas pela Lovable.",
      );
    return r.status === 204 ? [] : await r.json();
  }
  const segredos = (await banco("app_secrets?chave=eq.apify_token&select=valor")) as {
    valor: string;
  }[];
  const token = segredos[0]?.valor;
  if (d.acao === "config") return resposta({ configurado: !!token });
  if (!token)
    throw new Error(
      "O dono do aplicativo precisa conectar a Apify para localizar perfis e baixar os vídeos.",
    );
  async function apify(path: string, body?: Record<string, unknown>) {
    const r = await fetch(`${APIFY}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw new Error(
        `O serviço de coleta respondeu ${r.status}. Confira a chave, o saldo e os coletores da Apify.`,
      );
    return await r.json();
  }
  const endpoint = "viral_buscas";
  async function atualizar(id: string, campos: Record<string, unknown>) {
    await banco(`${endpoint}?id=eq.${id}&user_id=eq.${usuario}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(campos),
    });
  }
  if (d.acao === "iniciar") {
    const perfil = lerPerfil(d.perfil ?? ""),
      limite = d.limite ?? 100;
    // Uma coleta por usuário. Reservamos antes de chamar o serviço pago.
    await banco(
      `${endpoint}?user_id=eq.${usuario}&status=eq.processando&criado_em=lt.${encodeURIComponent(new Date(Date.now() - 20 * 60000).toISOString())}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "expirado" }),
      },
    );
    const recentes = (await banco(
      `${endpoint}?user_id=eq.${usuario}&criado_em=gt.${encodeURIComponent(new Date(Date.now() - 3600000).toISOString())}&select=id`,
    )) as Busca[];
    if (recentes.length >= 10)
      throw new Error("Você já iniciou 10 buscas nesta hora. Aguarde para buscar novamente.");
    const id = crypto.randomUUID();
    await banco(endpoint, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id, user_id: usuario, perfil, status: "processando" }),
    });
    try {
      const actor =
        perfil.plataforma === "instagram"
          ? "apify~instagram-reel-scraper"
          : perfil.plataforma === "tiktok"
            ? "clockworks~tiktok-scraper"
            : "streamers~youtube-scraper";
      const input =
        perfil.plataforma === "instagram"
          ? { username: [perfil.nome], resultsLimit: limite }
          : perfil.plataforma === "tiktok"
            ? {
                profiles: [perfil.nome],
                resultsPerPage: limite,
                shouldDownloadVideos: true,
                profileScrapeSections: ["videos"],
              }
            : {
                startUrls: [{ url: perfil.url }],
                maxResults: Math.ceil(limite / 2),
                maxResultsShorts: Math.floor(limite / 2),
                maxResultStreams: 0,
              };
      const run = await apify(`acts/${actor}/runs?timeout=900&memory=1024`, input);
      await atualizar(id, { run_id: run.data.id });
      return resposta({ busca: id, status: "processando" });
    } catch (e) {
      await atualizar(id, { status: "erro" });
      throw e;
    }
  }
  if (!d.busca) throw new Error("Escolha uma busca válida.");
  const linhas = (await banco(
    `${endpoint}?id=eq.${d.busca}&user_id=eq.${usuario}&select=*`,
  )) as Busca[];
  const busca = linhas[0];
  if (!busca) throw new Error("Essa busca não pertence à sua conta ou não existe mais.");
  async function resultadoRun(id: string): Promise<unknown[] | null> {
    if (!/^[a-zA-Z0-9]+$/.test(id)) throw new Error("Coleta inválida.");
    const run = await apify(`actor-runs/${id}`);
    if (["READY", "RUNNING"].includes(run.data.status)) return null;
    if (run.data.status !== "SUCCEEDED")
      throw new Error(
        "A coleta não terminou. O perfil pode estar privado, indisponível ou bloqueado pela rede social.",
      );
    const dataset = String(run.data.defaultDatasetId);
    if (!/^[a-zA-Z0-9]+$/.test(dataset)) throw new Error("Resultado inválido.");
    return (await apify(`datasets/${dataset}/items?clean=true&limit=200`)) as unknown[];
  }
  if (d.acao === "consultar") {
    if (busca.status === "erro" || busca.status === "expirado")
      throw new Error("Essa coleta expirou ou falhou. Inicie outra busca.");
    if (busca.status === "pronto") return resposta({ busca: busca.id, videos: busca.videos });
    if (!busca.run_id) return resposta({ busca: busca.id, status: "processando" });
    try {
      const itens = await resultadoRun(busca.run_id);
      if (itens === null) return resposta({ busca: busca.id, status: "processando" });
      const videos = normalizarVideos(itens, busca.perfil.plataforma);
      await atualizar(busca.id, { status: "pronto", videos });
      return resposta({ busca: busca.id, videos });
    } catch (e) {
      await atualizar(busca.id, { status: "erro" });
      throw e;
    }
  }
  if (busca.status !== "pronto") throw new Error("Espere a busca terminar.");
  if (d.acao === "preparar") {
    const ids = new Set(d.ids ?? []),
      videos = busca.videos.filter((v) => ids.has(v.id));
    if (!videos.length || videos.length !== ids.size)
      throw new Error("Selecione vídeos desta busca.");
    if (busca.perfil.plataforma !== "youtube")
      return resposta({ busca: busca.id, videos: busca.videos });
    if (busca.download_run === "reservando") {
      if (!busca.download_iniciado || Date.now() - Date.parse(busca.download_iniciado) > 120000) {
        await atualizar(busca.id, { download_run: null, download_iniciado: null });
        throw new Error("A preparação foi interrompida. Tente baixar novamente.");
      }
      return resposta({ busca: busca.id, status: "baixando" });
    }
    if (busca.download_run) {
      const itens = await resultadoRun(busca.download_run);
      if (itens === null) return resposta({ busca: busca.id, status: "baixando" });
      const arquivos = itens as { videoId?: string; downloadUrl?: string }[];
      busca.videos = busca.videos.map((v) => ({
        ...v,
        arquivo: arquivos.find((a) => a.videoId === v.id)?.downloadUrl ?? v.arquivo,
      }));
      const falharam = videos.filter((v) => !busca.videos.find((a) => a.id === v.id)?.arquivo);
      await atualizar(busca.id, { videos: busca.videos, download_run: null });
      if (falharam.length)
        throw new Error(
          "O serviço não conseguiu baixar todos os vídeos selecionados. Remova os indisponíveis ou tente novamente depois.",
        );
    }
    const faltam = videos.filter((v) => !busca.videos.find((a) => a.id === v.id)?.arquivo);
    if (faltam.length) {
      const reserva = (await banco(
        `${endpoint}?id=eq.${busca.id}&user_id=eq.${usuario}&download_run=is.null`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            download_run: "reservando",
            download_iniciado: new Date().toISOString(),
          }),
        },
      )) as Busca[];
      if (!reserva.length) return resposta({ busca: busca.id, status: "baixando" });
      let run;
      try {
        run = await apify("acts/datapipe~youtube-video-downloader/runs?timeout=900&memory=1024", {
          videoUrls: faltam.map((v) => v.link),
          quality: "720p",
          format: "mp4",
          maxConcurrency: 1,
        });
      } catch (e) {
        await atualizar(busca.id, { download_run: null });
        throw e;
      }
      await atualizar(busca.id, { download_run: run.data.id });
      return resposta({ busca: busca.id, status: "baixando" });
    }
    return resposta({ busca: busca.id, videos: busca.videos });
  }
  const video = busca.videos.find((v) => v.id === d.id);
  if (!video?.arquivo)
    throw new Error("Este vídeo não possui arquivo para baixar. Tente atualizar a busca.");
  const url = urlMidia(video.arquivo);
  const r = await fetch(url, {
    headers: url.hostname === "api.apify.com" ? { Authorization: `Bearer ${token}` } : {},
    redirect: "error",
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok || !r.body)
    throw new Error("O arquivo expirou ou a rede bloqueou o download. Faça uma nova busca.");
  const tipo = r.headers.get("content-type") ?? "";
  if (!tipo.includes("video/") && !tipo.includes("octet-stream"))
    throw new Error("O serviço devolveu uma página em vez de um vídeo.");
  // Limite por arquivo protege a resposta serializada e a memória do celular.
  const max = 48 * 1024 * 1024;
  if (Number(r.headers.get("content-length")) > max) {
    await r.body.cancel();
    throw new Error("Este vídeo passa de 48 MB. Escolha um vídeo menor.");
  }
  const reader = r.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error("Este vídeo passa de 48 MB. Escolha um vídeo menor.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  // Verifica contêiner MP4/WebM; não repassa HTML nem arquivos executáveis.
  const mp4 = new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp",
    webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (!mp4 && !webm) throw new Error("O download não é um vídeo MP4 ou WebM válido.");
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192)
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const nome = `${busca.perfil.nome.replace(/[^\p{L}\p{N}_-]/gu, "_")}_${video.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.${webm ? "webm" : "mp4"}`;
  return resposta({ busca: busca.id, base64: btoa(bin), nome });
}
