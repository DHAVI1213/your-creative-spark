import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  candidatosPorRegras,
  enderecoNuvem,
  limitarCandidatos,
  type Candidato,
} from "@/lib/editor-original/regras";

describe("cortes da ferramenta original", () => {
  const base: Candidato = {
    s: 0,
    e: 30,
    nota: 80,
    titulo: "Título",
    gancho: "",
    descricao: "",
    origem: "ia",
  };
  it("descarta tempos inválidos, trechos curtos e sobrepostos, e limita à duração", () => {
    const cortes = limitarCandidatos(
      [
        base,
        { ...base, s: 20, e: 50, nota: 90 },
        { ...base, s: 50, e: 100, nota: 70 },
        { ...base, s: NaN, e: 70 },
        { ...base, s: 60, e: 61 },
      ],
      80,
      15,
      40,
      10,
    );
    expect(cortes.map((c) => [c.s, c.e])).toEqual([
      [20, 50],
      [50, 80],
    ]);
    expect(cortes.every((c) => c.e <= 80)).toBe(true);
  });
  it("encontra frases reais completas, sem inventar resultados ou títulos", () => {
    const palavras = Array.from({ length: 45 }, (_, i) => ({
      w: i === 0 ? "Segredo" : i === 44 ? "final." : `palavra${i}`,
      s: i,
      e: i + 0.9,
    }));
    const cortes = candidatosPorRegras(palavras, 15, 60);
    expect(cortes.length).toBe(1);
    expect(cortes[0]?.s).toBe(0);
    expect(cortes[0]?.e).toBe(44.9);
    expect(cortes[0]?.titulo).toContain("Segredo");
  });
});

describe("conexão da nuvem", () => {
  it("só aceita Workers públicos HTTPS, sem credenciais nem redirecionamentos na URL", () => {
    expect(enderecoNuvem("https://meu-editor.conta.workers.dev")).toBe(
      "https://meu-editor.conta.workers.dev",
    );
    for (const u of [
      "http://meu-editor.conta.workers.dev",
      "https://127.0.0.1",
      "https://meu-editor.conta.workers.dev.evil.com",
      "https://user:pass@meu-editor.conta.workers.dev",
      "https://meu-editor.conta.workers.dev/private",
      "https://meu-editor.conta.workers.dev?url=http://localhost",
    ]) {
      expect(() => enderecoNuvem(u)).toThrow();
    }
  });
});

describe("pipeline original reutilizado", () => {
  function carregar() {
    const contexto = vm.createContext({ window: {} });
    for (const arquivo of ["shared.js", "ffmpeg-builder.js"])
      vm.runInContext(readFileSync(`public/editor-original/${arquivo}`, "utf8"), contexto);
    return vm.runInContext("({S:window.Shared,Builder:window.EditorBuilder})", contexto);
  }
  it("gera todos os filtros originais e usa codificador do navegador", () => {
    const { S, Builder } = carregar();
    for (const filtro of Object.keys(S.FILTROS)) {
      const s = S.clone(S.DEFAULTS);
      s.efeitos.filtro = filtro;
      const r = Builder.buildArgs(
        {
          meta: { width: 1920, height: 1080, duration: 10, hasAudio: true },
          input: "video.mp4",
          s,
        },
        { bg: "bg.png", ov: "ov.png", out: "out.mp4" },
        "x264",
      );
      expect(r.args).toContain("libx264");
      expect(r.args).not.toContain("h264_nvenc");
      expect(r.args).not.toContain("pipe:1");
      expect(r.outDur).toBe(10);
      expect(r.args.join(" ")).not.toMatch(/undefined|NaN/);
    }
  });
  it("preserva velocidade, corte, capa, áudio e legendas na mesma exportação", () => {
    const { S, Builder } = carregar(),
      s = S.clone(S.DEFAULTS);
    s.efeitos.corteInicio = 2;
    s.efeitos.corteFim = 2;
    s.efeitos.velocidade = 2;
    s.capa.ativo = true;
    s.capa.noInicio = true;
    s.capa.duracao = 0.5;
    s.audio.modo = "mixar";
    s.audio.musica = "musica.mp3";
    s.template.fundoTipo = "blur";
    const r = Builder.buildArgs(
      { meta: { width: 1920, height: 1080, duration: 10, hasAudio: true }, input: "video.mp4", s },
      { ov: "ov.png", out: "out.mp4", capa: "capa.jpg", cap: { list: "legendas.txt", y: 100 } },
      "x264",
    );
    expect(r.outDur).toBe(3.5);
    const g = r.args[r.args.indexOf("-filter_complex") + 1];
    expect(g).toContain("amix=");
    expect(g).toContain("concat=");
    expect(g).toContain("boxblur=");
    expect(r.args).toContain("legendas.txt");
  });
});
