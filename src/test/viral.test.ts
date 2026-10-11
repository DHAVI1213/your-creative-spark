import { describe, expect, it } from "vitest";
import { filtrarVideos, lerPerfil, normalizarVideos, urlMidia } from "@/lib/viral/modelo";
describe("perfis do minerador", () => {
  it.each([
    ["instagram.com/criador/reels", "instagram"],
    ["https://www.tiktok.com/@criador", "tiktok"],
    ["https://youtube.com/@criador/shorts", "youtube"],
    ["https://youtube.com/channel/UCabc", "youtube"],
  ])("identifica %s", (url, p) => expect(lerPerfil(url).plataforma).toBe(p));
  it.each([
    "https://instagram.com/reel/abc",
    "https://tiktok.com/@criador/video/123",
    "https://youtube.com/watch?v=abc",
    "https://youtube.com.evil.test/@criador",
    "https://localhost/perfil",
    "https://user:senha@instagram.com/perfil",
    "https://instagram.com:444/perfil",
  ])("recusa %s", (u) => expect(() => lerPerfil(u)).toThrow());
});
describe("métricas e filtros reais", () => {
  const videos = normalizarVideos(
    [
      {
        id: "a",
        url: "https://instagram.com/reel/a",
        caption: "Título azul",
        videoPlayCount: 100,
        likesCount: 10,
      },
      {
        id: "b",
        url: "https://instagram.com/reel/b",
        caption: "Título viral",
        videoPlayCount: 1000,
        likesCount: 80,
      },
      { id: "c", url: "https://instagram.com/reel/c", caption: "Sem métricas" },
      {
        id: "d",
        url: "https://instagram.com/reel/d",
        caption: "Métrica zero",
        videoPlayCount: 0,
        likesCount: 0,
      },
      { id: "a", url: "https://instagram.com/reel/a" },
      { id: "errado", url: "https://evil.test/a" },
    ],
    "instagram",
  );
  it("deduplica e mantém métricas ausentes distintas de zero", () => {
    expect(videos).toHaveLength(4);
    expect(videos[2]?.views).toBeNull();
    expect(videos[3]?.views).toBe(0);
  });
  it("compara com a mediana somente de views positivas", () => {
    expect(videos[1]?.vezesMediana).toBeCloseTo(1000 / 550);
    expect(videos[2]?.vezesMediana).toBeNull();
  });
  it("combina views, likes, título e score sem inventar métricas", () =>
    expect(
      filtrarVideos(videos, {
        views: 500,
        likes: 50,
        texto: "VIRAL",
        viral: 1,
        ranking: "likes",
      }).map((v) => v.id),
    ).toEqual(["b"]));
  it("ordena sem alterar a lista original", () => {
    expect(
      filtrarVideos(videos, { views: 0, likes: 0, texto: "", viral: 0, ranking: "views" }).map(
        (v) => v.id,
      ),
    ).toEqual(["b", "a", "d", "c"]);
    expect(videos[0]?.id).toBe("a");
  });
  it("normaliza TikTok e YouTube", () => {
    expect(
      normalizarVideos(
        [
          {
            id: "123",
            webVideoUrl: "https://tiktok.com/@criador/video/123",
            playCount: 20,
            diggCount: 2,
            mediaUrls: ["https://api.apify.com/v2/key-value-stores/abc/records/v.mp4"],
            videoMeta: { duration: 5 },
          },
        ],
        "tiktok",
      )[0]?.arquivo,
    ).toContain("api.apify.com");
    expect(
      normalizarVideos(
        [{ id: "abc", url: "https://youtube.com/watch?v=abc", viewCount: 10, likes: 3 }],
        "youtube",
      )[0]?.views,
    ).toBe(10);
  });
});
describe("endereços de mídia", () => {
  it.each([
    "https://localhost/v.mp4",
    "https://127.0.0.1/v.mp4",
    "https://api.apify.com/v2/users/me",
    "https://cdninstagram.com.evil.test/v.mp4",
    "http://video.cdninstagram.com/v.mp4",
  ])("bloqueia %s", (u) => expect(() => urlMidia(u)).toThrow());
  it("permite apenas CDN reconhecida ou arquivo de armazenamento Apify", () => {
    expect(urlMidia("https://video.cdninstagram.com/v.mp4").hostname).toBe(
      "video.cdninstagram.com",
    );
    expect(
      urlMidia("https://api.apify.com/v2/key-value-stores/abc/records/v.mp4?token=secreto").search,
    ).toBe("");
  });
});
