import { createElement } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorProvider, useEditor } from "@/lib/editor/store";
import { lerInfo } from "@/lib/editor/ler-video";

vi.mock("@/lib/editor/ler-video", () => ({ lerInfo: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const file = (nome: string) => new File(["video"], nome, { type: "video/mp4" });
const montar = () =>
  renderHook(() => useEditor(), {
    wrapper: ({ children }) => createElement(EditorProvider, null, children),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lerInfo).mockResolvedValue({ duracao: 10, largura: 640, altura: 360 });
  let id = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `id-${++id}` });
  URL.createObjectURL = vi.fn(() => `blob:${id}`);
  URL.revokeObjectURL = vi.fn();
});
describe("Mesa de vídeos", () => {
  it("adiciona vídeos e escolhe o primeiro como modelo", async () => {
    const { result } = montar();
    await act(() => result.current.adicionar([file("a.mp4"), file("b.mp4")]));
    expect(result.current.videos).toHaveLength(2);
    expect(result.current.modeloId).toBe(result.current.videos[0]?.id);
    expect(result.current.videos[0]).toMatchObject({
      nome: "a.mp4",
      duracao: 10,
      status: "pronto",
      progresso: 0,
    });
  });
  it("escolhe um modelo e usa o próximo disponível ao removê-lo", async () => {
    const { result } = montar();
    await act(() => result.current.adicionar([file("a.mp4"), file("b.mp4"), file("c.mp4")]));
    const primeiro = result.current.videos[0]!;
    const segundo = result.current.videos[1]!;
    act(() => result.current.escolherModelo(segundo.id));
    expect(result.current.modeloId).toBe(segundo.id);
    act(() => result.current.remover(segundo.id));
    expect(result.current.modeloId).toBe(primeiro.id);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(segundo.url);
    act(() => result.current.escolherModelo("inexistente"));
    expect(result.current.modeloId).toBe(primeiro.id);
    act(() => result.current.remover(primeiro.id));
    expect(result.current.modeloId).toBe(result.current.videos[0]?.id);
  });
  it("mantém o modelo ao remover outro vídeo e libera todas as URLs", async () => {
    const { result, unmount } = montar();
    await act(() => result.current.adicionar([file("a.mp4"), file("b.mp4")]));
    const primeiro = result.current.modeloId;
    act(() => result.current.remover(result.current.videos[1]!.id));
    expect(result.current.modeloId).toBe(primeiro);
    act(() => result.current.limparTudo());
    expect(result.current.videos).toEqual([]);
    expect(result.current.modeloId).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    await act(() => result.current.adicionar([file("c.mp4")]));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });
  it("reserva vagas mesmo com envios simultâneos", async () => {
    const { result } = montar();
    await act(async () => {
      await Promise.all([
        result.current.adicionar(Array.from({ length: 30 }, () => file("a.mp4"))),
        result.current.adicionar(Array.from({ length: 30 }, () => file("b.mp4"))),
      ]);
    });
    expect(result.current.videos).toHaveLength(50);
  });
  it("não repõe um vídeo pendente depois de limpar a mesa", async () => {
    let resolver!: (info: { duracao: number; largura: number; altura: number }) => void;
    vi.mocked(lerInfo).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    const { result } = montar();
    let envio!: Promise<void>;
    act(() => {
      envio = result.current.adicionar([file("a.mp4")]);
    });
    act(() => result.current.limparTudo());
    await act(async () => {
      resolver({ duracao: 10, largura: 640, altura: 360 });
      await envio;
    });
    expect(result.current.videos).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("desfaz e refaz um gesto de slider como uma única edição", () => {
    const { result } = montar();
    act(() => result.current.mudarEdicao({ zoom: 1.2 }, true));
    act(() => result.current.mudarEdicao({ zoom: 1.5 }, true));
    act(() => result.current.confirmarEdicao());
    expect(result.current.passado).toHaveLength(1);
    act(() => result.current.desfazer());
    expect(result.current.edicao.zoom).toBe(1);
    act(() => result.current.refazer());
    expect(result.current.edicao.zoom).toBe(1.5);
    act(() => result.current.desfazer());
    act(() => result.current.mudarEdicao({ formato: "9:16" }));
    expect(result.current.futuro).toEqual([]);
  });
  it("responde aos atalhos e preserva edição de texto", () => {
    const { result } = montar();
    act(() => result.current.mudarEdicao({ velocidade: 2 }));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true })));
    expect(result.current.edicao.velocidade).toBe(1);
    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true }),
      ),
    );
    expect(result.current.edicao.velocidade).toBe(2);
    const input = document.createElement("input");
    document.body.append(input);
    act(() =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })),
    );
    expect(result.current.edicao.velocidade).toBe(2);
    input.remove();
  });
  it("altera só o vídeo escolhido e permite voltar à edição geral", async () => {
    const { result } = montar();
    await act(() => result.current.adicionar([file("a.mp4"), file("b.mp4")]));
    const id = result.current.videos[0]!.id;
    const edicao = result.current.edicao;
    act(() => result.current.ajustarVideo(id, { posicaoX: 0.4, corte: { inicio: 1, fim: 3 } }));
    expect(result.current.videos[0]?.ajuste?.posicaoX).toBe(0.4);
    expect(result.current.videos[1]?.ajuste).toBeUndefined();
    expect(result.current.edicao).toBe(edicao);
    act(() => result.current.ajustarVideo(id, undefined));
    expect(result.current.videos[0]?.ajuste).toBeUndefined();
  });
});
