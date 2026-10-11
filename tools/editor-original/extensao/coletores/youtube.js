// Coletor do YouTube Shorts: lê a aba Shorts do canal e segue a paginação do próprio site.
(function () {
  "use strict";
  const { getJSON, getTexto, jsonApos, progresso, percorrer, esperar } = self.MVC;

  const txt = (v) =>
    typeof v === "string"
      ? v
      : (v && (v.content || v.simpleText || (v.runs || []).map((r) => r.text).join(""))) || "";

  function deItem(o, ordem) {
    let id = "",
      titulo = "",
      viewsTxt = "",
      thumb = "";
    if (o.shortsLockupViewModel) {
      const s = o.shortsLockupViewModel;
      id =
        (((s.onTap || {}).innertubeCommand || {}).reelWatchEndpoint || {}).videoId ||
        String(s.entityId || "").replace(/^shorts-shelf-item-/, "");
      titulo = txt((s.overlayMetadata || {}).primaryText) || txt(s.accessibilityText);
      viewsTxt = txt((s.overlayMetadata || {}).secondaryText);
      thumb = (((s.thumbnail || {}).sources || [])[0] || {}).url || "";
    } else if (o.reelItemRenderer) {
      const r = o.reelItemRenderer;
      id = r.videoId;
      titulo = txt(r.headline);
      viewsTxt = txt(r.viewCountText);
      thumb = (((r.thumbnail || {}).thumbnails || [])[0] || {}).url || "";
    } else return null;
    if (!/^[\w-]{6,20}$/.test(id || "")) return null;
    return {
      id,
      link: `https://www.youtube.com/shorts/${id}`,
      views: self.MV.lerNumero(viewsTxt),
      likes: null,
      comments: null,
      data: 0,
      thumb,
      video: "",
      legenda: titulo,
      ordem,
    };
  }

  function itensDe(obj, mapa) {
    percorrer(obj, (o) => {
      const it = deItem(o, mapa.size);
      if (it && !mapa.has(it.id)) mapa.set(it.id, it);
    });
  }

  function proximoToken(obj, usados) {
    let tok = "";
    percorrer(obj, (o) => {
      const t =
        o.continuationItemRenderer &&
        ((o.continuationItemRenderer.continuationEndpoint || {}).continuationCommand || {}).token;
      if (!tok && t && !usados.has(t)) tok = t;
    });
    return tok;
  }

  async function coletar(opts) {
    const limite = Math.max(1, Math.min(5000, opts.analisar || 300));
    const mapa = new Map();
    const cont = self.MVC.contador(opts);
    let completo = false,
      aviso = "";

    // Baixa a aba Shorts do zero (os dados da página podem ser de outra aba depois de navegar).
    const base = location.pathname.split("/").filter(Boolean)[0];
    progresso("Lendo a aba Shorts do canal…", 0, 3);
    const html = await getTexto(`${location.origin}/${base}/shorts`);
    const inicial = jsonApos(html, "var ytInitialData =") || jsonApos(html, "ytInitialData");
    if (!inicial) throw new Error("Não achei a aba Shorts deste canal");
    const chave = (html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/) || [])[1];
    const versao =
      (html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/) || [])[1] || "2.20250101.00.00";
    const nome =
      txt(((inicial.header || {}).pageHeaderRenderer || {}).pageTitle) ||
      ((inicial.metadata || {}).channelMetadataRenderer || {}).title ||
      "";

    // só a aba selecionada (Shorts), não as outras
    let aba = null;
    percorrer(inicial, (o) => {
      if (!aba && o.tabRenderer && o.tabRenderer.selected) aba = o.tabRenderer;
    });
    itensDe(aba || inicial, mapa);
    let token = proximoToken(aba || inicial, new Set());
    const usados = new Set();

    cont.recontar(mapa);
    while (token && chave && mapa.size < limite && !cont.bastou() && usados.size < 150) {
      usados.add(token);
      let r;
      try {
        r = await getJSON(
          `${location.origin}/youtubei/v1/browse?key=${encodeURIComponent(chave)}&prettyPrint=false`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: {
                client: { clientName: "WEB", clientVersion: versao, hl: "pt-BR", gl: "BR" },
              },
              continuation: token,
            }),
          },
        );
      } catch (e) {
        aviso = e.message;
        break;
      }
      const antes = mapa.size;
      itensDe(r.onResponseReceivedActions || r, mapa);
      cont.recontar(mapa);
      progresso(
        `Lendo os Shorts · ${cont.aprovados} aprovados · ${mapa.size} analisados`,
        mapa.size,
        Math.min(95, 5 + 90 * Math.max(mapa.size / limite, cont.aprovados / cont.quero)),
      );
      token = proximoToken(r.onResponseReceivedActions || r, usados);
      if (!token) completo = true;
      if (mapa.size === antes) break;
    }
    if (!token) completo = true;
    if (!mapa.size) throw new Error("Nenhum Short encontrado neste canal");
    cont.recontar(mapa);
    return {
      perfil: opts.perfil,
      nome,
      itens: [...mapa.values()].slice(0, limite),
      completo,
      aviso: aviso || "O YouTube só mostra as visualizações na grade de Shorts.",
      aprovados: cont.aprovados,
      bastou: cont.bastou(),
    };
  }

  // Dados de Shorts escolhidos à mão: visualizações, data e título pela página do vídeo.
  async function detalhar(itens) {
    return self.MVC.emParalelo(
      itens,
      3,
      async (it) => {
        const html = await getTexto(it.link);
        const pr =
          jsonApos(html, "var ytInitialPlayerResponse =") ||
          jsonApos(html, "ytInitialPlayerResponse");
        if (!pr || !pr.videoDetails) return { erro: "O YouTube não mostrou os dados deste Short" };
        const mf = (pr.microformat || {}).playerMicroformatRenderer || {};
        const quando = Date.parse(mf.publishDate || mf.uploadDate || "");
        return {
          views: Number(pr.videoDetails.viewCount) || 0,
          legenda: pr.videoDetails.title || "",
          data: Number.isFinite(quando) ? Math.floor(quando / 1000) : 0,
        };
      },
      "Buscando os dados dos Shorts",
    );
  }

  async function parecidos(perfil) {
    return self.MVC.perfisNaPagina(
      /^(?:https:\/\/www\.youtube\.com)?\/@([^/?#]{2,60})\/?(?:\?|$|\/(?:shorts|videos|featured)?$)/,
      perfil,
      (u, nome, foto) => ({ usuario: u, nome, foto }),
    );
  }

  self.MV_COLETOR = { plataforma: "youtube", coletar, detalhar, parecidos, _deItem: deItem };
})();
