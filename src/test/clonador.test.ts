import { describe, expect, it } from "vitest";

import { detectarRecursos, limparAdaptador, prepararPrevia } from "@/lib/clonador-analise";
import { caminhoLocal, relativo, urlsDoCss, urlsDoJs } from "@/lib/clonador-zip";

describe("estrutura de pastas do zip", () => {
  it("mantém o caminho original do mesmo site", () => {
    expect(caminhoLocal("https://loja.com/_next/static/chunks/app.js", "loja.com")).toBe(
      "_next/static/chunks/app.js",
    );
  });
  it("coloca arquivos de CDN em _ext/<domínio>", () => {
    expect(caminhoLocal("https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js", "loja.com")).toBe(
      "_ext/cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js",
    );
  });
  it("diferencia arquivos com parâmetros e põe extensão pelo tipo", () => {
    const a = caminhoLocal(
      "https://loja.com/_next/image?url=a.png&w=640",
      "loja.com",
      "image/webp",
    );
    const b = caminhoLocal(
      "https://loja.com/_next/image?url=b.png&w=640",
      "loja.com",
      "image/webp",
    );
    expect(a).not.toBe(b);
    expect(a.endsWith(".webp")).toBe(true);
  });
  it("calcula caminhos relativos entre arquivos", () => {
    expect(relativo("index.html", "assets/a.png")).toBe("assets/a.png");
    expect(relativo("css/site.css", "fonts/x.woff2")).toBe("../fonts/x.woff2");
    expect(relativo("_next/static/css/a.css", "_next/static/media/f.woff2")).toBe(
      "../media/f.woff2",
    );
  });
});

describe("arquivos citados dentro de JS e CSS", () => {
  it("acha modelos 3D, vídeos, Lottie e chunks", () => {
    const js = `load("/models/carro.glb");fetch('./anim/hero.json');const v="https://cdn.x.com/v/fundo.mp4";
      const c="static/chunks/123.js";const nada="\${base}/x.png";`;
    const achados = urlsDoJs(
      js,
      "https://loja.com/_next/static/chunks/main.js",
      "https://loja.com",
      true,
    );
    expect(achados).toContain("https://loja.com/models/carro.glb");
    expect(achados).toContain("https://loja.com/_next/static/chunks/anim/hero.json");
    expect(achados).toContain("https://cdn.x.com/v/fundo.mp4");
    expect(achados).toContain("https://loja.com/_next/static/chunks/123.js");
    expect(achados.some((u) => u.includes("${"))).toBe(false);
  });
  it("acha fontes, imagens e @import no CSS", () => {
    const css = `@import url("tema.css");@font-face{src:url(../fonts/a.woff2)}.h{background:url('/img/bg.jpg')}`;
    const achados = urlsDoCss(css, "https://loja.com/css/site.css");
    expect(achados).toEqual(
      expect.arrayContaining([
        "https://loja.com/css/tema.css",
        "https://loja.com/fonts/a.woff2",
        "https://loja.com/img/bg.jpg",
      ]),
    );
  });
});

describe("leitura de animações e prévia", () => {
  it("detecta GSAP, ScrollTrigger, Three.js e AOS", () => {
    const html = `<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
      <script src="/js/ScrollTrigger.min.js"></script><script src="/js/three.module.js"></script>
      <div data-aos="fade-up"></div><canvas></canvas>`;
    const nomes = detectarRecursos(html).map((r) => r.nome);
    expect(nomes).toEqual(
      expect.arrayContaining(["GSAP", "ScrollTrigger", "Three.js", "Canvas / WebGL"]),
    );
    expect(nomes.some((n) => n.startsWith("AOS"))).toBe(true);
  });
  it("coloca o adaptador na prévia e tira na exportação", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const previa = prepararPrevia(html);
    expect(previa).toContain("data-fabrica-adaptador");
    expect(prepararPrevia(previa).match(/data-fabrica-adaptador/g)?.length).toBe(1);
    expect(limparAdaptador(previa)).toBe(html);
  });
});
