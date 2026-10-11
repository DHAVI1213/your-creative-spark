// Coletor do Instagram: usa a mesma API interna que o site usa, com a sua sessão.
(function () {
  "use strict";
  const { getJSON, progresso, rolarAte } = self.MVC;
  const APP_ID = "936619743392459"; // identificador público do Instagram Web

  function cabecalhos() {
    const csrf = (document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || "";
    let claim = "0";
    try {
      claim = sessionStorage.getItem("www-claim-v2") || "0";
    } catch (_) {}
    // mesmos cabeçalhos que o próprio site do Instagram manda
    return {
      "X-IG-App-ID": APP_ID,
      "X-ASBD-ID": "129477",
      "X-IG-WWW-Claim": claim,
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRFToken": decodeURIComponent(csrf),
      Accept: "*/*",
    };
  }
  const api = (path) => getJSON(location.origin + path, { headers: cabecalhos() });
  // (as listas antigas /api/v1/clips/user/ e /api/v1/feed/user/ hoje devolvem HTML: não são mais usadas)

  const primeiraUrl = (lista) => (Array.isArray(lista) && lista[0] && lista[0].url) || "";

  // Item da API nova (feed) → formato do Minerador
  function deFeed(m, ordem) {
    if (!m || !m.code) return null;
    const ehVideo = m.media_type === 2 || !!(m.video_versions && m.video_versions.length);
    if (!ehVideo) return null;
    const rota = m.product_type === "clips" ? "reel" : "p";
    return {
      id: m.code,
      pk: String(m.pk || m.id || "").split("_")[0],
      link: `https://www.instagram.com/${rota}/${m.code}/`,
      views: Math.max(
        m.play_count || 0,
        m.ig_play_count || 0,
        m.view_count || 0,
        m.video_view_count || 0,
      ),
      likes: m.like_count ?? null,
      comments: m.comment_count ?? null,
      data: m.taken_at || 0,
      thumb: primeiraUrl(m.image_versions2 && m.image_versions2.candidates),
      video: primeiraUrl(m.video_versions),
      duracao: m.video_duration || 0,
      legenda: (m.caption && m.caption.text) || "",
      ordem,
    };
  }

  function juntar(mapa, item) {
    if (!item) return;
    const v = mapa.get(item.id);
    if (!v) return mapa.set(item.id, item);
    mapa.set(item.id, {
      ...v,
      views: Math.max(v.views || 0, item.views || 0),
      likes: v.likes ?? item.likes,
      comments: v.comments ?? item.comments,
      video: item.video || v.video,
      thumb: item.thumb || v.thumb,
      legenda: v.legenda || item.legenda,
      pk: v.pk || item.pk,
    });
  }

  // id numérico do perfil a partir de um HTML (da página aberta ou baixado)
  function idNoHtml(html, perfil) {
    const padroes = [
      /"profilePage_(\d+)"/,
      /"profile_id":"(\d+)"/,
      /"page_id":"profilePage_(\d+)"/,
      new RegExp(
        '"username":"' + perfil.replace(/\./g, "\\.") + '"[^{}]{0,400}?"(?:pk|id)":"(\\d+)"',
      ),
    ];
    for (const p of padroes) {
      const m = html.match(p);
      if (m) return m[1];
    }
    return "";
  }
  const htmlDaAba = () => [...document.scripts].map((s) => s.textContent).join("\n");

  // Chaves que o próprio site manda nas consultas (ficam no código da página)
  function chavesNoHtml(html) {
    const dtsg = (html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/) || [])[1] || "";
    const lsd = (html.match(/"LSD",\[\],\{"token":"([^"]+)"/) || [])[1] || "";
    return dtsg || lsd ? { dtsg, lsd } : null;
  }

  // A aba Reels do site usa esta consulta GraphQL (confirmado em 01/10/2026).
  // Se o Instagram trocar o número, a extensão procura o novo nos scripts já carregados.
  const CONSULTA = "PolarisProfileReelsTabContentQuery_connection";
  const DOC_PADRAO = "28989741540630190";
  async function acharDocId() {
    const urls = [
      ...new Set(
        performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => /\.js(\?|$)/.test(u)),
      ),
    ];
    const re = new RegExp(
      CONSULTA +
        '_instagramRelayOperation",\\[\\],\\(function\\([^)]*\\)\\{\\w+\\.exports="(\\d+)"',
    );
    for (const u of urls) {
      try {
        const m = (await (await fetch(u)).text()).match(re);
        if (m) return m[1];
      } catch (_) {}
    }
    return "";
  }

  // Data aproximada do post a partir do número interno (o Instagram embute a hora nele).
  function dataDoPk(pk) {
    try {
      return Number(((BigInt(pk) >> 23n) + 1314220021721n) / 1000n);
    } catch (_) {
      return 0;
    }
  }

  // Item da consulta da aba Reels → formato do Minerador
  function deReels(m, ordem) {
    if (!m || !m.code) return null;
    const pk = String(m.pk || m.id || "").split("_")[0];
    return {
      id: m.code,
      pk,
      link: `https://www.instagram.com/reel/${m.code}/`,
      views: Math.max(m.play_count || 0, m.ig_play_count || 0, m.view_count || 0),
      likes: m.like_and_view_counts_disabled ? null : (m.like_count ?? null),
      comments: m.comment_count ?? null,
      data: m.taken_at || dataDoPk(pk),
      thumb: primeiraUrl(m.image_versions2 && m.image_versions2.candidates),
      video: primeiraUrl(m.video_versions),
      duracao: m.video_duration || 0,
      legenda: (m.caption && m.caption.text) || "",
      autor: (m.user && m.user.username) || "",
      ordem,
    };
  }

  async function coletar(opts) {
    const perfil = opts.perfil;
    const limite = Math.max(1, Math.min(5000, opts.analisar || 300));
    const mapa = new Map();
    let aviso = "",
      completo = false;
    const cont = self.MVC.contador(opts);
    const status = (rota) => {
      cont.recontar(mapa);
      const pct = Math.min(95, 5 + 90 * Math.max(mapa.size / limite, cont.aprovados / cont.quero));
      progresso(
        `${rota} · ${cont.aprovados}${Number.isFinite(cont.quero) ? "/" + cont.quero : ""} aprovados · ${mapa.size} analisados`,
        mapa.size,
        pct,
      );
    };
    const continuar = () => mapa.size < limite && !cont.bastou();
    const csrf = () =>
      decodeURIComponent((document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || "");
    const naAbaReels = /^\/[^/]+\/reels\/?$/.test(location.pathname);
    const desteperfil = location.pathname.split("/")[1].toLowerCase() === perfil.toLowerCase();

    progresso("Lendo o perfil…", 0, 3);
    // id do perfil e chaves: da página aberta; se faltar, baixa a página do perfil
    let html = htmlDaAba();
    let userId = desteperfil ? idNoHtml(document.documentElement.innerHTML, perfil) : "";
    let chaves = chavesNoHtml(html);
    let paginaBaixada = false;
    const baixarPagina = async () => {
      if (paginaBaixada) return;
      paginaBaixada = true;
      try {
        const r = await fetch(`${location.origin}/${encodeURIComponent(perfil)}/`, {
          credentials: "include",
          cache: "no-store",
        });
        if (r.status === 429)
          throw new Error(
            "A plataforma pediu para ir mais devagar (429). Espere alguns minutos e tente de novo.",
          );
        if (/\/accounts\/login/.test(r.url))
          throw new Error("Sua sessão caiu: faça login de novo nesta aba e tente outra vez.");
        const h = await r.text();
        userId = idNoHtml(h, perfil) || userId;
        chaves = chavesNoHtml(h) || chaves;
      } catch (e) {
        aviso = aviso || e.message;
      }
    };
    if (!userId || !chaves) await baixarPagina();

    // Rota 1: a mesma consulta que a aba Reels do site faz (12 Reels por página, com views/curtidas/comentários)
    let docId = DOC_PADRAO,
      trocouDoc = false,
      conferiuDono = false;
    const consultar = async (after) => {
      const vars = {
        after: after || null,
        before: null,
        data: { include_feed_video: true, page_size: 12, target_user_id: String(userId) },
        first: 12,
        last: null,
        id: String(userId),
        __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: true,
      };
      const corpo = new URLSearchParams({
        fb_dtsg: chaves.dtsg,
        lsd: chaves.lsd,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: CONSULTA,
        variables: JSON.stringify(vars),
        server_timestamps: "true",
        doc_id: docId,
      });
      const r = await getJSON(
        location.origin + "/graphql/query",
        {
          method: "POST",
          headers: {
            ...cabecalhos(),
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRFToken": csrf(),
            "X-FB-LSD": chaves.lsd,
          }, // sem X-FB-Friendly-Name: com ele o Instagram devolve HTML
          body: corpo.toString(),
        },
        2,
      );
      const conn =
        r && r.data && r.data.fetch__XDTUserDict && r.data.fetch__XDTUserDict.clips_connection;
      if (!conn) {
        const msg = ((r && r.errors) || []).map((e) => e.message || e.summary).join(" ");
        throw Object.assign(new Error(msg || "A consulta de Reels não devolveu dados"), {
          semDados: true,
        });
      }
      return conn;
    };

    if (userId && chaves && !opts.soGrade) {
      let cursor = "";
      const vistos = new Set();
      try {
        for (let pag = 0; continuar() && pag < 450; pag++) {
          let conn;
          try {
            conn = await consultar(cursor);
          } catch (e) {
            if (!e.semDados || trocouDoc) throw e;
            // o número da consulta mudou: procura o novo nos scripts da página
            trocouDoc = true;
            const novo = await acharDocId();
            if (!novo || novo === docId) {
              if (!naAbaReels)
                return {
                  perfil,
                  itens: [],
                  precisaAbaReels: true,
                  aviso: "Vou abrir a aba Reels do perfil para continuar.",
                };
              throw e;
            }
            docId = novo;
            conn = await consultar(cursor);
          }
          const pagina = [];
          for (const ed of conn.edges || []) {
            const v = deReels(ed && ed.node && ed.node.media, mapa.size);
            if (v) {
              juntar(mapa, v);
              pagina.push(v);
            }
          }
          // confere se o id lido é mesmo deste perfil (a página pode ter mudado sem recarregar)
          if (!conferiuDono && pagina.length) {
            conferiuDono = true;
            const donos = pagina.filter(
              (v) => v.autor.toLowerCase() === perfil.toLowerCase(),
            ).length;
            if (!donos && !paginaBaixada) {
              mapa.clear();
              await baixarPagina();
              cursor = "";
              vistos.clear();
              continue;
            }
          }
          status("Lendo os Reels");
          const pi = conn.page_info || {};
          if (cont.paginaVelha(pagina.filter((v, i) => pag > 0 || i >= 3))) {
            completo = true; // já passou do período escolhido (ignora os fixados do topo)
            break;
          }
          if (!pi.has_next_page || !pi.end_cursor) {
            completo = true;
            break;
          }
          if (vistos.has(pi.end_cursor)) break;
          vistos.add(pi.end_cursor);
          cursor = pi.end_cursor;
        }
      } catch (e) {
        aviso = e.message;
      }
    } else if (!opts.soGrade) aviso = aviso || "Não achei o id do perfil nesta página";

    // Rota 2 (recuperação): rola a aba Reels do perfil e junta os cards carregados.
    // A aba principal não mostra visualizações e mistura fotos: lá não adianta rolar.
    let precisaAbaReels = false;
    if (!completo && continuar() && !naAbaReels) precisaAbaReels = true;
    else if (!completo && continuar()) {
      await rolarAte(
        () => {
          for (const a of document.querySelectorAll('main a[href*="/reel/"]')) {
            const code = (a.getAttribute("href").match(/\/reel\/([\w-]+)/) || [])[1];
            if (!code || mapa.has(code)) continue;
            const img = a.querySelector("img");
            const pk = idDoCodigo(code);
            mapa.set(code, {
              id: code,
              pk,
              link: `https://www.instagram.com/reel/${code}/`,
              views: self.MV.lerNumero(a.innerText) || null,
              likes: null,
              comments: null,
              data: dataDoPk(pk),
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
        "Rolando a aba Reels",
      );
      cont.recontar(mapa);
    }

    if (!mapa.size && precisaAbaReels) return { perfil, itens: [], precisaAbaReels: true, aviso };
    if (!mapa.size) throw new Error(aviso || "Nenhum vídeo encontrado neste perfil");
    const itens = [...mapa.values()].slice(0, limite);
    if (completo || cont.bastou()) aviso = ""; // achou o que precisava
    if (aviso) aviso = `Leitura parcial: ${aviso} Os vídeos já lidos estão abaixo.`;
    return {
      perfil,
      nome: "",
      seguidores: 0,
      itens,
      completo,
      aviso,
      aprovados: cont.aprovados,
      bastou: cont.bastou(),
      precisaAbaReels,
    };
  }

  // O código do post (ex.: Dat5T1qEU4n) é o número interno escrito em base 64.
  function idDoCodigo(code) {
    const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let n = 0n;
    for (const c of String(code).slice(0, 11)) {
      const i = abc.indexOf(c);
      if (i < 0) return "";
      n = n * 64n + BigInt(i);
    }
    return n ? n.toString() : "";
  }

  const desescapar = (s) => {
    try {
      return JSON.parse(`"${s}"`);
    } catch (_) {
      return s.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    }
  };

  // Busca o link atual do vídeo de um post: 1) API do post, 2) página do Reel.
  async function renovarUm(it) {
    let erro = "";
    const pk = it.pk || idDoCodigo(it.id);
    if (pk) {
      try {
        const m = ((await api(`/api/v1/media/${pk}/info/`)).items || [])[0];
        const video = m && primeiraUrl(m.video_versions);
        if (m && (video || m.play_count != null))
          return {
            video,
            thumb: primeiraUrl(m.image_versions2 && m.image_versions2.candidates),
            pk,
            legenda: (m.caption && m.caption.text) || "",
            data: m.taken_at || 0,
            views: Math.max(m.play_count || 0, m.ig_play_count || 0, m.view_count || 0) || null,
            likes: m.like_and_view_counts_disabled ? null : (m.like_count ?? null),
            comments: m.comment_count ?? null,
          };
      } catch (e) {
        erro = e.message;
      }
    }
    try {
      const r = await fetch(`${location.origin}/reel/${encodeURIComponent(it.id)}/`, {
        credentials: "include",
        cache: "no-store",
      });
      if (r.status === 429)
        throw new Error(
          "A plataforma pediu para ir mais devagar (429). Espere alguns minutos e tente de novo.",
        );
      const html = await r.text();
      const m =
        html.match(/"video_url":"((?:\\.|[^"\\])+)"/) ||
        html.match(/"video_versions":\[\{[^\]]*?"url":"((?:\\.|[^"\\])+)"/);
      const og = html.match(/<meta[^>]+property="og:video(?::secure_url)?"[^>]+content="([^"]+)"/);
      const video = m ? desescapar(m[1]) : og ? og[1].replace(/&amp;/g, "&") : "";
      if (video) return { video, pk };
      erro = erro || "O Instagram não mostrou o vídeo deste post";
    } catch (e) {
      erro = erro || e.message;
    }
    return { video: "", erro };
  }

  // Links de vídeo do Instagram expiram: busca links novos (4 ao mesmo tempo) na hora de baixar.
  async function renovar(itens) {
    const out = {};
    let i = 0;
    const worker = async () => {
      while (i < itens.length) {
        const it = itens[i++];
        out[it.id] = await renovarUm(it);
        progresso(
          `Buscando os dados dos vídeos · ${Object.keys(out).length}/${itens.length}`,
          Object.keys(out).length,
          (100 * Object.keys(out).length) / itens.length,
        );
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return out;
  }

  // Perfis parecidos: a mesma lista de sugestões que o Instagram mostra no perfil.
  async function parecidos(perfil) {
    let id =
      location.pathname.split("/")[1].toLowerCase() === perfil.toLowerCase()
        ? idNoHtml(document.documentElement.innerHTML, perfil)
        : "";
    if (!id) {
      const r = await fetch(`${location.origin}/${encodeURIComponent(perfil)}/`, {
        credentials: "include",
        cache: "no-store",
      });
      id = idNoHtml(await r.text(), perfil);
    }
    if (!id) throw new Error("Não achei o id do perfil");
    const d = await api(`/api/v1/discover/chaining/?target_id=${id}`);
    return (d.users || [])
      .filter((u) => u.username && u.username.toLowerCase() !== perfil.toLowerCase())
      .slice(0, 30)
      .map((u) => ({
        usuario: u.username,
        nome: u.full_name || "",
        verificado: !!u.is_verified,
        privado: !!u.is_private,
        foto: u.profile_pic_url || "",
      }));
  }

  self.MV_COLETOR = {
    plataforma: "instagram",
    coletar,
    renovar,
    detalhar: renovar,
    parecidos,
    _deFeed: deFeed,
    _deReels: deReels,
    _dataDoPk: dataDoPk,
    _idDoCodigo: idDoCodigo,
  };
})();
