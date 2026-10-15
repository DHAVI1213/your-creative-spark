import { describe, expect, it } from "vitest";
import { ehLinkCurto, lerLink, normalizarVideos } from "@/lib/viral/modelo";

describe("qualquer link no minerador", () => {
  it.each([
    ["https://www.instagram.com/reel/C8abcDEF123/?igsh=xyz", "instagram", "video", "C8abcDEF123"],
    ["instagram.com/p/C8abcDEF123", "instagram", "video", "C8abcDEF123"],
    ["https://www.instagram.com/criador/reel/C8abcDEF123/", "instagram", "video", "C8abcDEF123"],
    [
      "https://www.tiktok.com/@criador/video/7123456789012345678?is_from_webapp=1",
      "tiktok",
      "video",
      "7123456789012345678",
    ],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "youtube", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1", "youtube", "video", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "video", "dQw4w9WgXcQ"],
    [
      "https://www.tiktok.com/music/original-sound-7149523537730997035?lang=pt",
      "tiktok",
      "musica",
      "7149523537730997035",
    ],
    ["instagram.com/criador", "instagram", "perfil", undefined],
    ["https://www.tiktok.com/@criador", "tiktok", "perfil", undefined],
    ["https://youtube.com/@criador/shorts", "youtube", "perfil", undefined],
  ])("entende %s", (url, plataforma, tipo, id) => {
    const l = lerLink(url);
    expect(l.plataforma).toBe(plataforma);
    expect(l.tipo).toBe(tipo);
    expect(l.id).toBe(id);
  });

  it("normaliza o endereço e tira rastreadores", () => {
    expect(lerLink("https://www.instagram.com/reel/C8abcDEF123/?igsh=xyz").url).toBe(
      "https://www.instagram.com/reel/C8abcDEF123/",
    );
    expect(lerLink("https://youtu.be/dQw4w9WgXcQ?si=abc").url).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it.each([
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://evil.test/https://www.tiktok.com/@a/video/7123456789012345678",
    "https://www.youtube.com/watch?v=curto",
    "https://www.instagram.com/reels/audio/123456789/",
    "https://open.spotify.com/track/abc",
    "https://localhost/reel/C8abcDEF123",
    "https://user:senha@www.instagram.com/reel/C8abcDEF123/",
    "http://www.tiktok.com/@a/video/7123456789012345678",
    "texto qualquer",
  ])("recusa %s", (u) => expect(() => lerLink(u)).toThrow());

  it("reconhece link curto do TikTok", () => {
    expect(ehLinkCurto("https://vm.tiktok.com/ZMabc123/")).toBe(true);
    expect(ehLinkCurto("https://www.tiktok.com/t/ZTabc123/")).toBe(true);
    expect(ehLinkCurto("https://vm.tiktok.com.evil.test/abc")).toBe(false);
    expect(ehLinkCurto("https://www.tiktok.com/@a/video/7123456789012345678")).toBe(false);
  });

  it("guarda o som original informado pelo coletor", () => {
    const [v] = normalizarVideos(
      [
        {
          id: "1",
          webVideoUrl: "https://www.tiktok.com/@a/video/1",
          text: "oi",
          playCount: 5,
          musicMeta: { playUrl: "https://sf16-ies-music-va.tiktokcdn.com/x/audio.mp3" },
        },
      ],
      "tiktok",
    );
    expect(v?.audio).toBe("https://sf16-ies-music-va.tiktokcdn.com/x/audio.mp3");
  });
});
