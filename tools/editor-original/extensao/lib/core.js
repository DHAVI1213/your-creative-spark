// Minerador Viral — funções comuns (painel, coletores e testes).
(function (root) {
  "use strict";

  const PLATAFORMAS = {
    instagram: { nome: "Instagram", itens: "Reels" },
    tiktok: { nome: "TikTok", itens: "vídeos" },
    youtube: { nome: "YouTube Shorts", itens: "Shorts" },
  };
  const NAO_PERFIL_IG = new Set([
    "explore",
    "reels",
    "reel",
    "p",
    "stories",
    "direct",
    "accounts",
    "about",
    "legal",
    "developer",
    "api",
    "web",
    "challenge",
    "emails",
    "privacy",
    "terms",
    "your_activity",
  ]);

  // Descobre plataforma e perfil a partir da URL da aba.
  function detectar(url) {
    let u;
    try {
      u = new URL(url);
    } catch (_) {
      return null;
    }
    const host = u.hostname.replace(/^(www|m)\./, "");
    const partes = u.pathname.split("/").filter(Boolean);
    if (host === "instagram.com") {
      const p = (partes[0] || "").toLowerCase();
      if (!p || NAO_PERFIL_IG.has(p) || !/^[a-z0-9._]{1,30}$/.test(p)) return null;
      if (partes.length > 2 || (partes.length === 2 && !["reels", "tagged"].includes(partes[1])))
        return null;
      return { plataforma: "instagram", perfil: p };
    }
    if (host === "tiktok.com") {
      const p = partes[0] && partes[0].startsWith("@") ? partes[0].slice(1).toLowerCase() : "";
      if (!p || partes.length > 1 || !/^[a-z0-9._-]{2,32}$/.test(p)) return null;
      return { plataforma: "tiktok", perfil: p };
    }
    if (host === "youtube.com") {
      let p = "";
      if (partes[0] && partes[0].startsWith("@")) p = partes[0].slice(1);
      else if (["channel", "c", "user"].includes(partes[0]) && partes[1]) p = partes[1];
      if (!p) return null;
      return {
        plataforma: "youtube",
        perfil: decodeURIComponent(p).toLowerCase(),
        naAbaShorts: partes[partes.length - 1] === "shorts",
      };
    }
    return null;
  }

  // "1,2 mi", "15K", "3.402", "2,5 mil visualizações", "1.2M views" → número
  function lerNumero(v) {
    if (typeof v === "number") return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    let t = String(v || "")
      .toLowerCase()
      .replace(/ /g, " ")
      .trim();
    if (!t) return 0;
    const m = t.match(/(\d[\d.,\s]*)\s*(mil|mi|bi|k|m|b)?\b/);
    if (!m) return 0;
    let num = m[1].replace(/\s/g, "");
    const suf = m[2] || "";
    const mult = { k: 1e3, mil: 1e3, m: 1e6, mi: 1e6, b: 1e9, bi: 1e9 }[suf] || 1;
    if (mult === 1) return Number(num.replace(/[.,]/g, "")) || 0;
    // com sufixo, vírgula ou ponto é decimal ("1,2 mi" / "1.2M")
    num = num.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = parseFloat(num);
    return Number.isFinite(n) ? Math.round(n * mult) : 0;
  }

  function formatar(n) {
    n = Number(n) || 0;
    const f = (x, d) => x.toFixed(d).replace(/\.0$/, "").replace(".", ",");
    if (n >= 1e9) return f(n / 1e9, n >= 1e10 ? 0 : 1) + " bi";
    if (n >= 1e6) return f(n / 1e6, n >= 1e7 ? 0 : 1) + " mi";
    if (n >= 1e3) return f(n / 1e3, n >= 1e4 ? 0 : 1) + " mil";
    return String(Math.round(n));
  }

  function mediana(nums) {
    const a = nums.filter((n) => n > 0).sort((x, y) => x - y);
    if (!a.length) return 0;
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  }

  // Score viral (0–100): quanto o vídeo superou a mediana do próprio perfil,
  // ajustado pelo engajamento quando a plataforma informa curtidas/comentários.
  function pontuar(lista) {
    const med = mediana(lista.map((v) => v.views));
    for (const v of lista) {
      const views = v.views || 0;
      v.multiplo = med ? views / med : 0;
      const desempenho = v.multiplo > 0 ? Math.min(70, 35 + (35 * Math.log2(v.multiplo)) / 3) : 0; // 1× = 35, 8× = 70
      let engaj = 0;
      if (views && (v.likes || v.comments)) {
        v.engajamento = ((v.likes || 0) + (v.comments || 0) * 3) / views;
        engaj = Math.min(30, v.engajamento * 300); // 10% de engajamento = 30
      } else {
        v.engajamento = null;
        engaj = desempenho * 0.25; // sem curtidas: só o desempenho conta
      }
      v.score = Math.max(0, Math.min(100, Math.round(desempenho + engaj)));
      // Potencial viral (0–100): alcance absoluto (1 mil views = 0 · 10 mi = 70) + engajamento.
      // Não depende do tamanho do perfil: bom para comparar vídeos de perfis diferentes.
      const alcance = views > 0 ? Math.min(70, Math.max(0, (Math.log10(views) - 3) / 4) * 70) : 0;
      v.potencial = Math.max(
        0,
        Math.min(100, Math.round(alcance + (v.engajamento != null ? engaj : alcance * 0.25))),
      );
    }
    return med;
  }

  const ORDENS = {
    score: (a, b) => b.score - a.score || b.views - a.views,
    potencial: (a, b) => (b.potencial || 0) - (a.potencial || 0) || b.views - a.views,
    views: (a, b) => b.views - a.views,
    likes: (a, b) => (b.likes || 0) - (a.likes || 0),
    comments: (a, b) => (b.comments || 0) - (a.comments || 0),
    engajamento: (a, b) => (b.engajamento || 0) - (a.engajamento || 0),
    recentes: (a, b) => (b.data || 0) - (a.data || 0) || a.ordem - b.ordem,
  };
  function ordenar(lista, ordem) {
    return lista.slice().sort(ORDENS[ordem] || ORDENS.score);
  }

  function filtrar(lista, f) {
    const agora = Date.now() / 1000;
    return lista.filter((v) => {
      if (f.minViews && (v.views || 0) < f.minViews) return false;
      if (f.minLikes && (v.likes || 0) < f.minLikes) return false;
      if (f.minComments && (v.comments || 0) < f.minComments) return false;
      if (f.dias && v.data && agora - v.data > f.dias * 86400) return false;
      return true;
    });
  }

  function nomeArquivo(s, padrao = "arquivo") {
    const t = String(s || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 60);
    return t || padrao;
  }

  // ---------------------------------------------------------------- CSV
  function csv(lista, plataforma, perfil) {
    const q = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const cab = [
      "posicao",
      "plataforma",
      "perfil",
      "id",
      "link",
      "score",
      "potencial",
      "x_mediana",
      "views",
      "curtidas",
      "comentarios",
      "engajamento_pct",
      "publicado",
      "legenda",
    ];
    const linhas = lista.map((v, i) =>
      [
        i + 1,
        plataforma,
        perfil,
        v.id,
        v.link,
        v.score,
        v.potencial ?? "",
        v.multiplo ? v.multiplo.toFixed(2) : "",
        v.views || 0,
        v.likes ?? "",
        v.comments ?? "",
        v.engajamento != null ? (v.engajamento * 100).toFixed(2) : "",
        v.data ? new Date(v.data * 1000).toISOString().slice(0, 10) : "",
        v.legenda || "",
      ]
        .map(q)
        .join(";"),
    );
    return "﻿" + [cab.map(q).join(";"), ...linhas].join("\r\n") + "\r\n";
  }

  // ---------------------------------------------------------------- ZIP (sem compressão, vídeo já é comprimido)
  const TAB_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = TAB_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  class Zip {
    constructor() {
      this.blocos = [];
      this.centrais = [];
      this.pos = 0;
    }
    adicionar(nome, dados) {
      const bytes = dados instanceof Uint8Array ? dados : new TextEncoder().encode(String(dados));
      const nomeB = new TextEncoder().encode(nome);
      const crc = crc32(bytes);
      const d = new Date();
      const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
      const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      const loc = new DataView(new ArrayBuffer(30));
      loc.setUint32(0, 0x04034b50, true);
      loc.setUint16(4, 20, true);
      loc.setUint16(6, 0x0800, true); // nomes em UTF-8
      loc.setUint16(8, 0, true); // sem compressão
      loc.setUint16(10, hora, true);
      loc.setUint16(12, dia, true);
      loc.setUint32(14, crc, true);
      loc.setUint32(18, bytes.length, true);
      loc.setUint32(22, bytes.length, true);
      loc.setUint16(26, nomeB.length, true);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(12, hora, true);
      cen.setUint16(14, dia, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, bytes.length, true);
      cen.setUint32(24, bytes.length, true);
      cen.setUint16(28, nomeB.length, true);
      cen.setUint32(42, this.pos, true);
      this.blocos.push(new Uint8Array(loc.buffer), nomeB, bytes);
      this.centrais.push(new Uint8Array(cen.buffer), nomeB);
      this.pos += 30 + nomeB.length + bytes.length;
    }
    partes() {
      const inicio = this.pos;
      const tam = this.centrais.reduce((s, b) => s + b.length, 0);
      const fim = new DataView(new ArrayBuffer(22));
      fim.setUint32(0, 0x06054b50, true);
      fim.setUint16(8, this.centrais.length / 2, true);
      fim.setUint16(10, this.centrais.length / 2, true);
      fim.setUint32(12, tam, true);
      fim.setUint32(16, inicio, true);
      return [...this.blocos, ...this.centrais, new Uint8Array(fim.buffer)];
    }
    get tamanho() {
      return this.pos;
    }
  }

  const api = {
    PLATAFORMAS,
    detectar,
    lerNumero,
    formatar,
    mediana,
    pontuar,
    ordenar,
    filtrar,
    nomeArquivo,
    csv,
    crc32,
    Zip,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MV = api;
})(typeof self !== "undefined" ? self : globalThis);
