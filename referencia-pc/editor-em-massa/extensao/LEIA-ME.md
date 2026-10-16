# Minerador Viral (extensão)

Encontra os vídeos que mais performaram num perfil do **Instagram**, **TikTok** ou **YouTube Shorts** e baixa em massa.

## Instalar (Chrome ou Edge)

1. Abra `chrome://extensions` (no Edge: `edge://extensions`).
2. Ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha esta pasta `extensao`.
4. Fixe o ícone 📈 na barra. Clicar nele abre o painel ao lado da página.

## Usar

O painel tem três abas: **Minerar**, **Histórico** e **Ajustes**.

### Minerar
1. Abra um perfil (logado na sua conta): `instagram.com/perfil`, `tiktok.com/@perfil` ou a aba **Shorts** de um canal do YouTube.
2. Escolha:
   - **Ranking**: acima da média do perfil (ex.: *8,3× a média*), potencial viral (alcance + engajamento, bom para comparar perfis grandes e pequenos), mais visualizados, mais curtidos, mais comentados, maior engajamento ou mais recentes.
   - **Quero baixar**: quantos aprovados você quer (1 a 500).
   - **Analisar**: o perfil inteiro ou só os últimos X vídeos (1 a 5.000), e o período.
   - **Filtros mínimos** de views, curtidas e comentários (o vídeo precisa passar em todos).
3. **⛏ Minerar perfil**. Ou **☝ Escolher direto na página**: clique nas capas dos vídeos na própria grade do perfil (ficam com ✓ verde), depois em *Usar escolhidos* na barra embaixo. O painel busca views, curtidas e comentários de cada um.
4. Nos resultados: Top 10/25/50/100/150/250/500, **Parecidos** (perfis sugeridos; clicar abre numa aba nova) e **↻** para minerar de novo.
5. Com os vídeos marcados:
   - **➜ Editor**: o Editor em Massa (aberto no PC) baixa e coloca os vídeos na mesa. Funciona nas três plataformas. Os arquivos ficam em `Downloads/Minerador`.
   - **⬇ ZIP**: baixa pelo navegador (só Instagram), em um ZIP ou em lotes (veja Ajustes).
   - **⋯**: planilha CSV, copiar links, esquecer os baixados do perfil.

### 🔗 Link (vídeo, música ou perfil)
Cole **qualquer link** — de conteúdo que você tem autorização para usar:
- **Vídeo** do YouTube (inclui Shorts, lives gravadas e YouTube Music), do TikTok (inclui links curtos `vm.tiktok.com`) ou do Instagram (reel/post).
- **Música**: link do SoundCloud, ou o vídeo de onde quer tirar o som (escolha **Só o áudio (MP3)**).
- **Perfil** (Instagram, TikTok ou YouTube): a extensão abre o perfil e você minera os vídeos na aba **Minerar**.

Passos:
1. Cole um ou mais links (um por linha, até 50). Se a aba aberta for um vídeo, o botão **＋ Usar o vídeo aberto nesta aba** coloca o link sozinho.
2. Em **Baixar como**, escolha **Vídeo (MP4)**, **Só o áudio (MP3)** ou **Vídeo + MP3**.
3. Escolha para onde vai o vídeo: **🔥 Cortes Virais** (só vídeos do YouTube) ou a **mesa do Editor**, e a qualidade. Marque **Tenho autorização do dono do conteúdo** (pedida de novo a cada lote).
4. **⬇ Baixar**. O Editor em Massa precisa estar aberto: ele baixa com o yt-dlp e salva em `Downloads/Minerador/links`. Os MP3 ficam só nessa pasta.

Observações: lives acontecendo agora e vídeos privados não são baixados. Links do Instagram às vezes exigem login; nesse caso use a aba Minerar com o perfil aberto. Spotify e links de música do TikTok não são suportados (use o vídeo).

### Histórico
Lista os perfis já analisados neste navegador e quantos vídeos você baixou de cada um. Clicar abre o perfil com o último resultado.

### Ajustes
- **Buscar somente novos**: esconde e pula os vídeos já baixados.
- **Analisar tudo antes do ranking**: desligado, a mineração para assim que acha a quantidade pedida (mais rápido); ligado, lê todo o escopo e só depois escolhe os melhores.
- **Completar curtidas e comentários**: quando a leitura vier só com views, busca o resto dos vídeos mais vistos.
- **Planilha dentro do ZIP**, **Organização do ZIP** (um só ou lotes de X vídeos), **Onde salvar** (automático ou perguntar) e **Modo demonstração**.
- ZIPs muito grandes (acima de 1,5 GB) são divididos em partes sozinhos.

## Como ela lê o Instagram

1. Usa a **mesma consulta da aba Reels** do site (12 Reels por página, já com visualizações, curtidas e comentários), com a sua sessão. Não para numa primeira página com poucos Reels.
2. Se o Instagram trocar essa consulta, a extensão procura a versão nova sozinha; se precisar, **abre a aba Reels do perfil** e tenta de novo.
3. Se ainda assim não der, rola a aba Reels e junta os vídeos (com as visualizações). Nessa leitura não aparecem curtidas e comentários.
4. Se o Instagram responder 429, ela não espera: pula para a próxima rota e entrega o que já leu.

A legenda de cada vídeo é buscada na hora de baixar. Os downloads do Instagram usam a sua sessão aberta no navegador (os links são renovados na hora) e não precisam de nenhum programa extra.

## Bom saber

- O TikTok e a grade de Shorts do YouTube nem sempre mostram curtidas e comentários. Aí o score usa só as visualizações.
- O Editor em Massa baixa TikTok e YouTube com o **yt-dlp**, que ele mesmo baixa na primeira vez e atualiza a cada 20 dias.
- A extensão lê sem pausas. Se o Instagram responder 429 (muitas consultas), ela pula para a próxima rota e entrega o que já leu; espere alguns minutos antes de minerar de novo.
- Se aparecer "sua sessão caiu" ou "pediu uma verificação", abra o Instagram nessa aba, resolva e minere de novo.
- As plataformas mudam o site com frequência. Se uma parar de funcionar, me avise que eu ajusto o coletor.
