// Desenha as camadas de imagem (fundo e sobreposição) num <canvas>.
// O mesmo código gera o preview ao vivo e os PNGs usados pelo FFmpeg na exportação.
(function () {
  "use strict";
  const FALLBACK = '"Segoe UI", Arial, sans-serif';

  const fontStr = (fam, weight, size) => `${weight} ${Math.round(size)}px "${fam}", ${FALLBACK}`;

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function rgba(hex, a) {
    let h = String(hex || "#000000").replace("#", "");
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    const n = parseInt(h, 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function wrapLines(ctx, text, maxW) {
    const out = [];
    for (const para of text.split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) {
        out.push("");
        continue;
      }
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = line + " " + words[i];
        if (ctx.measureText(test).width <= maxW) line = test;
        else {
          out.push(line);
          line = words[i];
        }
      }
      out.push(line);
    }
    return out;
  }

  function drawTextBlock(ctx, text, o) {
    ctx.font = o.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapLines(ctx, text, o.maxW);
    const lh = o.size * o.lineH;
    const total = lh * lines.length;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    // mantém o bloco dentro da tela
    const x = Math.min(Math.max(o.x, widest / 2 + 12), o.canvasW - widest / 2 - 12);
    const top = o.y - total / 2;
    if (o.box) {
      const padX = o.size * 0.45,
        padY = o.size * 0.3;
      roundRect(
        ctx,
        x - widest / 2 - padX,
        top - padY,
        widest + padX * 2,
        total + padY * 2,
        o.size * 0.3,
      );
      ctx.fillStyle = rgba(o.boxColor, o.boxAlpha ?? 0.78);
      ctx.fill();
    }
    lines.forEach((l, i) => {
      const y = top + lh * i + lh / 2;
      if (o.stroke) {
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.lineWidth = o.size * 0.16;
        ctx.strokeStyle = o.strokeColor;
        ctx.strokeText(l, x, y);
      }
      ctx.fillStyle = o.color;
      ctx.fillText(l, x, y);
    });
  }

  function drawBackground(ctx, s, CW, CH, img) {
    const t = s.template;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = t.fundoCor || "#000000";
    ctx.fillRect(0, 0, CW, CH);
    if (t.fundoTipo === "imagem" && img) {
      const k = Math.max(CW / img.width, CH / img.height);
      const w = img.width * k,
        h = img.height * k;
      ctx.drawImage(img, (CW - w) / 2, (CH - h) / 2, w, h);
    }
  }

  function drawLogo(ctx, s, CW, CH, logo) {
    if (!logo || !logo.width) return;
    const t = s.template,
      U = CW / 1080;
    const lw = CW * t.logoTamanho,
      lh = (lw * logo.height) / logo.width,
      m = 48 * U;
    const p = t.logoPos || "sup-dir";
    let lx = m;
    if (p.endsWith("dir")) lx = CW - lw - m;
    if (p.endsWith("centro")) lx = (CW - lw) / 2;
    const ly = p.startsWith("inf") ? CH - lh - m : m;
    ctx.globalAlpha = Math.max(0, Math.min(1, t.logoOpacidade));
    ctx.drawImage(logo, lx, ly, lw, lh);
    ctx.globalAlpha = 1;
  }

  function coverFit(ctx, img, W, H) {
    const iw = img.videoWidth || img.naturalWidth || img.width;
    const ih = img.videoHeight || img.naturalHeight || img.height;
    const k = Math.max(W / iw, H / ih);
    ctx.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  }

  function demoFill(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#082338");
    g.addColorStop(0.55, "#07436b");
    g.addColorStop(1, "#008dc6");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  // Capa: o mesmo quadro final do vídeo (fundo, vídeo recortado, moldura, logo) congelado
  // num momento escolhido — ou uma imagem própria — com um título grande por cima.
  // o = { CW, CH, meta, frame (vídeo/imagem do quadro ou null), bgImg, custom, logo, title }
  function drawCover(ctx, s, o) {
    const { CW, CH } = o;
    const c = s.capa,
      e = s.efeitos,
      t = s.template,
      U = CW / 1080;
    const filt = cssFilter(e);
    ctx.clearRect(0, 0, CW, CH);

    if (c.fonte === "imagem") {
      if (o.custom) coverFit(ctx, o.custom, CW, CH);
      else demoFill(ctx, 0, 0, CW, CH);
    } else {
      drawBackground(ctx, s, CW, CH, o.bgImg);
      if (t.fundoTipo === "blur") {
        ctx.save();
        ctx.filter = `${filt} blur(${Math.round(24 * U)}px) brightness(0.8)`;
        if (o.frame) coverFit(ctx, o.frame, CW, CH);
        else demoFill(ctx, 0, 0, CW, CH);
        ctx.restore();
      }
      const L = window.Shared.layout(o.meta, s);
      if (L.F > 0) {
        ctx.fillStyle = t.molduraCor;
        ctx.fillRect(L.x, L.y, L.dw + 2 * L.F, L.dh + 2 * L.F);
      }
      const bx = L.x + L.F,
        by = L.y + L.F;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, L.dw, L.dh);
      ctx.clip();
      if (e.espelhar) {
        ctx.translate(bx + L.dw / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(bx + L.dw / 2), 0);
      }
      const dx = bx - (L.sw - L.dw) / 2,
        dy = by - (L.sh - L.dh) / 2;
      if (o.frame) {
        const fw = o.frame.videoWidth || o.frame.naturalWidth || o.frame.width;
        const r = fw / o.meta.width; // quadro pode vir em outra escala
        ctx.filter = filt;
        ctx.drawImage(o.frame, L.left * r, L.top * r, L.cw * r, L.ch * r, dx, dy, L.sw, L.sh);
        ctx.filter = "none";
        const fx = window.Shared.filtroSpec(e);
        if (fx && fx.vin) drawVinheta(ctx, fx.vin, dx, dy, L.sw, L.sh);
      } else {
        demoFill(ctx, dx, dy, L.sw, L.sh);
      }
      ctx.restore();
    }

    if (c.escurecer > 0 && c.texto !== "nenhum") {
      ctx.fillStyle = `rgba(0,0,0,${c.escurecer})`;
      ctx.fillRect(0, 0, CW, CH);
    }
    drawLogo(ctx, s, CW, CH, o.logo);

    let text = String(o.title || "").trim();
    let ghost = false;
    if (!text && o.placeholder) {
      text = s.capa.texto === "legenda" ? "Legenda do vídeo" : "Título da capa";
      ghost = true; // só no preview, bem apagado
    }
    if (text) {
      ctx.save();
      if (ghost) ctx.globalAlpha = 0.3;
      if (c.maiusculas) text = text.toUpperCase();
      const size = c.tamanho * U;
      drawTextBlock(ctx, text, {
        x: CW / 2,
        y: (CH * c.v) / 100,
        maxW: CW * 0.88,
        canvasW: CW,
        size,
        font: fontStr(s.texto.fonte, 900, size),
        color: c.cor,
        stroke: c.contorno,
        strokeColor: c.contornoCor,
        box: c.destaque,
        boxColor: c.destaqueCor,
        boxAlpha: 1,
        lineH: 1.08,
      });
      ctx.restore();
    }
  }

  function drawOverlay(ctx, s, legenda, CW, CH, logo, opts = {}) {
    const x = s.texto,
      U = CW / 1080;
    if (!opts.keep) ctx.clearRect(0, 0, CW, CH);
    drawLogo(ctx, s, CW, CH, logo);

    const oculto = window.Shared.ocultarTexto(s);
    let text = oculto ? "" : String(legenda || "").trim();
    let ghost = false;
    if (!oculto && !text && opts.placeholder) {
      text = "Sua legenda aparece aqui";
      ghost = true;
    }
    if (text) {
      if (x.maiusculas) text = text.toUpperCase();
      const size = x.tamanho * U;
      ctx.save();
      if (ghost) ctx.globalAlpha = 0.35;
      drawTextBlock(ctx, text, {
        x: (CW * x.h) / 100,
        y: (CH * x.v) / 100,
        maxW: (CW * x.largura) / 100,
        canvasW: CW,
        size,
        font: fontStr(x.fonte, x.peso, size),
        color: x.cor,
        stroke: x.contorno,
        strokeColor: x.contornoCor,
        box: x.fundo,
        boxColor: x.fundoCor,
        lineH: x.espacamento,
      });
      ctx.restore();
    }

    if (x.ctaAtivo && String(x.ctaTexto || "").trim()) {
      const size = x.ctaTamanho * U;
      ctx.font = fontStr(x.fonte, 800, size);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = x.ctaTexto.trim();
      const w = Math.min(CW - 60 * U, ctx.measureText(label).width + size * 1.8);
      const h = size * 2;
      const cy = (CH * x.ctaV) / 100;
      roundRect(ctx, (CW - w) / 2, cy - h / 2, w, h, h / 2);
      ctx.fillStyle = x.ctaFundo;
      ctx.fill();
      ctx.fillStyle = x.ctaCor;
      ctx.fillText(label, CW / 2, cy + size * 0.04);
    }
  }

  // Filtros de cor viram filtros SVG (mesma matriz e mesma curva usadas no FFmpeg).
  const SVGNS = "http://www.w3.org/2000/svg";
  function svgDefs() {
    let svg = document.getElementById("fxDefs");
    if (!svg) {
      svg = document.createElementNS(SVGNS, "svg");
      svg.id = "fxDefs";
      svg.setAttribute("width", "0");
      svg.setAttribute("height", "0");
      svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      svg.setAttribute("aria-hidden", "true");
      document.body.appendChild(svg);
    }
    return svg;
  }
  // Garante que existe um <filter> para este ajuste e devolve o id dele.
  function filtroId(fx) {
    const m = fx.m;
    const id =
      "fx_" +
      [...m, fx.slope, fx.icpt]
        .map((n) => Math.round(n * 1000))
        .join("_")
        .replace(/-/g, "m");
    if (document.getElementById(id)) return id;
    const f = document.createElementNS(SVGNS, "filter");
    f.id = id;
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.setAttribute("x", "0");
    f.setAttribute("y", "0");
    f.setAttribute("width", "1");
    f.setAttribute("height", "1");
    const cm = document.createElementNS(SVGNS, "feColorMatrix");
    cm.setAttribute("type", "matrix");
    cm.setAttribute(
      "values",
      `${m[0]} ${m[1]} ${m[2]} 0 0  ${m[3]} ${m[4]} ${m[5]} 0 0  ${m[6]} ${m[7]} ${m[8]} 0 0  0 0 0 1 0`,
    );
    f.appendChild(cm);
    if (fx.slope !== 1 || fx.icpt !== 0) {
      const ct = document.createElementNS(SVGNS, "feComponentTransfer");
      for (const ch of ["R", "G", "B"]) {
        const fn = document.createElementNS(SVGNS, "feFunc" + ch);
        fn.setAttribute("type", "linear");
        fn.setAttribute("slope", String(fx.slope));
        fn.setAttribute("intercept", String(fx.icpt));
        ct.appendChild(fn);
      }
      f.appendChild(ct);
    }
    svgDefs().appendChild(f);
    return id;
  }
  function cssFilter(e) {
    const q = window.Shared.eqParams(e);
    let out = `contrast(${q.contrast}) saturate(${q.saturation}) brightness(${1 + q.brightness})`;
    const fx = window.Shared.filtroSpec(e);
    if (fx) out += ` url(#${filtroId(fx)})`;
    return out;
  }
  // Degradê que imita o filtro "vignette" do FFmpeg (escurece cos⁴ do ângulo até os cantos).
  function vinheta(v) {
    if (!v) return "";
    const ang = window.Shared.vinAngle(v);
    const stops = [];
    for (let i = 0; i <= 10; i++) {
      const d = i / 10;
      const c = Math.cos(ang * d);
      stops.push(`rgba(0,0,0,${(1 - c * c * c * c).toFixed(3)}) ${i * 10}%`);
    }
    return `radial-gradient(circle farthest-corner at center, ${stops.join(", ")})`;
  }
  function drawVinheta(ctx, v, x, y, w, h) {
    if (!v) return;
    const ang = window.Shared.vinAngle(v);
    const cx = x + w / 2,
      cy = y + h / 2,
      R = Math.hypot(w / 2, h / 2);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    for (let i = 0; i <= 10; i++) {
      const c = Math.cos((ang * i) / 10);
      g.addColorStop(i / 10, `rgba(0,0,0,${(1 - c * c * c * c).toFixed(3)})`);
    }
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Miniatura da mesa: o quadro final completo (fundo, vídeo recortado, filtro, moldura,
  // logo, legenda e CTA) desenhado em escala reduzida. Com o.capa, mostra a capa.
  // o = { meta, frame, bgImg, custom, logo, legenda, capa: { title } | null }
  function drawMini(ctx, s, o) {
    const { CW, CH } = window.Shared.canvasSize(s);
    const W = ctx.canvas.width,
      H = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(W / CW, 0, 0, H / CH, 0, 0);
    if (o.capa) {
      drawCover(ctx, s, {
        CW,
        CH,
        meta: o.meta,
        frame: o.frame,
        bgImg: o.bgImg,
        custom: o.custom,
        logo: o.logo,
        title: o.capa.title,
      });
    } else {
      const base = Object.assign({}, s, {
        capa: Object.assign({}, s.capa, { fonte: "frame", escurecer: 0, texto: "nenhum" }),
      });
      drawCover(ctx, base, {
        CW,
        CH,
        meta: o.meta,
        frame: o.frame,
        bgImg: o.bgImg,
        logo: null,
        title: "",
      });
      drawOverlay(ctx, s, o.legenda, CW, CH, o.logo, { keep: true });
      if (o.cap && window.Legendas) window.Legendas.desenhar(ctx, s, o.cap, o.capT || 0, CW, CH);
    }
    ctx.restore();
  }

  // Fontes que precisam estar carregadas antes de gerar os PNGs.
  function fontsFor(s) {
    const x = s.texto;
    return [fontStr(x.fonte, x.peso, 64), fontStr(x.fonte, 800, 42), fontStr(x.fonte, 900, 100)];
  }

  window.Render = {
    drawBackground,
    drawOverlay,
    drawCover,
    drawMini,
    cssFilter,
    fontsFor,
    filtroId,
    vinheta,
  };
})();
