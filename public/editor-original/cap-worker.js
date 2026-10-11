// Ajudante da legenda animada: desenha parte dos quadros e comprime em PNG, em paralelo com os outros.
/* global Legendas */
"use strict";
importScripts("shared.js", "legendas.js");

// as mesmas fontes que a página carrega (index.html), para o quadro sair igual ao preview
const FONTES = [
  ["Poppins", "poppins", [400, 700, 800, 900]],
  ["Montserrat", "montserrat", [700, 800, 900]],
  ["Anton", "anton", [400]],
  ["Bebas Neue", "bebas-neue", [400]],
];
let fontes = null;
function carregarFontes() {
  if (!fontes) {
    const lista = [];
    for (const [fam, slug, pesos] of FONTES)
      for (const p of pesos) {
        const f = new FontFace(fam, `url(/fontes/${slug}-latin-${p}-normal.woff2)`, {
          weight: String(p),
        });
        self.fonts.add(f);
        lista.push(f.load().catch(() => null));
      }
    fontes = Promise.all(lista);
  }
  return fontes;
}

let canvas = null;
self.onmessage = async (e) => {
  const { id, s, cap, itens, CW, CH, y0, h } = e.data;
  try {
    await carregarFontes();
    if (!canvas || canvas.width !== CW || canvas.height !== h) canvas = new OffscreenCanvas(CW, h);
    const ctx = canvas.getContext("2d");
    const pngs = [];
    for (const it of itens) {
      ctx.clearRect(0, 0, CW, h);
      ctx.save();
      ctx.translate(0, -y0);
      Legendas.desenhar(ctx, s, cap, it.t + 0.0005, CW, CH);
      ctx.restore();
      const blob = await canvas.convertToBlob({ type: "image/png" });
      pngs.push(await blob.arrayBuffer());
    }
    self.postMessage({ id, pngs }, pngs);
  } catch (err) {
    self.postMessage({ id, erro: String((err && err.message) || err) });
  }
};
