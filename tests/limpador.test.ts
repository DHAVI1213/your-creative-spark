import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanArgs, nomesSequenciais, parseProbe } from "../src/lib/metadata/video";

const ff = (args: string[]) => spawnSync("ffmpeg", args, { encoding: "utf8" });
const temFfmpeg = ff(["-version"]).status === 0;

describe("Limpador de Metadados", () => {
  it("lê duração e faixas do log do FFmpeg, inclusive capa embutida e dados", () => {
    const p = parseProbe([
      "  Duration: 00:01:02.50, start: 0.000000, bitrate: 900 kb/s",
      "  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1080x1920",
      "  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo",
      "  Stream #0:2[0x3](und): Data: none (mebx / 0x7862656D)",
      "  Stream #0:3: Video: mjpeg (Baseline), yuvj420p, 320x568 (attached pic)",
    ]);
    expect(p.duracao).toBeCloseTo(62.5);
    expect(p.streams.map((s) => s.tipo)).toEqual(["video", "audio", "outro", "video"]);
    expect(p.streams[3]?.capa).toBe(true);
  });

  it("descarta faixas de dados, limpa metadados por faixa e remove SEI só do vídeo principal", () => {
    const p = parseProbe([
      "  Stream #0:0: Video: h264, yuv420p",
      "  Stream #0:1: Audio: aac",
      "  Stream #0:2: Data: none",
      "  Stream #0:3: Video: mjpeg (attached pic)",
    ]);
    const a = cleanArgs("in.mp4", "out.mp4", "mp4", p, true).join(" ");
    expect(a).toContain("-map 0:0 -map 0:1 -map 0:3");
    expect(a).not.toContain("0:2");
    expect(a).toContain("-map_metadata -1");
    expect(a).toContain("-bsf:0 filter_units=remove_types=6");
    expect(a).not.toContain("-bsf:2");
    expect(a).toContain("-movflags +faststart");
    expect(cleanArgs("in.mp4", "out.mp4", "mp4", p, false).join(" ")).not.toContain("filter_units");
  });

  it("renomeia para vídeo 1, 2, 3 na ordem do Explorer, separado por pasta", () => {
    const r = nomesSequenciais(["A/clip 10.mp4", "A/clip 2.MOV", "A/sub/x.mp4", "solto.mp4"]);
    expect(r.get("A/clip 2.MOV")).toBe("A/vídeo 1.mov");
    expect(r.get("A/clip 10.mp4")).toBe("A/vídeo 2.mp4");
    expect(r.get("A/sub/x.mp4")).toBe("A/sub/vídeo 1.mp4");
    expect(r.get("solto.mp4")).toBe("vídeo 1.mp4");
  });

  it.skipIf(!temFfmpeg)("o comando limpa de verdade e mantém duração e faixas", () => {
    const dir = mkdtempSync(join(tmpdir(), "limp-"));
    try {
      const inp = join(dir, "in.mp4");
      const out = join(dir, "out.mp4");
      ff(["-y", "-f", "lavfi", "-i", "testsrc=d=2:s=320x240", "-f", "lavfi", "-i", "sine=d=2", "-c:v", "libx264", "-c:a", "aac",
        "-metadata", "title=Segredo", "-metadata", "location=+12.34-056.78/", "-metadata", "comment=gravado no iPhone", "-shortest", inp]);
      const antes = ff(["-hide_banner", "-i", inp]).stderr.split("\n");
      const probe = parseProbe(antes);
      expect(ff(cleanArgs(inp, out, "mp4", probe, true).map((x) => x)).status).toBe(0);
      const depois = ff(["-hide_banner", "-i", out]).stderr;
      expect(depois).not.toContain("Segredo");
      expect(depois).not.toContain("location");
      expect(depois).not.toContain("iPhone");
      const p2 = parseProbe(depois.split("\n"));
      expect(p2.streams.length).toBe(2);
      expect(Math.abs(p2.duracao - probe.duracao)).toBeLessThan(0.25);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
