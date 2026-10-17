import { describe, expect, it } from "bun:test";
import { ajustar, candidatosRegra, frases, montarResultado, palavrasDoCorte, promptJanela } from "../src/lib/cortes/cortes";
import { arrumarPalavras, lerInfo, semRepeticao } from "../src/lib/cortes/transcricao";
import { gerarEmojis, listaConcat, realinhar } from "../src/lib/editor/legendas";
import { ajustarCorte } from "../src/lib/cortes/mesa";
import { DEFAULTS } from "../src/lib/editor/shared.js";

// 120 s de fala: uma frase de 6 palavras a cada 4 s
const words = Array.from({ length: 180 }, (_, i) => {
  const s = Math.floor(i / 6) * 4 + (i % 6) * 0.5;
  return { w: i % 6 === 5 ? "fim." : i % 6 === 0 ? "Segredo" : "palavra", s, e: s + 0.4 };
});

describe("Cortes Virais", () => {
  it("quebra em frases e ajusta cortes entre o mínimo e o máximo", () => {
    const F = frases(words);
    expect(F.length).toBe(30);
    const c = ajustar(F, words, 0, 29, 20, 30)!;
    expect(c.e - c.s).toBeLessThanOrEqual(30.6);
    expect(c.e - c.s).toBeGreaterThanOrEqual(19);
  });
  it("sem IA escolhe pelas regras sem sobrepor e separa extras", () => {
    const F = frases(words);
    const regras = candidatosRegra(F, words, [], 15, 30);
    const { escolhidos, extras } = montarResultado([], regras, 3);
    expect(escolhidos).toHaveLength(3);
    for (const a of escolhidos) for (const b of escolhidos) if (a !== b) expect(a.s < b.e - 0.5 && a.e > b.s + 0.5).toBe(false);
    expect(escolhidos.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(extras.every((x) => !escolhidos.some((c) => x.s < c.e - 0.5 && x.e > c.s + 0.5))).toBe(true);
  });
  it("prompt pede JSON com ids das frases e limites de duração", () => {
    const p = promptJanela(frases(words), 0, 5, 3, { tipo: "podcast", instrucoes: "foco em dinheiro", min: 30, max: 60 });
    expect(p).toContain("#0 [0:00]");
    expect(p).toContain("entre 30 e 60 segundos");
    expect(p).toContain("Pedido do editor: foco em dinheiro");
  });
  it("palavras do corte ficam com tempo relativo ao arquivo cortado", () => {
    expect(palavrasDoCorte(words, { s: 4, e: 6 })[0]).toEqual({ w: "Segredo", s: 0, e: 0.4 });
  });
  it("arruma palavras da transcrição e tira repetição alucinada", () => {
    const r = arrumarPalavras([{ w: " Olá", s: 0, e: 0.3 }, { w: ",", s: 0.3 }, { w: " mundo", s: 0.31, e: 0.8 }], 10);
    expect(r).toEqual([{ w: "Olá,", s: 10, e: 10.31 }, { w: "mundo", s: 10.31, e: 10.8 }]);
    const rep = ["a", "b", "c", "a", "b", "c", "a", "b", "c", "d"].map((w, i) => ({ w, s: i, e: i + 0.5 }));
    expect(semRepeticao(rep).map((w) => w.w).join("")).toBe("abcabcd");
  });
  it("lê duração, tamanho e áudio do log do FFmpeg", () => {
    const i = lerInfo(["  Duration: 01:02:03.50, start", "  Stream #0:0(und): Video: h264 (High), yuv420p(tv), 1920x1080 [SAR 1:1], 30 fps", "  Stream #0:1(und): Audio: aac"]);
    expect(i).toEqual({ duracao: 3723.5, largura: 1920, altura: 1080, temAudio: true, temVideo: true });
  });
  it("corte 9:16 tela cheia recorta as laterais e liga a legenda", () => {
    const s = ajustarCorte(structuredClone(DEFAULTS), { width: 1920, height: 1080, duration: 30 }, { formato: "cheio", legenda: true, emojis: true, titulo: true }, true);
    expect(s.recorte.left).toBe(656);
    expect(s.legendaAnim.ativo).toBe(true);
    expect(s.texto.pos).toBe("topo");
  });
});

describe("Legenda animada", () => {
  it("emojis da IA têm prioridade e respeitam o intervalo", () => {
    const ws = [{ w: "dinheiro", s: 0, e: 0.5 }, { w: "Deus", s: 1, e: 1.5 }, { w: "casa", s: 4, e: 4.5 }];
    expect(gerarEmojis(ws, [{ palavra: "casa", emoji: "🏡" }]).map((e) => e.ch)).toEqual(["💰", "🏡"]);
  });
  it("corrigir o texto mantém os tempos das palavras iguais", () => {
    const r = realinhar([{ w: "ola", s: 0, e: 1 }, { w: "mudo", s: 1, e: 2 }], "olá mundo lindo");
    expect(r[0]).toEqual({ w: "olá", s: 0, e: 1 });
    expect(r).toHaveLength(3);
  });
  it("lista do concat repete o último quadro", () => {
    expect(listaConcat(["a.png", "b.png"], [{ dur: 1 }, { dur: 2 }])).toBe("ffconcat version 1.0\nfile 'a.png'\nduration 1.0000\nfile 'b.png'\nduration 2.0000\nfile 'b.png'\n");
  });
});
