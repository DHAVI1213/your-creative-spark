<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Fábrica de Conteúdo — guia para IAs (ChatGPT, Codex, Claude, Lovable)

Leia tudo antes de mexer. Responda e escreva textos do app sempre em **português do Brasil**.

## O que é
App vendido como infoproduto (assinatura pela Kiwify). Junta ferramentas para criadores e quem
vende sites: Limpador de Metadados, Clonador de Sites (prontos), Editor em Massa, Minerador Viral,
Minerador de Clientes e Agendador (ainda "em breve"). Funciona como app instalável (PWA) no PC e
no celular. Visual estilo "Sistema" de anime: escuro, azul brilhante, ranks E–S.

## Como o código chega na Lovable
- Repositório `DHAVI1213/your-creative-spark`, ramo **main**, ligado à Lovable (projeto "Your Creative Spark").
- Todo commit no `main` aparece sozinho na Lovable. Mantenha o `main` sempre funcionando.
- Nunca reescreva o histórico (nada de force push, rebase ou amend em commits já enviados).
- Um assunto por commit, mensagem curta em português.

## Tecnologia
- **TanStack Start** (React 19) com rotas por arquivo em `src/routes`. NÃO é react-router e NÃO existe
  `src/pages`. `src/routeTree.gen.ts` é gerado sozinho — não edite.
  - `src/routes/index.tsx` = página de vendas. `src/routes/_app.tsx` = layout do app (exige login).
  - Telas do app em `src/routes/_app/*.tsx` com `createFileRoute("/_app/nome")`.
  - Rotas de servidor: `createFileRoute("/api/x")({ server: { handlers: { POST: async ({ request }) => ... } } })`.
  - Funções de servidor: `createServerFn({ method: "POST" }).validator(...).handler(...)` de `@tanstack/react-start`.
- **TypeScript estrito** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`): trate `undefined`.
- **Tailwind v4** — cores em `src/styles.css` (oklch). Componentes **shadcn/ui** em `src/components/ui`.
  Ícones `lucide-react`. Avisos com `toast` do `sonner`.
- Gerenciador de pacotes: **bun**. Antes de commitar: `bun run build`, `bun run test`, `bun run lint`.

## Visual (use sempre os componentes do sistema)
- `src/components/system/System.tsx`: `SystemWindow` (janela com borda luminosa), `SystemHeader`
  (cabeçalho de tela), `RankBadge`.
- `HeroCard.tsx` (card de personagem), `Embers.tsx` (faíscas), `PlanCards.tsx`, `Paywall.tsx`.
- Classes CSS: `sys-panel`, `sys-panel-muted`, `sys-label`, `sys-glow-text`, `sys-pop`, `sys-scan`.
- Botões do shadcn já são animados. Textos curtos, em português, linguagem simples.

## Login, planos e banco (Lovable Cloud / Supabase)
- Cliente do navegador: `import { supabase } from "@/integrations/supabase/client"`.
- Cliente de servidor com acesso total: `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`
  — **só dentro de rotas/funções de servidor**, nunca em código que vai para o navegador.
- **Não edite nada em `src/integrations/`** nem o `.env` (a Lovable gera).
- `src/lib/auth.tsx` → `useAuth()`: `user`, `perfil`, `assinatura`, `isAdmin`, `temAcesso`, `atualizar()`, `sair()`.
- `src/routes/_app.tsx`: sem login manda para `/entrar`; ferramentas sem plano mostram o `Paywall`.
  Telas livres (só precisam de login) estão na lista `LIVRES`.
- Tabelas (todas com RLS): `profiles`, `user_roles` (`admin`/`cliente`, função `has_role`),
  `assinaturas`, `eventos_kiwify`, `app_secrets` (segredos, só servidor), `app_config` (links de
  checkout e preços, editados no Painel do dono). Função `tem_acesso()`.
- Mudanças no banco: crie um arquivo novo em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`
  (que possa rodar mais de uma vez, com RLS) e avise o dono para aplicar pela Lovable.
- Chaves de APIs externas (YouTube, Google Maps, Meta): guardar em `app_secrets` (chaves novas
  precisam ser liberadas na função `admin_set_secret`) e usar só no servidor.
- Kiwify: webhook em `src/routes/api/kiwify.ts`, regras em `src/lib/kiwify.ts`.

## Ferramentas
- Lista e status em `src/lib/app.ts` (`TOOLS`, `status: "ativo" | "em-breve"`). Ao terminar uma
  ferramenta, troque o status para `"ativo"` e substitua a tela `ComingSoon` dela.
- Prontas: Limpador (`_app/limpador.tsx`, `lib/metadata/*`) e Clonador (`_app/clonador.tsx`,
  `components/clonador/*`, `lib/clonador*.ts`).
- Próximas:
  1. **Editor em Massa** (`_app/editor.tsx`): editar um vídeo e aplicar em todos, no navegador com
     FFmpeg (já instalado: `@ffmpeg/ffmpeg`; use `loadFFmpeg()` de `lib/metadata/video.ts`). Usar
     `useDevice()` (`lib/device.tsx`) para decidir quantos vídeos processar por vez.
  2. **Minerador Viral** (`_app/viral.tsx`): YouTube Data API pelo servidor.
  3. **Minerador de Clientes** (`_app/minerador.tsx`): Google Places API pelo servidor.
  4. **Agendador** (`_app/agendador.tsx`): Instagram Graph API (Meta), publicação pelo servidor.

## Regras
- Não instale pacotes sem necessidade; se instalar, use `bun add` (atualiza `bun.lock`).
- Não use `localStorage` para dados importantes (só preferências pequenas, com try/catch).
- Nada de dados falsos na interface; o que não existe ainda fica como "em breve".
- Segurança: nunca exponha segredos no navegador; toda tabela nova com RLS.
