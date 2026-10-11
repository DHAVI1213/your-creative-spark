import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AreaDeEnvio } from "@/components/editor/AreaDeEnvio";
import { MesaDeVideos } from "@/components/editor/MesaDeVideos";
import { useEditor, ESTADO_INICIAL } from "@/lib/editor/store";
import { EDICAO_PADRAO } from "@/lib/editor/tipos";
import { toast } from "sonner";

vi.mock("@/lib/editor/store", async (original) => ({
  ...(await original<typeof import("@/lib/editor/store")>()),
  useEditor: vi.fn(),
}));
vi.mock("@/lib/device", () => ({ useDevice: () => ({ maxVideoMB: 1 }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Componentes da mesa", () => {
  it("valida arquivos no seletor e ao arrastar", () => {
    const adicionar = vi.fn();
    vi.mocked(useEditor).mockReturnValue({
      ...ESTADO_INICIAL,
      selecionarCamada: vi.fn(),
      atualizarCamada: vi.fn(),
      adicionarCamada: vi.fn(),
      confirmarEdicao: vi.fn(),
      desfazer: vi.fn(),
      refazer: vi.fn(),
      ajustarVideo: vi.fn(),
      tempoModelo: { current: null },
      videos: [],
      modeloId: null,
      edicao: EDICAO_PADRAO,
      adicionar,
      remover: vi.fn(),
      limparTudo: vi.fn(),
      escolherModelo: vi.fn(),
      mudarEdicao: vi.fn(),
      carregando: false,
    });
    render(createElement(AreaDeEnvio));
    const valido = new File(["video"], "curto.mp4", { type: "video/mp4" });
    const texto = new File(["texto"], "texto.txt", { type: "text/plain" });
    const grande = new File([new Uint8Array(1024 * 1024 + 1)], "grande.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Escolher vídeos"), {
      target: { files: [texto, grande, valido] },
    });
    expect(adicionar).toHaveBeenCalledWith([valido]);
    expect(toast.error).toHaveBeenCalledWith("texto.txt: escolha um arquivo de vídeo.");
    expect(toast.error).toHaveBeenCalledWith(
      "grande.mp4: o limite neste aparelho é 1 MB por vídeo.",
    );
    fireEvent.drop(screen.getByText("Arraste seus vídeos para cá ou escolha os arquivos."), {
      dataTransfer: { files: [valido] },
    });
    expect(adicionar).toHaveBeenCalledTimes(2);
  });
  it("toca somente vídeos visíveis, seleciona e remove sem trocar o modelo", () => {
    let observar!: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observar = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const escolherModelo = vi.fn();
    const remover = vi.fn();
    vi.mocked(useEditor).mockReturnValue({
      ...ESTADO_INICIAL,
      selecionarCamada: vi.fn(),
      atualizarCamada: vi.fn(),
      adicionarCamada: vi.fn(),
      confirmarEdicao: vi.fn(),
      desfazer: vi.fn(),
      refazer: vi.fn(),
      ajustarVideo: vi.fn(),
      tempoModelo: { current: null },
      videos: [
        {
          id: "a",
          nome: "curto.mp4",
          file: new File([], "curto.mp4"),
          url: "blob:a",
          duracao: 65,
          largura: 640,
          altura: 360,
          tamanhoMB: 1,
          status: "pronto",
          progresso: 0,
        },
      ],
      modeloId: "a",
      edicao: EDICAO_PADRAO,
      adicionar: vi.fn(),
      remover,
      limparTudo: vi.fn(),
      escolherModelo,
      mudarEdicao: vi.fn(),
      carregando: false,
    });
    const { unmount } = render(createElement(MesaDeVideos));
    expect(play).not.toHaveBeenCalled();
    act(() =>
      observar([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
    );
    expect(play).toHaveBeenCalledTimes(1);
    act(() =>
      observar(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(pause).toHaveBeenCalled();
    expect(screen.getByText("01:05 · 1.0 MB")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Usar curto.mp4 como modelo"));
    expect(escolherModelo).toHaveBeenCalledWith("a");
    fireEvent.click(screen.getByLabelText("Remover curto.mp4"));
    expect(remover).toHaveBeenCalledWith("a");
    expect(escolherModelo).toHaveBeenCalledTimes(1);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
