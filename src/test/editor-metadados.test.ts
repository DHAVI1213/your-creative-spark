import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lerInfo } from "@/lib/editor/ler-video";

describe("Leitura de metadados", () => {
  let video: HTMLVideoElement;
  beforeEach(() => {
    vi.useFakeTimers();
    video = document.createElement("video");
    vi.spyOn(document, "createElement").mockReturnValue(video);
    vi.spyOn(video, "load").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:temporario");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  const arquivo = () => new File(["video"], "teste.mp4", { type: "video/mp4" });
  it("retorna os metadados e libera a URL temporária", async () => {
    Object.defineProperties(video, {
      duration: { value: 12 },
      videoWidth: { value: 640 },
      videoHeight: { value: 360 },
    });
    const leitura = lerInfo(arquivo());
    video.dispatchEvent(new Event("loadedmetadata"));
    await expect(leitura).resolves.toEqual({ duracao: 12, largura: 640, altura: 360 });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:temporario");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("falha em português após 10 segundos e libera os recursos", async () => {
    const leitura = lerInfo(arquivo());
    const verificar = expect(leitura).rejects.toThrow("10 segundos");
    await vi.advanceTimersByTimeAsync(10_000);
    await verificar;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:temporario");
    expect(video.getAttribute("src")).toBeNull();
  });
  it("informa erros de formato", async () => {
    const leitura = lerInfo(arquivo());
    video.dispatchEvent(new Event("error"));
    await expect(leitura).rejects.toThrow("Não foi possível abrir este vídeo");
    expect(vi.getTimerCount()).toBe(0);
  });
});
