import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  GitBranch,
  Github,
  Laptop,
  Rocket,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Guia: usar a Lovable quase sem gastar créditos, editando o código pelo GitHub
 * com a ajuda do ChatGPT (ou outra IA). A Lovable sincroniza sozinha o que muda no GitHub.
 */

type Caminho = "gratis" | "codex" | "pc";

const PROMPT_ARQUIVO = `Você é um programador sênior de React + TypeScript + Tailwind CSS.
Vou te mandar UM arquivo de um projeto feito na Lovable e o que eu quero mudar.

REGRAS
- Me devolva o ARQUIVO INTEIRO já alterado, do começo ao fim, num único bloco de código.
- Não corte nada com "..." nem "resto do código igual".
- Não mude o nome do arquivo, os imports que já existem nem coisas que eu não pedi.
- Se precisar de um arquivo NOVO, me diga o caminho exato (ex.: src/components/Precos.tsx) e mande ele inteiro também.
- Use só o que o projeto já tem (React, Tailwind, componentes de src/components/ui). Não instale pacotes novos.

O QUE EU QUERO
[descreva aqui: ex. "troque o título para 'Hamburgueria do Zé', deixe o botão verde e coloque o link do WhatsApp 5562999999999"]

CAMINHO DO ARQUIVO
[ex.: src/pages/Index.tsx]

CONTEÚDO ATUAL DO ARQUIVO
[cole aqui o arquivo inteiro que você copiou do GitHub]`;

const PROMPT_PAGINA = `Você é um programador sênior de React + TypeScript + Tailwind CSS.
Meu projeto foi criado na Lovable. Quero uma PÁGINA NOVA no mesmo estilo do site.

1. Me diga em qual arquivo as rotas ficam (vou te mandar o arquivo de rotas abaixo).
2. Crie a página nova inteira, com o caminho exato do arquivo (ex.: src/pages/Cardapio.tsx).
3. Me devolva o arquivo de rotas INTEIRO já com a página nova registrada.
4. Não instale pacotes novos e não corte nada com "...".

A PÁGINA NOVA
[ex.: cardápio com categorias Lanches, Porções e Bebidas, com foto, nome, descrição e preço]

ARQUIVO DE ROTAS ATUAL
[cole aqui, ex.: src/App.tsx ou a pasta src/routes]

UMA PÁGINA QUE JÁ EXISTE (para copiar o estilo)
[cole aqui, ex.: src/pages/Index.tsx]`;

const PROMPT_CODEX = `Este repositório é um site feito na Lovable (React + TypeScript + Tailwind).
Tarefa: [descreva a mudança, ex.: "crie a seção de depoimentos depois da seção de preços, com 3 cards"].

Regras:
- Não instale pacotes novos e não mexa em package.json, bun.lock nem na pasta src/integrations.
- Mantenha o mesmo estilo visual do site.
- Rode o build para conferir que não quebrou nada.
- Faça um commit pequeno com uma mensagem em português explicando a mudança.`;

const PROMPT_LOVABLE_INICIAL = `Crie um site de uma página para [NOME DO NEGÓCIO], [SEGMENTO] em [CIDADE].
Seções: topo com chamada forte e botão do WhatsApp, sobre, serviços/cardápio, depoimentos, localização e rodapé.
Visual moderno, responsivo, cores [CORES]. Botão flutuante do WhatsApp (https://wa.me/55[NÚMERO]).
Faça tudo de uma vez, numa única resposta.`;

export function LovableGratis() {
  const [caminho, setCaminho] = useState<Caminho>("gratis");

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-sm border border-success/40 bg-success/10 p-4 text-sm">
        <Wallet className="size-5 shrink-0 text-success" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Por que isso economiza créditos</p>
          <p className="text-muted-foreground">
            Na Lovable, o que gasta crédito é conversar com a IA dela. Quando o projeto está ligado
            ao GitHub, tudo que muda no GitHub aparece sozinho na Lovable — sem passar pela IA dela.
            Então você usa a Lovable para <b>criar a primeira versão</b> e <b>publicar</b>, e faz as
            mudanças pelo GitHub com a ajuda do ChatGPT (ou outra IA).
          </p>
        </div>
      </div>

      {/* Escolha do caminho */}
      <div className="grid gap-2 sm:grid-cols-3">
        <CaminhoBtn
          ativo={caminho === "gratis"}
          onClick={() => setCaminho("gratis")}
          icon={Sparkles}
          titulo="100% grátis"
          sub="ChatGPT grátis + editor do GitHub"
          selo="Recomendado"
        />
        <CaminhoBtn
          ativo={caminho === "codex"}
          onClick={() => setCaminho("codex")}
          icon={Github}
          titulo="ChatGPT ligado no GitHub"
          sub="Codex na nuvem · ChatGPT pago"
        />
        <CaminhoBtn
          ativo={caminho === "pc"}
          onClick={() => setCaminho("pc")}
          icon={Laptop}
          titulo="Pelo computador"
          sub="Codex no PC + GitHub Desktop"
        />
      </div>

      {/* Parte comum: preparar Lovable + GitHub */}
      <Bloco titulo="Parte 1 · Preparar (uma vez por projeto)">
        <Passo n={1} titulo="Crie uma conta no GitHub">
          Entre em <b>github.com</b> e crie uma conta grátis. É lá que o código do site vai ficar
          guardado.
        </Passo>
        <Passo n={2} titulo="Crie a conta na Lovable e o projeto">
          Entre em <b>lovable.dev</b> (o plano grátis dá algumas mensagens por dia). Mande{" "}
          <b>um único prompt bem completo</b> para criar a primeira versão do site — quanto mais
          detalhado, menos mensagens você gasta depois.
          <CopyBox texto={PROMPT_LOVABLE_INICIAL} rotulo="Prompt para a primeira versão" />
        </Passo>
        <Passo n={3} titulo="Ligue o projeto ao GitHub">
          No projeto da Lovable, abra o menu de <b>integrações / GitHub</b> → <b>Connect</b> →
          autorize a Lovable na sua conta do GitHub → <b>Create repository</b>. Pronto: a Lovable
          cria um repositório com todo o código do site, no ramo <b>main</b>.
        </Passo>
        <Dica>
          A Lovable sincroniza um ramo por vez — por padrão o <b>main</b>. Faça as mudanças sempre
          no main, senão elas não aparecem na Lovable.
        </Dica>
      </Bloco>

      {caminho === "gratis" && (
        <Bloco titulo="Parte 2 · Mudar o site sem gastar crédito (ChatGPT grátis)">
          <Passo n={4} titulo="Ache o arquivo que você quer mudar">
            No GitHub, abra o repositório. As telas ficam em <b>src/pages</b> ou <b>src/routes</b>,
            e os pedaços (topo, rodapé, cards) em <b>src/components</b>. Abra o arquivo e toque em{" "}
            <b>Copiar</b> (ícone de dois quadradinhos acima do código).
          </Passo>
          <Passo n={5} titulo="Peça a mudança no ChatGPT">
            Abra o ChatGPT (conta grátis serve), cole o prompt abaixo, escreva o que quer mudar e
            cole o arquivo no final. Ele devolve o arquivo inteiro já alterado.
            <CopyBox texto={PROMPT_ARQUIVO} rotulo="Prompt para mudar um arquivo" />
            <CopyBox texto={PROMPT_PAGINA} rotulo="Prompt para criar uma página nova" />
          </Passo>
          <Passo n={6} titulo="Cole o código no GitHub e salve">
            No GitHub, no mesmo arquivo, toque no <b>lápis (Edit)</b>, apague tudo, cole o código
            que o ChatGPT mandou e toque em <b>Commit changes</b> → confirme no ramo <b>main</b>.
            Arquivo novo: <b>Add file → Create new file</b> e digite o caminho que o ChatGPT
            indicou.
          </Passo>
          <Passo n={7} titulo="Confira na Lovable">
            Em cerca de 1 minuto a mudança aparece no projeto da Lovable. Abra a prévia e veja se
            ficou certo. Se não apareceu, atualize a página da Lovable.
          </Passo>
        </Bloco>
      )}

      {caminho === "codex" && (
        <Bloco titulo="Parte 2 · ChatGPT mexendo direto no GitHub (Codex na nuvem)">
          <Aviso>
            Pela ajuda oficial da OpenAI, o Codex na nuvem (que conecta no GitHub) fica nos planos
            pagos (Plus em diante) — não está no Grátis nem no Go. Sem plano pago, use o caminho
            “100% grátis”.
          </Aviso>
          <Passo n={4} titulo="Conecte o GitHub no Codex">
            No ChatGPT, abra o <b>Codex</b> → <b>Cloud</b> → <b>Create environment</b>, conecte sua
            conta do GitHub e escolha o repositório do site.
          </Passo>
          <Passo n={5} titulo="Peça a mudança">
            Comece uma tarefa nova e descreva o que quer. O Codex mexe no código, roda e mostra o
            resultado.
            <CopyBox texto={PROMPT_CODEX} rotulo="Prompt para o Codex" />
          </Passo>
          <Passo n={6} titulo="Mande para o main">
            Quando estiver bom, peça para criar o <b>pull request</b>. No GitHub, abra o pull
            request e toque em <b>Merge</b>. A mudança vai para o main e aparece na Lovable.
          </Passo>
        </Bloco>
      )}

      {caminho === "pc" && (
        <Bloco titulo="Parte 2 · Pelo computador (Codex no PC + GitHub Desktop)">
          <Aviso>
            Bom para quem vai fazer muitas mudanças. O Codex no computador entra com a conta do
            ChatGPT; os limites de uso dependem do plano.
          </Aviso>
          <Passo n={4} titulo="Baixe o projeto para o PC">
            Instale o <b>GitHub Desktop</b>, entre com sua conta e use <b>Clone repository</b> no
            repositório do site.
          </Passo>
          <Passo n={5} titulo="Peça a mudança ao Codex">
            Abra a pasta do projeto no Codex (aplicativo do ChatGPT para computador ou terminal) e
            peça a mudança.
            <CopyBox texto={PROMPT_CODEX} rotulo="Prompt para o Codex" />
          </Passo>
          <Passo n={6} titulo="Envie para o GitHub">
            No GitHub Desktop, escreva o resumo da mudança, toque em <b>Commit to main</b> e depois
            em <b>Push origin</b>. Em cerca de 1 minuto aparece na Lovable.
          </Passo>
        </Bloco>
      )}

      <Bloco titulo="Parte 3 · Ajustar e publicar">
        <Passo n={8} titulo="Use a Lovable só no que precisa dela">
          Deixe as mensagens da Lovable para o que só ela faz bem: ligar banco de dados/login,
          consertar um erro que o ChatGPT não resolveu, ou um ajuste rápido. Uma mudança por
          mensagem.
        </Passo>
        <Passo n={9} titulo="Publique">
          Na Lovable, toque em <b>Publish</b>. O site vai ao ar num endereço da Lovable que você já
          pode mandar para o cliente. Toda mudança nova que chegar pelo GitHub entra quando você
          publicar de novo.
        </Passo>
      </Bloco>

      <Bloco titulo="Se der errado">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <Item>
            <b>O site quebrou depois de uma mudança:</b> no GitHub, abra o arquivo que você mudou e
            toque em <b>History</b>. Abra a versão anterior, copie o código e cole de volta no
            arquivo (Commit). No GitHub Desktop é mais rápido: botão direito no commit →{" "}
            <b>Revert changes in commit</b>.
          </Item>
          <Item>
            <b>A mudança não apareceu na Lovable:</b> confira se o commit foi no <b>main</b>. Se
            foi, faça qualquer commit pequeno de novo — a Lovable sincroniza no próximo envio.
          </Item>
          <Item>
            <b>O ChatGPT devolveu o arquivo cortado:</b> peça “me mande o arquivo inteiro, sem
            cortar nada”. Nunca cole código com “...” no meio.
          </Item>
          <Item>
            <b>Não mexa</b> em <b>package.json</b>, <b>bun.lock</b> nem na pasta{" "}
            <b>src/integrations</b> — são arquivos que a Lovable cuida.
          </Item>
        </ul>
      </Bloco>
    </div>
  );
}

function CaminhoBtn({
  ativo,
  onClick,
  icon: Icon,
  titulo,
  sub,
  selo,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  sub: string;
  selo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-3 rounded-sm border p-3 text-left transition-colors",
        ativo
          ? "border-primary bg-primary/10 shadow-[0_0_16px_-6px_var(--color-primary)]"
          : "border-border bg-background/40 hover:border-primary/50",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", ativo ? "text-primary" : "text-muted-foreground")}
      />
      <span>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      {selo && (
        <span className="absolute -top-2 right-2 rounded-sm bg-success px-1.5 py-0.5 text-[9px] font-semibold uppercase text-background">
          {selo}
        </span>
      )}
    </button>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-sm border border-primary/20 bg-background/40 p-4">
      <p className="sys-label flex items-center gap-2 text-[10px]">
        <GitBranch className="size-3.5" /> {titulo}
      </p>
      {children}
    </div>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="sys-glow-text w-8 shrink-0 font-display text-2xl leading-none font-bold">
        {String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1 space-y-2 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{titulo}</p>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Dica({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-sm border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
      <Rocket className="size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-sm border border-gold/40 bg-gold/10 p-3 text-xs text-muted-foreground">
      <AlertTriangle className="size-4 shrink-0 text-gold" />
      <span>{children}</span>
    </p>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-primary" />
      <span>{children}</span>
    </li>
  );
}

function CopyBox({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <details className="group rounded-sm border border-primary/20 bg-background/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs text-foreground">
        <span>{rotulo}</span>
        <span className="font-mono text-[10px] text-primary group-open:hidden">VER</span>
      </summary>
      <pre className="max-h-64 overflow-auto border-t border-primary/15 p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap text-foreground/90">
        {texto}
      </pre>
      <div className="border-t border-primary/15 p-2">
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            toast.success("Copiado.");
            setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar
        </Button>
      </div>
    </details>
  );
}
