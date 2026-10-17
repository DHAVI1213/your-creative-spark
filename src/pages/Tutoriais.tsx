import { useEffect, type ReactNode } from "react";
import { BookOpen, Bot, Cloud, Cpu, Download, Puzzle } from "lucide-react";
import { Card } from "../components/ui";
import { KIT_URL } from "../lib/agendador/agendador";
import { cn } from "../lib/utils";

function Secao({ id, icone, titulo, children }: { id: string; icone: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="space-y-4 p-5 md:p-6">
        <h2 className="flex items-center gap-3 text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-lime/15 text-lime">{icone}</span>
          {titulo}
        </h2>
        {children}
      </Card>
    </section>
  );
}

function Passos({ itens }: { itens: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {itens.map((t, i) => (
        <li key={i} className="flex gap-3 text-sm text-tsecondary">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-xs font-bold text-bg">{i + 1}</span>
          <span className="pt-0.5 leading-relaxed">{t}</span>
        </li>
      ))}
    </ol>
  );
}

const Cmd = ({ children }: { children: string }) => (
  <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-xs text-lime">{children}</code>
);

type Modelo = { nome: string; cmd: string; tamanho: string; obs: string };
const NIVEIS: { nivel: string; pc: string; modelos: Modelo[]; transcricao: string; destaque?: boolean }[] = [
  {
    nivel: "PC fraco",
    pc: "Sem placa de vídeo dedicada ou até 4 GB de VRAM · 8 GB de RAM",
    modelos: [
      { nome: "Qwen 2.5 3B", cmd: "ollama pull qwen2.5:3b", tamanho: "~2 GB", obs: "o mais leve que ainda escolhe bons cortes" },
      { nome: "Llama 3.2 3B", cmd: "ollama pull llama3.2:3b", tamanho: "~2 GB", obs: "alternativa leve" },
      { nome: "Gemma 3 4B", cmd: "ollama pull gemma3:4b", tamanho: "~3,3 GB", obs: "melhor texto em português dos leves" },
    ],
    transcricao: "Transcrição: “No navegador · Rápida (Small)” ou, para vídeos longos, a Groq (grátis e rápida, roda fora do seu PC). Neste nível, a IA grátis do Gemini costuma ser melhor que a local.",
  },
  {
    nivel: "PC médio",
    pc: "Placa com 6 a 8 GB de VRAM (ex.: RTX 3060, 4060, RX 6600) · 16 GB de RAM",
    modelos: [
      { nome: "Qwen 2.5 7B", cmd: "ollama pull qwen2.5:7b", tamanho: "~4,7 GB", obs: "recomendado: rápido e bom em português" },
      { nome: "Llama 3.1 8B", cmd: "ollama pull llama3.1:8b", tamanho: "~4,9 GB", obs: "alternativa equilibrada" },
      { nome: "Gemma 3 12B", cmd: "ollama pull gemma3:12b", tamanho: "~8 GB", obs: "melhor qualidade, só em placa de 8 GB" },
    ],
    transcricao: "Transcrição: “No navegador · Rápida (Small)” no Chrome/Edge (usa a placa de vídeo). Para vídeos de várias horas, a Groq é mais rápida.",
    destaque: true,
  },
  {
    nivel: "PC forte",
    pc: "Placa com 12 a 24 GB de VRAM (ex.: RTX 3080, 3090, 4070 Ti, 4090) · 32 GB de RAM",
    modelos: [
      { nome: "Qwen 2.5 14B", cmd: "ollama pull qwen2.5:14b", tamanho: "~9 GB", obs: "recomendado para RTX 3090: ótimo e rápido" },
      { nome: "Gemma 3 27B", cmd: "ollama pull gemma3:27b", tamanho: "~17 GB", obs: "texto muito bom, precisa de 24 GB" },
      { nome: "Qwen 2.5 32B", cmd: "ollama pull qwen2.5:32b", tamanho: "~20 GB", obs: "a melhor escolha de cortes, mais lenta" },
    ],
    transcricao: "Transcrição: “No navegador · Melhor (Turbo)” no Chrome/Edge, que usa a placa de vídeo. Grátis e sem limite.",
  },
];

export default function Tutoriais() {
  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth" });
  }, []);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
          <BookOpen className="size-7 text-lime" /> Tutoriais
        </h1>
        <p className="mt-2 text-sm text-tmuted">Configurações que você faz uma vez só para usar tudo de graça.</p>
        <nav className="mt-4 flex flex-wrap gap-2 text-xs">
          {[
            ["#nuvem", "Servidor grátis do Agendador"],
            ["#ia-local", "IA no seu PC (grátis)"],
            ["#ia-online", "IA online grátis"],
            ["#extensoes", "Extensões do Chrome"],
          ].map(([h, n]) => (
            <a key={h} href={h} className="rounded-full border border-border px-3 py-1.5 text-tsecondary hover:border-lime hover:text-lime">
              {n}
            </a>
          ))}
        </nav>
      </div>

      <Secao id="nuvem" icone={<Cloud className="size-5" />} titulo="Servidor grátis do Agendador (Cloudflare)">
        <p className="text-sm text-tsecondary">
          O Agendador publica no Instagram, YouTube e TikTok pelo <b>seu próprio servidor</b>, na sua conta grátis da Cloudflare. A agenda e os vídeos ficam com você, e os posts saem na hora certa
          mesmo com o computador desligado. Leva uns 5 minutos e é feito uma vez só.
        </p>
        <a href={KIT_URL} download className="inline-flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-bg">
          <Download className="size-4" /> Baixar o instalador do servidor
        </a>
        <Passos
          itens={[
            <>Instale o <b>Node.js</b> (versão LTS) em nodejs.org. No instalador, é só ir clicando em “Next”.</>,
            <>Descompacte o arquivo <Cmd>agendador-nuvem.zip</Cmd> numa pasta que você não vai apagar (ex.: Documentos).</>,
            <>Windows: dê dois cliques em <Cmd>instalar-nuvem.bat</Cmd>. Mac: dê dois cliques em <Cmd>instalar-nuvem.command</Cmd>. Na primeira vez ele baixa a ferramenta da Cloudflare (1 a 2 minutos).</>,
            <>O navegador abre na Cloudflare: entre (ou crie a conta grátis com seu e-mail) e clique em <b>Allow</b>. Volte para a janela preta: ele cria o banco, o armazenamento e publica o servidor sozinho.</>,
            <>Se aparecer o aviso do <b>R2</b>: abra dash.cloudflare.com → “R2 Object Storage” → ative o plano grátis (até 10 GB). A Cloudflare pede um cartão, mas não cobra dentro do limite grátis. Depois rode o instalador de novo.</>,
            <>Se pedir um <b>subdomínio workers.dev</b>: no painel da Cloudflare, “Workers e Pages” → escolha um nome. Rode o instalador de novo.</>,
            <>No fim aparecem o <b>Endereço da nuvem</b> e a <b>Chave da nuvem</b>. Copie os dois e cole no site em <b>Agendador → Minha nuvem</b>. Pronto: conecte as contas e agende.</>,
          ]}
        />
        <p className="rounded-lg bg-surface2 p-3 text-xs text-tmuted">
          Bom saber: a chave fica salva na sua conta do site (funciona no PC e no celular) e no arquivo <Cmd>config.json</Cmd> da pasta. Não mostre a chave para ninguém. Cada vídeo pode ter até ~100 MB
          (limite do plano grátis). Atualizamos o instalador? Baixe de novo e rode: a agenda e as contas continuam.
        </p>
      </Secao>

      <Secao id="ia-local" icone={<Cpu className="size-5" />} titulo="IA no seu PC (Ollama, grátis e sem limite)">
        <p className="text-sm text-tsecondary">
          A IA escolhe os melhores momentos nos <b>Cortes Virais</b> e escreve as <b>Frases com IA</b>. Com o Ollama ela roda no seu computador: grátis, sem limite e sem mandar nada para fora.
        </p>
        <Passos
          itens={[
            <>Baixe e instale o Ollama em <b>ollama.com</b> (Windows, Mac ou Linux).</>,
            <>Escolha um modelo na tabela abaixo, de acordo com o seu PC, abra o terminal (Windows: tecla Iniciar → digite “cmd”) e rode o comando dele. Ex.: <Cmd>ollama pull qwen2.5:7b</Cmd></>,
            <>Libere o site para falar com o Ollama. Windows: no terminal, rode <Cmd>setx OLLAMA_ORIGINS *</Cmd>, feche o Ollama (ícone perto do relógio → Quit) e abra de novo. Mac: <Cmd>launchctl setenv OLLAMA_ORIGINS "*"</Cmd> e reabra o Ollama.</>,
            <>No site, em Editor em Massa → <b>Cortes Virais</b> → Inteligência, escolha <b>Ollama</b>, escreva o nome do modelo (ex.: qwen2.5:7b) e clique em <b>Testar conexão</b>. Se o Chrome perguntar se o site pode acessar a sua rede local, clique em <b>Permitir</b>.</>,
          ]}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {NIVEIS.map((n) => (
            <div key={n.nivel} className={cn("space-y-3 rounded-xl border p-4", n.destaque ? "border-lime/50 bg-lime/5" : "border-border")}>
              <div>
                <p className="font-bold">{n.nivel}</p>
                <p className="text-[11px] text-tmuted">{n.pc}</p>
              </div>
              {n.modelos.map((m) => (
                <div key={m.cmd} className="space-y-1 border-t border-border pt-2">
                  <p className="flex justify-between gap-2 text-sm font-semibold">
                    {m.nome} <span className="text-xs font-normal text-tmuted">{m.tamanho}</span>
                  </p>
                  <Cmd>{m.cmd}</Cmd>
                  <p className="text-[11px] text-tmuted">{m.obs}</p>
                </div>
              ))}
              <p className="border-t border-border pt-2 text-[11px] text-tsecondary">{n.transcricao}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-tmuted">
          Não sabe quanto de VRAM tem? Windows: Gerenciador de Tarefas → Desempenho → GPU → “Memória dedicada da GPU”. Os tamanhos são o download aproximado; o modelo precisa caber na memória da placa
          para ficar rápido. Se ficar lento, use um modelo do nível de baixo.
        </p>
        <h3 className="pt-2 font-semibold">Transcrição da fala (Whisper)</h3>
        <p className="text-sm text-tsecondary">
          Não precisa instalar nada: o Whisper roda dentro do próprio navegador e baixa o modelo na primeira vez (Small ~250 MB, Turbo ~1 GB). Use Chrome ou Edge atualizado para ele aproveitar a placa
          de vídeo. A transcrição fica guardada no navegador: gerar de novo no mesmo vídeo é instantâneo.
        </p>
      </Secao>

      <Secao id="ia-online" icone={<Bot className="size-5" />} titulo="IA online grátis (para qualquer PC ou celular)">
        <Passos
          itens={[
            <><b>Gemini (Google)</b> para escolher os cortes e escrever frases: entre em aistudio.google.com → “Get API key” → “Create API key”. Cole a chave em Cortes Virais → Inteligência → Google Gemini.</>,
            <><b>Groq</b> para transcrever vídeos longos em minutos: entre em console.groq.com → “API Keys” → “Create API Key”. Cole em Cortes Virais → Transcrição → Groq. A mesma chave também serve como IA: escolha “OpenAI / compatível”, endereço https://api.groq.com/openai/v1 e modelo llama-3.3-70b-versatile.</>,
            <>As chaves ficam guardadas só no seu navegador e as chamadas saem direto do seu computador para o Google/Groq.</>,
          ]}
        />
      </Secao>

      <Secao id="extensoes" icone={<Puzzle className="size-5" />} titulo="Extensões do Chrome">
        <p className="text-sm text-tsecondary">Três ferramentas funcionam como extensões do Chrome (ou Edge). Instalar é igual para todas:</p>
        <Passos
          itens={[
            <>Baixe o ZIP da extensão abaixo e descompacte numa pasta que você não vai apagar (ex.: Documentos).</>,
            <>No Chrome, abra <Cmd>chrome://extensions</Cmd> e ligue o <b>Modo do desenvolvedor</b> (canto de cima, à direita).</>,
            <>Clique em <b>Carregar sem compactação</b> e escolha a pasta da extensão.</>,
            <>Clique no ícone de quebra-cabeça do Chrome e fixe a extensão na barra. Pronto.</>,
          ]}
        />
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Minerador Viral", "/downloads/minerador-viral.zip", "/app/viral", "Acha os vídeos que mais performaram num perfil do Instagram, TikTok ou YouTube e baixa em massa."],
            ["Clonador de Sites", "/downloads/clonador-de-sites.zip", "/app/clonador", "Copia um site (com autorização), edita e exporta para a Lovable/GitHub."],
            ["Minerador de Clientes", "/downloads/minerador-de-clientes.zip", "/app/minerador", "Acha lojas no Google Maps que precisam de site e abre o WhatsApp com a mensagem pronta."],
          ].map(([n, zip, pag, d]) => (
            <div key={n} className="space-y-2 rounded-xl border border-border p-4">
              <p className="font-semibold">{n}</p>
              <p className="text-xs text-tmuted">{d}</p>
              <div className="flex gap-3 text-xs">
                <a href={zip} download className="font-semibold text-lime underline">Baixar</a>
                <a href={pag} className="text-tsecondary underline">Como usar</a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-tmuted">
          O botão ➜ Editor e a aba Link do Minerador Viral usam a <b>Ponte NK</b>, um programinha que roda no seu PC e baixa TikTok e YouTube.{" "}
          <a href="/downloads/ponte-nk.zip" download className="text-lime underline">Baixar a Ponte NK</a> e veja o passo a passo na página do Minerador Viral.
        </p>
      </Secao>
    </div>
  );
}
