import { describe, expect, it } from "vitest";
import { FILTROS, edicaoDoVideo, limitarCorte, paraCss, paraFfmpeg } from "@/lib/editor/filtros";
import { EDICAO_PADRAO, type VideoItem } from "@/lib/editor/tipos";

describe("Filtros do editor", () => {
  it.each(FILTROS)("gera filtros válidos para $nome", (filtro) => {
    const css = paraCss(filtro);
    const ffmpeg = paraFfmpeg(filtro);
    expect(css).toMatch(
      /^brightness\([\d.]+\) contrast\([\d.]+\) saturate\([\d.]+\) sepia\([\d.]+\) hue-rotate\(-?[\d.]+deg\)$/,
    );
    expect(ffmpeg).toMatch(
      /^eq=brightness=-?[\d.]+:contrast=[\d.]+:saturation=[\d.]+,colorbalance=/,
    );
    expect(ffmpeg).toContain(",hue=h=");
    expect(`${css}${ffmpeg}`).not.toMatch(/NaN|undefined|Infinity/);
    expect(ffmpeg).not.toMatch(/,,|,$/);
    for (const trecho of ffmpeg.split(",")) {
      expect(trecho).toMatch(/^(eq|colorbalance|hue|colorchannelmixer|vignette|unsharp|noise)=/);
    }
  });
  it("inclui nitidez, vinheta e granulado no FFmpeg", () => {
    const filtro = { ...EDICAO_PADRAO.filtro, vinheta: 0.5, nitidez: 0.3, granulado: 0.2 };
    expect(paraFfmpeg(filtro)).toContain("vignette=angle=");
    expect(paraFfmpeg(filtro)).toContain("unsharp=5:5:0.3:5:5:0");
    expect(paraFfmpeg(filtro)).toContain("noise=alls=4:allf=t+u");
  });
  it("define os 12 filtros e tons diferentes para os quatro anime", () => {
    expect(FILTROS).toHaveLength(12);
    const anime = FILTROS.filter((filtro) => filtro.grupo === "Anime");
    expect(anime).toHaveLength(4);
    expect(new Set(anime.map(paraFfmpeg)).size).toBe(4);
    expect(
      anime.every((filtro) => filtro.contraste > 1 && filtro.saturacao > 1 && filtro.vinheta > 0),
    ).toBe(true);
  });
});

describe("Corte limitado por vídeo", () => {
  it("nunca excede a duração, inclusive com início fora do vídeo ou fim invertido", () => {
    for (const duracao of [0, 0.02, 1, 5, 30, 100]) {
      for (const inicio of [-1, 0, 3, 10, 200, NaN]) {
        for (const fim of [null, -3, 0, 2, 10, 300, Infinity]) {
          const corte = limitarCorte({ inicio, fim }, duracao);
          expect(corte.inicio).toBeGreaterThanOrEqual(0);
          expect(corte.fim).toBeGreaterThanOrEqual(corte.inicio);
          expect(corte.fim).toBeLessThanOrEqual(duracao);
        }
      }
    }
  });
  it("fim null vai até o final e o ajuste individual substitui somente corte e posição", () => {
    const video: VideoItem = {
      id: "a",
      nome: "a",
      file: new File([], "a.mp4"),
      url: "blob:a",
      duracao: 5,
      largura: 640,
      altura: 360,
      tamanhoMB: 1,
      status: "pronto",
      progresso: 0,
      ajuste: { corte: { inicio: 2, fim: 30 }, posicaoX: 0.5 },
    };
    const edicao = { ...EDICAO_PADRAO, corte: { inicio: 1, fim: null }, posicaoY: -0.5 };
    expect(limitarCorte(edicao.corte, 5)).toEqual({ inicio: 1, fim: 5 });
    expect(edicaoDoVideo(video, edicao)).toMatchObject({
      corte: { inicio: 2, fim: 5 },
      posicaoX: 0.5,
      posicaoY: -0.5,
    });
    expect(edicao.corte).toEqual({ inicio: 1, fim: null });
  });
});
