import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoComEdicao } from "@/components/editor/VideoComEdicao";
import { EDICAO_PADRAO, type Edicao, type VideoItem } from "@/lib/editor/tipos";
import { FILTROS } from "@/lib/editor/filtros";

const video: VideoItem = {
  id: "a",
  file: new File([], "a.mp4"),
  url: "blob:a",
  nome: "a.mp4",
  duracao: 10,
  largura: 640,
  altura: 360,
  tamanhoMB: 1,
  status: "pronto",
  progresso: 0,
};
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Prévia ao vivo", () => {
  it("atualiza formato, filtro e velocidade mantendo o mesmo elemento de vídeo", () => {
    const { container, rerender } = render(
      createElement(VideoComEdicao, { video, edicao: EDICAO_PADRAO }),
    );
    const player = container.querySelector("video")!;
    const filtro = FILTROS.find((item) => item.nome === "Anime Sistema (azul)")!;
    const edicao: Edicao = {
      ...EDICAO_PADRAO,
      formato: "9:16",
      velocidade: 2,
      zoom: 1.5,
      posicaoX: 0.5,
      espelhar: true,
      filtro,
    };
    rerender(createElement(VideoComEdicao, { video, edicao }));
    expect(container.querySelector("video")).toBe(player);
    expect(player.playbackRate).toBe(2);
    expect(player.style.filter).toContain("saturate(1.6)");
    expect(player.style.transform).toContain("scale(-1.5, 1.5)");
    expect(player.parentElement?.style.aspectRatio).toBe(String(9 / 16));
  });
  it("repete o trecho e sincroniza o segundo vídeo sem substituir o principal", () => {
    const { container, rerender } = render(
      createElement(VideoComEdicao, { video, edicao: EDICAO_PADRAO }),
    );
    const player = container.querySelector("video")!;
    Object.defineProperty(player, "readyState", { value: 1 });
    rerender(
      createElement(VideoComEdicao, {
        video,
        edicao: {
          ...EDICAO_PADRAO,
          corte: { inicio: 2, fim: 4 },
          enquadrar: "fundo-desfocado",
          velocidade: 1.5,
        },
      }),
    );
    const videos = container.querySelectorAll("video");
    const background = videos[0]!;
    expect(videos[1]).toBe(player);
    Object.defineProperty(background, "readyState", { value: 1 });
    expect(player.currentTime).toBe(2);
    player.currentTime = 4.2;
    fireEvent.timeUpdate(player);
    expect(player.currentTime).toBe(2);
    expect(background.currentTime).toBe(2);
    expect(background.playbackRate).toBe(1.5);
    expect(background.style.filter).toContain("blur(24px)");
    // Navegadores podem representar a busca por 2 s como 1.999999 s.
    // Não recomeçar a busca por essa diferença evita uma sequência de seeking.
    player.currentTime = 1.999999;
    fireEvent.seeking(player);
    expect(player.currentTime).toBe(1.999999);
    fireEvent.pause(player);
    expect(background.pause).toHaveBeenCalled();
  });
});
