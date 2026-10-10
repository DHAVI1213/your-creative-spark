import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  FileCode2,
  Lightbulb,
  MessageSquareText,
  Palette,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { SystemWindow } from "@/components/system/System";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Dados do site clonado usados para montar os prompts. */
type SiteInfo = {
  title: string;
  url: string;
  description: string;
  headings: string[];
  menu: string[];
  colors: string[];
  fonts: string[];
  sections: number;
  hasWhatsapp: boolean;
};

function normalizeColor(c: string) {
  const v = c.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return "#" + [...v.slice(1)].map((x) => x + x).join("");
  const m = v.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m)
    return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  return v.slice(0, 7);
}

export function analyzeSite(html: string, url: string): SiteInfo {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = (el: Element) => (el.textContent || "").replace(/\s+/g, " ").trim();

  const headings = [...doc.querySelectorAll("h1, h2, h3")]
    .map(text)
    .filter((t) => t.length > 2 && t.length < 90)
    .slice(0, 10);
  const menu = [...doc.querySelectorAll("nav a, header a")]
    .map(text)
    .filter((t) => t.length > 1 && t.length < 30)
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, 8);

  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent || "").join("\n");
  const inline = [...doc.querySelectorAll("[style]")]
    .map((e) => e.getAttribute("style") || "")
    .join(";");
  const allCss = css + ";" + inline;

  const counts = new Map<string, number>();
  for (const m of allCss.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]+\)/g)) {
    const c = normalizeColor(m[0]);
    if (c === "#ffffff" || c === "#000000" || c.length !== 7) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const colors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c]) => c);

  const fonts = new Set<string>();
  doc.querySelectorAll("link[href*='fonts.googleapis.com']").forEach((l) => {
    for (const m of (l.getAttribute("href") || "").matchAll(/family=([^:&]+)/g)) {
      fonts.add(decodeURIComponent(m[1] ?? "").replace(/\+/g, " "));
    }
  });
  for (const m of allCss.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
    const first = (m[1] ?? "").split(",")[0]?.replace(/["']/g, "").trim();
    if (first && !/^(inherit|initial|var\(|sans-serif|serif|system-ui|-apple)/i.test(first))
      fonts.add(first);
  }

  return {
    title: doc.title?.trim() || new URL(url).hostname,
    url,
    description:
      doc.querySelector("meta[name='description']")?.getAttribute("content")?.trim() || "",
    headings,
    menu,
    colors,
    fonts: [...fonts].slice(0, 4),
    sections: doc.querySelectorAll("section").length || doc.body?.children.length || 0,
    hasWhatsapp: /wa\.me|whatsapp/i.test(html),
  };
}

type Client = { nome: string; segmento: string; cidade: string; whatsapp: string };

function structureBlock(s: SiteInfo) {
  const lines = [
    `- Site de referência: ${s.url} (título: "${s.title}")`,
    s.description && `- Descrição original: ${s.description}`,
    s.menu.length && `- Menu: ${s.menu.join(" · ")}`,
    s.headings.length && `- Seções/títulos na ordem: ${s.headings.map((h) => `"${h}"`).join(", ")}`,
    s.colors.length && `- Cores principais encontradas: ${s.colors.join(", ")}`,
    s.fonts.length && `- Fontes: ${s.fonts.join(", ")}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function clientBlock(c: Client) {
  return [
    `- Nome do negócio: ${c.nome || "[NOME DO CLIENTE]"}`,
    `- Segmento: ${c.segmento || "[SEGMENTO, ex.: hamburgueria, barbearia, açaí]"}`,
    `- Cidade: ${c.cidade || "[CIDADE]"}`,
    `- WhatsApp: ${c.whatsapp || "[NÚMERO COM DDD]"}`,
  ].join("\n");
}

type PromptDef = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  when: string;
  attach: string;
  build: (s: SiteInfo, c: Client) => string;
};

const PROMPTS: PromptDef[] = [
  {
    id: "recriar",
    title: "Recriar para o meu cliente",
    icon: Sparkles,
    when: "Você gostou da estrutura e quer um site novo, com a marca do seu cliente.",
    attach: "Anexe o arquivo .html (ou o .zip) que você baixou aqui.",
    build: (
      s,
      c,
    ) => `Você é um web designer sênior especialista em sites que vendem para negócios locais.

Anexei o HTML de um site que uso como REFERÊNCIA de estrutura e layout. Quero um site NOVO, original, para o meu cliente — mesma organização das seções e mesmo nível de qualidade, mas com identidade própria.

REFERÊNCIA
${structureBlock(s)}

MEU CLIENTE
${clientBlock(c)}

O QUE FAZER
1. Mantenha a ordem e o propósito das seções da referência, adaptando para o segmento do cliente.
2. Escreva textos novos, em português do Brasil, persuasivos e curtos. Não copie frases da referência.
3. Crie uma paleta própria para o cliente (não use a logo, o nome nem as fotos da referência).
4. Botões de ação levando para o WhatsApp do cliente (https://wa.me/55NUMERO com mensagem pronta).
5. Responsivo (celular primeiro), rápido, com boas práticas de SEO local (título, descrição, cidade).
6. Use imagens de banco gratuito (Unsplash) ou marque onde vão as fotos reais do cliente.

ENTREGA
Um único arquivo HTML completo, com CSS e JS dentro, pronto para abrir no navegador.`,
  },
  {
    id: "dna",
    title: "Extrair o DNA visual",
    icon: Palette,
    when: "Você quer guardar o estilo (cores, fontes, espaçamentos) para usar em vários sites.",
    attach: "Anexe o .html e, se puder, um print da página.",
    build: (
      s,
    ) => `Analise o HTML anexado (e o print, se houver) e extraia o "DNA visual" deste site.

DADOS QUE JÁ TENHO
${structureBlock(s)}

ME DEVOLVA EM JSON:
{
  "cores": { "primaria": "", "secundaria": "", "fundo": "", "texto": "", "destaque": "" },
  "tipografia": { "titulos": "", "textos": "", "tamanhos": { "h1": "", "h2": "", "corpo": "" } },
  "espacamentos": { "secao": "", "cards": "", "raio_dos_cantos": "" },
  "componentes": ["lista dos componentes visuais, ex.: cards com sombra, botão pílula..."],
  "efeitos": ["animações e efeitos visuais usados"],
  "estrutura": ["ordem das seções e o objetivo de cada uma"],
  "tom_de_voz": "como os textos falam com o cliente"
}

Depois do JSON, escreva em 5 linhas como eu descreveria esse estilo para outra IA recriar.`,
  },
  {
    id: "react",
    title: "Transformar em projeto Lovable / React",
    icon: FileCode2,
    when: "Você quer editar o site na Lovable, no Bolt ou no v0, com páginas e componentes.",
    attach: "Cole este prompt na Lovable e anexe o .html (ou cole o código).",
    build: (
      s,
      c,
    ) => `Converta o site anexado em um projeto React + TypeScript + Tailwind, organizado em componentes.

REFERÊNCIA
${structureBlock(s)}

CLIENTE
${clientBlock(c)}

REGRAS
- Um componente por seção (Header, Hero, Serviços, Depoimentos, Contato, Rodapé...).
- Mesma estrutura visual, mas com os textos, cores e contatos do cliente acima.
- Totalmente responsivo; botão flutuante de WhatsApp.
- Imagens como placeholders que eu possa trocar fácil.
- Nada de logos, nomes ou fotos do site de referência.
- Ao final, liste o que eu preciso trocar manualmente (fotos, textos, links).`,
  },
  {
    id: "copy",
    title: "Reescrever os textos para vender mais",
    icon: MessageSquareText,
    when: "A estrutura está ótima, mas os textos estão fracos ou são da empresa original.",
    attach: "Anexe o .html ou cole só os textos.",
    build: (
      s,
      c,
    ) => `Reescreva todos os textos do site anexado para o meu cliente, focando em conversão.

CLIENTE
${clientBlock(c)}

TÍTULOS ATUAIS (na ordem): ${s.headings.length ? s.headings.map((h) => `"${h}"`).join(", ") : "veja no arquivo"}

QUERO
- Título principal com promessa clara + subtítulo com prova (tempo, preço, avaliação).
- Seções com benefícios, não características. Frases curtas, linguagem do cliente final.
- 3 chamadas para ação diferentes para o WhatsApp.
- 3 depoimentos de exemplo marcados como [EXEMPLO — trocar por depoimento real].
- Perguntas frequentes (5) que quebrem objeções do segmento.
Devolva no formato: SEÇÃO → texto novo, na mesma ordem do site.`,
  },
  {
    id: "mobile",
    title: "Deixar perfeito no celular e rápido",
    icon: Lightbulb,
    when: "O site quebrou no celular ou está lento depois da cópia.",
    attach: "Anexe o .html e diga o que está estranho.",
    build: () => `Revise o HTML anexado e corrija para ficar perfeito no celular e rápido.

- Ajuste tudo que estoura a largura da tela ou fica pequeno demais para tocar.
- Menu de celular funcionando (hambúrguer).
- Imagens com tamanho certo, lazy loading e formato moderno quando possível.
- Remova scripts e estilos que não são usados.
- Mantenha o visual igual no computador.
Devolva o arquivo HTML completo corrigido e uma lista curta do que você mudou.`,
  },
  {
    id: "paginas",
    title: "Criar novas páginas no mesmo estilo",
    icon: BookOpen,
    when: "Você precisa de cardápio, página de serviços, agendamento, etc., combinando com o site.",
    attach: "Anexe o .html do site já editado.",
    build: (
      s,
      c,
    ) => `Usando o MESMO estilo visual do site anexado (cores, fontes, botões, espaçamentos), crie novas páginas para o meu cliente:

CLIENTE
${clientBlock(c)}

ESTILO DE REFERÊNCIA
${s.colors.length ? `Cores: ${s.colors.join(", ")}` : "Use as cores do arquivo"}${s.fonts.length ? `\nFontes: ${s.fonts.join(", ")}` : ""}

PÁGINAS
1. [ex.: Cardápio com categorias e preços]
2. [ex.: Página de serviços com valores]
3. [ex.: Página de contato com mapa e horários]

Cada página em um arquivo HTML separado, com o mesmo cabeçalho e rodapé, links entre elas funcionando.`,
  },
];

const AI_TIPS: { name: string; tips: string[] }[] = [
  {
    name: "ChatGPT",
    tips: [
      "Anexe o .html pelo clipe e cole o prompt. Para sites grandes, anexe o .zip.",
      "Peça “me dê o arquivo para baixar” para receber o HTML pronto.",
      "Use o gerador de imagens do ChatGPT para criar fotos e banners do cliente.",
    ],
  },
  {
    name: "Claude",
    tips: [
      "Anexe o .html e peça para mostrar o resultado como página: você vê o site na hora.",
      "Ótimo para textos longos e código grande sem cortar no meio.",
      "Peça ajustes conversando: “deixe o topo mais escuro”, “troque a fonte dos títulos”.",
    ],
  },
  {
    name: "Lovable / Bolt / v0",
    tips: [
      "Use o prompt “Transformar em projeto Lovable / React”.",
      "Ligue o projeto ao GitHub para editar depois sem perder nada.",
      "Peça uma mudança por vez: gasta menos créditos e erra menos.",
    ],
  },
  {
    name: "Gemini e outras",
    tips: [
      "Se não aceitar anexo, use “Copiar com o código” (o prompt já leva o HTML junto).",
      "Peça sempre o arquivo completo, não só trechos.",
    ],
  },
];

const STEPS: { title: string; text: ReactNode }[] = [
  {
    title: "Clone e confira",
    text: "Cole o endereço, confirme a autorização e veja na aba Ver se a cópia ficou fiel.",
  },
  {
    title: "Edite o que for simples aqui",
    text: "Na aba Editar: troque textos e imagens, apague o que não serve, mude cores e mova blocos. Use os botões de PC, tablet e celular para conferir.",
  },
  {
    title: "Baixe o arquivo",
    text: "Baixe o .zip (site completo) ou o HTML. É esse arquivo que você anexa na IA.",
  },
  {
    title: "Preencha os dados do cliente",
    text: "Logo abaixo, coloque nome, segmento, cidade e WhatsApp. Os prompts se preenchem sozinhos.",
  },
  {
    title: "Copie o prompt e mande para a IA",
    text: "Escolha o objetivo, copie, cole no ChatGPT, Claude ou Lovable e anexe o arquivo.",
  },
  {
    title: "Revise e entregue",
    text: "Abra o resultado no celular, teste o WhatsApp, troque as fotos pelas reais e publique (Lovable, Netlify, Vercel ou a hospedagem do cliente).",
  },
];

export function SiteManual({ html, url }: { html: string; url: string }) {
  const info = useMemo(() => analyzeSite(html, url), [html, url]);
  const [client, setClient] = useState<Client>({
    nome: "",
    segmento: "",
    cidade: "",
    whatsapp: "",
  });
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Prompt copiado. Agora é só colar na IA.");
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  };

  const withCode = (prompt: string) => {
    const max = 120_000;
    const code =
      html.length > max
        ? html.slice(0, max) + "\n<!-- ...código cortado por ser muito grande; anexe o arquivo -->"
        : html;
    return `${prompt}\n\n=== CÓDIGO HTML DO SITE ===\n${code}`;
  };

  return (
    <SystemWindow title="Manual · Criar sites com IA a partir deste">
      <Tabs defaultValue="prompts" className="p-4 md:p-5">
        <TabsList className="mb-4 grid h-auto w-full grid-cols-3 bg-secondary/60">
          <TabsTrigger value="prompts" className="text-xs">
            <Bot className="mr-1 size-3.5" /> Prompts
          </TabsTrigger>
          <TabsTrigger value="passo" className="text-xs">
            <BookOpen className="mr-1 size-3.5" /> Passo a passo
          </TabsTrigger>
          <TabsTrigger value="dicas" className="text-xs">
            <Lightbulb className="mr-1 size-3.5" /> Dicas por IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-5">
          {/* O que o sistema leu do site */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-sm border border-primary/20 bg-background/40 p-3 text-xs">
              <p className="sys-label text-[10px]">Lido do site</p>
              <p className="truncate">
                <span className="text-muted-foreground">Título:</span> {info.title}
              </p>
              <p>
                <span className="text-muted-foreground">Seções:</span> {info.sections} ·{" "}
                <span className="text-muted-foreground">Títulos:</span> {info.headings.length}
                {info.hasWhatsapp && " · tem WhatsApp"}
              </p>
              {info.colors.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">Cores:</span>
                  {info.colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="size-4 rounded-sm border border-white/20"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              )}
              {info.fonts.length > 0 && (
                <p className="truncate">
                  <span className="text-muted-foreground">Fontes:</span> {info.fonts.join(", ")}
                </p>
              )}
            </div>
            <div className="space-y-2 rounded-sm border border-primary/20 bg-background/40 p-3">
              <p className="sys-label text-[10px]">Dados do seu cliente</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Nome do negócio"
                  value={client.nome}
                  onChange={(e) => setClient({ ...client, nome: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Segmento"
                  value={client.segmento}
                  onChange={(e) => setClient({ ...client, segmento: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Cidade"
                  value={client.cidade}
                  onChange={(e) => setClient({ ...client, cidade: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="WhatsApp com DDD"
                  inputMode="tel"
                  value={client.whatsapp}
                  onChange={(e) => setClient({ ...client, whatsapp: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Os prompts abaixo se atualizam sozinhos.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {PROMPTS.map((p) => {
              const text = p.build(info, client);
              return (
                <details
                  key={p.id}
                  className="group rounded-sm border border-primary/20 bg-background/40"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-primary/40 text-primary">
                      <p.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{p.title}</span>
                      <span className="block text-xs text-muted-foreground">{p.when}</span>
                    </span>
                    <span className="font-mono text-[10px] text-primary group-open:hidden">
                      ABRIR
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-primary/15 p-3">
                    <p className="text-[11px] text-gold">📎 {p.attach}</p>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-sm bg-background/70 p-3 font-mono text-[11px] leading-5 text-foreground/90">
                      {text}
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => copy(p.id, text)} className="sys-btn-glow">
                        {copied === p.id ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                        Copiar prompt
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copy(`${p.id}-code`, withCode(text))}
                      >
                        <FileCode2 className="size-4" /> Copiar com o código
                      </Button>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="passo">
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="sys-glow-text font-display text-2xl font-bold leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <Warning />
        </TabsContent>

        <TabsContent value="dicas" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {AI_TIPS.map((a) => (
              <div
                key={a.name}
                className="rounded-sm border border-primary/20 bg-background/40 p-3"
              >
                <p className="mb-2 font-display text-lg font-bold uppercase">{a.name}</p>
                <ul className="space-y-1.5">
                  {a.tips.map((t) => (
                    <li key={t} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-sm border border-primary/20 bg-background/40 p-3 text-sm text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Regras de ouro</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Uma mudança por mensagem: a IA erra menos.</li>
              <li>Sempre peça o arquivo completo de volta, não só um pedaço.</li>
              <li>Teste no celular antes de mandar para o cliente.</li>
              <li>Guarde cada versão boa (baixe o arquivo) antes de pedir a próxima mudança.</li>
            </ul>
          </div>
          <Warning />
        </TabsContent>
      </Tabs>
    </SystemWindow>
  );
}

function Warning() {
  return (
    <div
      className={cn(
        "mt-4 flex gap-2 rounded-sm border border-gold/40 bg-gold/5 p-3 text-xs text-muted-foreground",
      )}
    >
      <ShieldAlert className="size-4 shrink-0 text-gold" />
      <p>
        Use sites de clientes que autorizaram ou como referência de estrutura. Para entregar a outro
        cliente, troque logo, nome, fotos e textos — marcas e fotos de terceiros têm dono.
      </p>
    </div>
  );
}
