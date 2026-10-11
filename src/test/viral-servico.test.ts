import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { getUser: mocks.getUser } },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { executarMinerador } from "@/lib/viral/servico.server";
const json = (v: unknown) =>
  new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });
describe("coleta autenticada", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://banco.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "usuario-a" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  it("recusa sessão inválida antes de serviços pagos", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: Error() });
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(executarMinerador({ token: "x", acao: "config" })).rejects.toThrow("Entre");
    expect(f).not.toHaveBeenCalled();
  });
  it("exige acesso ao plano", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(executarMinerador({ token: "x", acao: "iniciar" })).rejects.toThrow("plano");
    expect(f).not.toHaveBeenCalled();
  });
  it("retorna somente o estado da configuração, sem chave", async () => {
    const f = vi.fn().mockResolvedValue(json([{ valor: "token-secreto" }]));
    vi.stubGlobal("fetch", f);
    const r = await executarMinerador({ token: "x", acao: "config" });
    expect(r.configurado).toBe(true);
    expect(JSON.stringify(r)).not.toContain("token-secreto");
  });
  it("sem chave não simula resultados", async () => {
    const f = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", f);
    await expect(
      executarMinerador({ token: "x", acao: "iniciar", perfil: "instagram.com/criador" }),
    ).rejects.toThrow("conectar");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("nunca consulta resultados de outra conta", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", f);
    await expect(
      executarMinerador({ token: "x", acao: "consultar", busca: "busca-alheia" }),
    ).rejects.toThrow("não pertence");
    expect(f.mock.calls[1]?.[0]).toContain("user_id=eq.usuario-a");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("não baixa mídia interna mesmo quando o coletor a devolve", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(
        json([
          {
            id: "b",
            status: "pronto",
            videos: [{ id: "v", arquivo: "https://127.0.0.1/video.mp4" }],
          },
        ]),
      );
    vi.stubGlobal("fetch", f);
    await expect(
      executarMinerador({ token: "x", acao: "arquivo", busca: "b", id: "v" }),
    ).rejects.toThrow("permitido");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("não aceita HTML disfarçado de vídeo", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(
        json([
          {
            id: "b",
            status: "pronto",
            videos: [{ id: "v", arquivo: "https://video.cdninstagram.com/a.mp4" }],
          },
        ]),
      )
      .mockResolvedValueOnce(
        new Response("<html>login</html>", { headers: { "content-type": "text/html" } }),
      );
    vi.stubGlobal("fetch", f);
    await expect(
      executarMinerador({ token: "x", acao: "arquivo", busca: "b", id: "v" }),
    ).rejects.toThrow("página");
  });
  it("baixa MP4 real sem enviar a chave Apify para CDN", async () => {
    const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50]);
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(
        json([
          {
            id: "b",
            perfil: { nome: "criador" },
            status: "pronto",
            videos: [{ id: "v", arquivo: "https://video.cdninstagram.com/a.mp4" }],
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(bytes, { headers: { "content-type": "video/mp4" } }));
    vi.stubGlobal("fetch", f);
    const r = await executarMinerador({ token: "x", acao: "arquivo", busca: "b", id: "v" });
    expect(r.nome).toBe("criador_v.mp4");
    expect(atob(r.base64!)).toContain("ftyp");
    expect(f.mock.calls[2]?.[1].headers).toEqual({});
    expect(f.mock.calls[2]?.[1].redirect).toBe("error");
  });
  it("não reinicia automaticamente downloads que falharam", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(
        json([
          {
            id: "b",
            perfil: { plataforma: "youtube" },
            status: "pronto",
            download_run: "runABC",
            videos: [{ id: "v", arquivo: null }],
          },
        ]),
      )
      .mockResolvedValueOnce(json({ data: { status: "SUCCEEDED", defaultDatasetId: "dataABC" } }))
      .mockResolvedValueOnce(json([{ videoId: "v", status: "failed" }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", f);
    await expect(
      executarMinerador({ token: "x", acao: "preparar", busca: "b", ids: ["v"] }),
    ).rejects.toThrow("não conseguiu baixar");
    expect(f.mock.calls.filter((c) => String(c[0]).includes("/acts/"))).toHaveLength(0);
  });
  it("reserva do download evita execuções pagas duplicadas", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(
        json([
          {
            id: "b",
            perfil: { plataforma: "youtube" },
            status: "pronto",
            download_run: null,
            videos: [{ id: "v", arquivo: null, link: "https://youtube.com/watch?v=v" }],
          },
        ]),
      )
      .mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", f);
    const r = await executarMinerador({ token: "x", acao: "preparar", busca: "b", ids: ["v"] });
    expect(r.status).toBe("baixando");
    expect(f.mock.calls[2]?.[0]).toContain("download_run=is.null");
    expect(f).toHaveBeenCalledTimes(3);
  });
  it.each([200, 201, 204])(
    "inicia a coleta quando escritas mínimas respondem %s sem JSON",
    async (status) => {
      const f = vi
        .fn()
        .mockResolvedValueOnce(json([{ valor: "segredo" }]))
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(json([]))
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(json({ data: { id: "runABC" } }))
        .mockResolvedValueOnce(new Response(null, { status }));
      vi.stubGlobal("fetch", f);
      const r = await executarMinerador({
        token: "x",
        acao: "iniciar",
        perfil: "https://www.instagram.com/lolita/",
        limite: 100,
      });
      expect(r.status).toBe("processando");
      expect(r.busca).toBeTruthy();
      expect(f).toHaveBeenCalledTimes(6);
    },
  );
  it("explica resposta vazia da Apify e encerra a reserva", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", f);
    await expect(
      executarMinerador({ token: "x", acao: "iniciar", perfil: "instagram.com/lolita" }),
    ).rejects.toThrow("Apify devolveu uma resposta vazia");
    expect(f.mock.calls[5]?.[1].body).toBe(JSON.stringify({ status: "erro" }));
  });
  it("não trata uma leitura vazia do banco como ausência de configuração", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await expect(executarMinerador({ token: "x", acao: "config" })).rejects.toThrow(
      "banco devolveu uma resposta vazia",
    );
  });
  it("recupera reservas órfãs sem expirar execuções novas da Apify", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json([{ valor: "segredo" }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(json({ data: { id: "runABC" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", f);
    await executarMinerador({ token: "x", acao: "iniciar", perfil: "instagram.com/lolita" });
    const u = new URL(f.mock.calls[1]![0]);
    expect(u.searchParams.get("user_id")).toBe("eq.usuario-a");
    expect(u.searchParams.get("status")).toBe("eq.processando");
    expect(u.searchParams.get("or")).toContain("and(run_id.is.null,criado_em.lt.");
  });
  it.each([
    ["23505", 409, "busca em andamento"],
    ["42P01", 404, "estrutura"],
    ["42501", 403, "permissão"],
  ])("explica a falha %s sem acusar sempre migração", async (code, status, mensagem) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status })),
    );
    await expect(executarMinerador({ token: "x", acao: "config" })).rejects.toThrow(mensagem);
  });
});
