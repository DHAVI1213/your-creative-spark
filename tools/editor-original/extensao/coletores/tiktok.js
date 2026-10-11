// Coletor do TikTok: dados que a própria página carrega + grade do perfil.
(function () {
  "use strict";
  const { getJSON, progresso, esperar, percorrer, rolarAte } = self.MVC;

  function deItem(it, ordem, perfil) {
    const v = it && (it.itemStruct || it);
    const id = String((v && (v.id || v.aweme_id)) || "");
    if (!/^\d{8,30}$/.test(id)) return null;
    const st = v.stats || v.statsV2 || v.statistics || {};
    const vid = v.video || {};
    const autor = ((v.author && (v.author.uniqueId || v.author.unique_id)) || perfil || "").replace(
      /^@/,
      "",
    );
    if (autor && perfil && autor.toLowerCase() !== perfil.toLowerCase()) return null; // ignora vídeos de outros perfis (sugestões)
    const url = (x) =>
      typeof x === "string" ? x : (x && (x.url_list || x.urlList || [])[0]) || "";
    return {
      id,
      link: `https://www.tiktok.com/@${autor || perfil}/video/${id}`,
      views: Number(st.playCount ?? st.play_count) || 0,
      likes: st.diggCount ?? st.digg_count ?? null,
      comments: st.commentCount ?? st.comment_count ?? null,
      shares: st.shareCount ?? st.share_count ?? null,
      data: Number(v.createTime || v.create_time) || 0,
      thumb: url(vid.cover) || url(vid.originCover) || url(vid.dynamicCover),
      video: "", // o TikTok bloqueia baixar direto: o app Editor em Massa baixa pelo link
      duracao: vid.duration || 0,
      legenda: v.desc || "",
      ordem,
    };
  }

  function juntar(mapa, item) {
    if (!item) return;
    const v = mapa.get(item.id);
    if (!v) return mapa.set(item.id, item);
    mapa.set(item.id, {
      ...v,
      ...Object.fromEntries(
        Object.entries(item).filter(([, x]) => x !== null && x !== "" && x !== 0),
      ),
      views: Math.max(v.views || 0, item.views || 0),
      ordem: v.ordem,
    });
  }

  function dadosDaPagina() {
    const out = [];
    for (const s of document.querySelectorAll(
      'script#__UNIVERSAL_DATA_FOR_REHYDRATION__, script#SIGI_STATE, script[type="application/json"]',
    )) {
      try {
        out.push(JSON.parse(s.textContent || "{}"));
      } catch (_) {}
    }
    return out;
  }

  function secUidDe(dados, perfil) {
    let sec = "";
    for (const d of dados)
      percorrer(d, (o) => {
        const u = o.user || o;
        if (!sec && u && u.secUid && String(u.uniqueId || "").toLowerCase() === perfil)
          sec = u.secUid;
      });
    return sec;
  }

  async function coletar(opts) {
    const perfil = opts.perfil.toLowerCase();
    const limite = Math.max(1, Math.min(5000, opts.analisar || 300));
    const mapa = new Map();
    const cont = self.MVC.contador(opts);
    let aviso = "",
      completo = false;

    progresso("Lendo o perfil…", 0, 3);
    const dados = dadosDaPagina();
    for (const d of dados) percorrer(d, (o) => juntar(mapa, deItem(o, mapa.size, perfil)));

    // 1) tenta a lista paginada que o site usa (às vezes o TikTok exige assinatura e recusa)
    const sec = secUidDe(dados, perfil);
    if (sec) {
      let cursor = "0";
      for (let pag = 0; pag < 120 && mapa.size < limite && !cont.bastou(); pag++) {
        const q = new URLSearchParams({
          aid: "1988",
          app_name: "tiktok_web",
          device_platform: "web_pc",
          count: "35",
          cursor,
          secUid: sec,
          coverFormat: "2",
        });
        let r;
        try {
          r = await getJSON(`${location.origin}/api/post/item_list/?${q}`, {}, 1);
        } catch (_) {
          break;
        }
        const lista = r.itemList || r.item_list || [];
        if (!lista.length) break;
        const antes = mapa.size;
        const pagina = lista.map((it) => deItem(it, mapa.size, perfil)).filter(Boolean);
        pagina.forEach((v) => juntar(mapa, v));
        cont.recontar(mapa);
        progresso(
          `Lendo os vídeos · ${cont.aprovados} aprovados · ${mapa.size} analisados`,
          mapa.size,
          Math.min(90, 5 + 85 * Math.max(mapa.size / limite, cont.aprovados / cont.quero)),
        );
        if (cont.paginaVelha(pagina)) {
          completo = true;
          break;
        }
        if (!(r.hasMore ?? r.has_more)) {
          completo = true;
          break;
        }
        if (mapa.size === antes || !r.cursor) break;
        cursor = String(r.cursor);
      }
    }

    // 2) completa rolando a grade do perfil (só traz visualizações)
    cont.recontar(mapa);
    if (!completo && mapa.size < limite && !cont.bastou()) {
      await rolarAte(
        () => {
          for (const a of document.querySelectorAll('a[href*="/video/"]')) {
            const m = (a.getAttribute("href") || "").match(/@([^/]+)\/video\/(\d{8,30})/);
            if (!m || m[1].toLowerCase() !== perfil || mapa.has(m[2])) continue;
            const card = a.closest('[data-e2e="user-post-item"]') || a;
            const img = card.querySelector("img");
            const vw = card.querySelector('[data-e2e="video-views"]');
            juntar(mapa, {
              id: m[2],
              link: `https://www.tiktok.com/@${m[1]}/video/${m[2]}`,
              views: self.MV.lerNumero(vw ? vw.textContent : card.innerText),
              likes: null,
              comments: null,
              data: 0,
              thumb: (img && (img.currentSrc || img.src)) || "",
              video: "",
              legenda: (img && img.alt) || "",
              ordem: mapa.size,
            });
          }
          cont.recontar(mapa);
          return cont.bastou() ? Infinity : mapa.size;
        },
        limite,
        "Rolando a grade do TikTok",
      );
      if (mapa.size && [...mapa.values()].every((v) => v.likes == null))
        aviso = "O TikTok só mostrou as visualizações nesta leitura (sem curtidas e comentários).";
    }
    if (!mapa.size)
      throw new Error(
        "Nenhum vídeo encontrado. Espere a grade do perfil carregar e tente de novo.",
      );
    // o TikTok não traz a ordem por data na grade: usa o id (que cresce com o tempo)
    const itens = [...mapa.values()]
      .sort((a, b) => (b.data || 0) - (a.data || 0) || (BigInt(b.id) > BigInt(a.id) ? 1 : -1))
      .slice(0, limite)
      .map((v, i) => ({ ...v, ordem: i }));
    cont.recontar(mapa);
    return { perfil, itens, completo, aviso, aprovados: cont.aprovados, bastou: cont.bastou() };
  }

  // Dados completos de vídeos escolhidos à mão: abre a página de cada vídeo (com a sua sessão).
  async function detalhar(itens) {
    return self.MVC.emParalelo(
      itens,
      3,
      async (it) => {
        const html = await self.MVC.getTexto(it.link);
        const blocos = [];
        const re =
          /<script[^>]*(?:id="__UNIVERSAL_DATA_FOR_REHYDRATION__"|id="SIGI_STATE"|type="application\/json")[^>]*>([\s\S]*?)<\/script>/g;
        let m;
        while ((m = re.exec(html))) {
          try {
            blocos.push(JSON.parse(m[1]));
          } catch (_) {}
        }
        let achado = null;
        for (const b of blocos)
          percorrer(b, (o) => {
            if (achado) return;
            const v = deItem(o, 0, "");
            if (v && v.id === String(it.id)) achado = v;
          });
        if (!achado) return { erro: "O TikTok não mostrou os dados deste vídeo" };
        return {
          views: achado.views,
          likes: achado.likes,
          comments: achado.comments,
          data: achado.data,
          legenda: achado.legenda,
          thumb: achado.thumb,
        };
      },
      "Buscando os dados dos vídeos",
    );
  }

  async function parecidos(perfil) {
    return self.MVC.perfisNaPagina(
      /^(?:https:\/\/www\.tiktok\.com)?\/@([\w.-]{2,32})\/?(?:\?|$)/,
      perfil,
      (u, nome, foto) => ({ usuario: u, nome, foto }),
    );
  }

  self.MV_COLETOR = { plataforma: "tiktok", coletar, detalhar, parecidos, _deItem: deItem };
})();
