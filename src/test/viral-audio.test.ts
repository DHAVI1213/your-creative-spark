import { describe, expect, it } from "vitest";
import { nomeMp3, nomeUnico } from "@/lib/viral/audio";

describe("áudio do minerador", () => {
  it("troca a extensão do vídeo por .mp3", () => {
    expect(nomeMp3("perfil_abc123.mp4")).toBe("perfil_abc123.mp3");
    expect(nomeMp3("perfil_abc123.webm")).toBe("perfil_abc123.mp3");
  });
  it("limpa caracteres perigosos e nunca devolve nome vazio", () => {
    expect(nomeMp3("a/b\\c:d.mp4")).toBe("a_b_c_d.mp3");
    expect(nomeMp3(".mp4")).toBe("audio.mp3");
  });
  it("não deixa dois arquivos com o mesmo nome no ZIP", () => {
    const usados = new Set<string>();
    expect(nomeUnico("a.mp3", usados)).toBe("a.mp3");
    expect(nomeUnico("a.mp3", usados)).toBe("a_2.mp3");
    expect(nomeUnico("a.mp3", usados)).toBe("a_3.mp3");
  });
});
