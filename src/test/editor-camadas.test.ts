import { createElement } from "react";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alinharCentro,
  camadaVisivel,
  criarTexto,
  limitarPosicao,
  substituirVariaveis,
} from "@/lib/editor/camadas";
import { EditorProvider, useEditor } from "@/lib/editor/store";
import { EDICAO_PADRAO, type VideoItem } from "@/lib/editor/tipos";
import { CamadasSobrepostas } from "@/components/editor/CamadasSobrepostas";

afterEach(cleanup);
describe("Camadas do editor", () => {
  it("troca nome sem extensão e número sem reinterpretar o nome do arquivo", () => {
    expect(substituirVariaveis("{nome} · Parte {numero} · {numero}", "meu.video.mp4", 3)).toBe(
      "meu.video · Parte 3 · 3",
    );
    expect(substituirVariaveis("{nome}", "{numero}.mp4", 2)).toBe("{numero}");
    expect(substituirVariaveis("{nome} {outro}", "video", 1)).toBe("video {outro}");
  });
  it("mantém a caixa inteira na moldura, inclusive rotacionada e em outros formatos", () => {
    for (const proporcao of [9 / 16, 1, 4 / 5, 16 / 9]) {
      for (const rotacao of [0, 45, 90, 180, 270]) {
        for (const [x, y] of [
          [-1, 2],
          [0, 0],
          [0.5, 0.5],
          [1, 1],
        ]) {
          const resultado = limitarPosicao(x!, y!, 0.8, 0.6, rotacao, proporcao);
          const rad = (rotacao * Math.PI) / 180;
          const w =
            Math.abs(Math.cos(rad)) * resultado.largura +
            (Math.abs(Math.sin(rad)) * resultado.altura) / proporcao;
          const h =
            Math.abs(Math.sin(rad)) * resultado.largura * proporcao +
            Math.abs(Math.cos(rad)) * resultado.altura;
          expect(resultado.x - w / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(resultado.x + w / 2).toBeLessThanOrEqual(1 + 1e-9);
          expect(resultado.y - h / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(resultado.y + h / 2).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
    expect(limitarPosicao(0.4, 0.3, 0.2, 0.1)).toMatchObject({ x: 0.4, y: 0.3 });
  });
  it("gruda no centro e respeita início, fim e camada escondida", () => {
    expect(alinharCentro(0.51)).toBe(0.5);
    expect(alinharCentro(0.6)).toBe(0.6);
    const camada = { ...criarTexto("Parte {numero}"), inicio: 2, fim: 4 };
    expect(camadaVisivel(camada, 1)).toBe(false);
    expect(camadaVisivel(camada, 2)).toBe(true);
    expect(camadaVisivel(camada, 4)).toBe(false);
    expect(camadaVisivel({ ...camada, oculta: true }, 3)).toBe(false);
  });
  it("adiciona, agrupa o arraste no histórico e desfaz/refaz camadas", () => {
    const { result } = renderHook(() => useEditor(), {
      wrapper: ({ children }) => createElement(EditorProvider, null, children),
    });
    const camada = criarTexto();
    act(() => result.current.adicionarCamada(camada));
    act(() => result.current.atualizarCamada({ ...camada, x: 0.4 }, true));
    act(() => result.current.atualizarCamada({ ...camada, x: 0.3 }, true));
    act(() => result.current.confirmarEdicao());
    expect(result.current.passado).toHaveLength(2);
    act(() => result.current.desfazer());
    expect(result.current.edicao.camadas[0]?.x).toBe(0.5);
    act(() => result.current.refazer());
    expect(result.current.edicao.camadas[0]?.x).toBe(0.3);
  });
  it("mostra variáveis e área segura só no modelo, e muda visibilidade com o tempo", () => {
    const camada = criarTexto("Parte {numero}");
    const video: VideoItem = {
      id: "a",
      file: new File([], "a.mp4"),
      nome: "a.mp4",
      url: "blob:a",
      duracao: 10,
      largura: 320,
      altura: 180,
      tamanhoMB: 1,
      status: "pronto",
      progresso: 0,
    };
    const player = document.createElement("video");
    const props = {
      video,
      edicao: { ...EDICAO_PADRAO, formato: "9:16" as const, camadas: [camada] },
      numero: 3,
      player: { current: player },
      proporcao: 9 / 16,
    };
    const { getByText, queryByLabelText, rerender } = render(
      createElement(CamadasSobrepostas, props),
    );
    expect(getByText("Parte 3")).toBeTruthy();
    expect(queryByLabelText("Área segura aproximada para Reels e TikTok")).toBeNull();
    const editor = {
      selecionadaId: camada.id,
      selecionar: vi.fn(),
      atualizar: vi.fn(),
      confirmar: vi.fn(),
    };
    rerender(createElement(CamadasSobrepostas, { ...props, editor }));
    expect(queryByLabelText("Área segura aproximada para Reels e TikTok")).toBeTruthy();
    rerender(
      createElement(CamadasSobrepostas, {
        ...props,
        edicao: { ...props.edicao, camadas: [{ ...camada, inicio: 2, fim: 4 }] },
      }),
    );
    expect(queryByLabelText("Camada de texto: Parte 3")).toBeNull();
    player.currentTime = 3;
    fireEvent.timeUpdate(player);
    expect(getByText("Parte 3")).toBeTruthy();
    player.currentTime = 5;
    fireEvent.timeUpdate(player);
    expect(queryByLabelText("Camada de texto: Parte 3")).toBeNull();
  });
});
