import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { getUser: mocks.getUser } },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { executarServico } from "@/lib/editor-original/servicos.server";

describe("serviços privados do editor", () => {
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
  it("recusa sessão inválida antes de ler configurações", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("sessão inválida") });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      executarServico({ token: "invalido", acao: "cloud-config", payload: {} }),
    ).rejects.toThrow("Entre na sua conta");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("recusa plano sem acesso antes de usar serviços pagos", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      executarServico({ token: "token", acao: "transcrever", payload: {} }),
    ).rejects.toThrow("plano");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("consulta só as conexões do usuário e não devolve chaves", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            configuracao: {
              cloudUrl: "https://editor.conta.workers.dev",
              cloudKey: "segredo",
              openai: "chave-ia",
            },
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const cfg = await executarServico({ token: "token", acao: "cloud-config", payload: {} });
    expect(fetch.mock.calls[0]?.[0]).toContain("user_id=eq.usuario-a");
    expect(cfg).toEqual({
      url: "https://editor.conta.workers.dev",
      apiKey: "configurada-no-servidor",
    });
    expect(JSON.stringify(cfg)).not.toMatch(/segredo|chave-ia/);
  });
  it("ignora endereço e chave enviados pelo cliente ao consultar contas", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { configuracao: { cloudUrl: "https://editor.conta.workers.dev", cloudKey: "segredo" } },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await executarServico({
      token: "token",
      acao: "cloud",
      payload: {
        cfg: { url: "http://localhost", apiKey: "outra-chave" },
        method: "PATCH",
        path: "/api/posts/id",
        body: { tentarDeNovo: true },
      },
    });
    expect(fetch.mock.calls[1]?.[0]).toBe("https://editor.conta.workers.dev/api/posts/id");
    expect(fetch.mock.calls[1]?.[1].method).toBe("PATCH");
    expect(fetch.mock.calls[1]?.[1].headers.authorization).toBe("Bearer segredo");
  });
});
