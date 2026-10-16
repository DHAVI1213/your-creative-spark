# Editor em Massa

Edite um vídeo, aplique em todos. Feito em Electron + FFmpeg, roda 100% no seu PC.

## Como rodar

1. Tenha o **Node.js LTS** instalado (https://nodejs.org).
2. Dê dois cliques em **`iniciar.bat`**.
   Na primeira vez ele instala as dependências (Electron e FFmpeg), o que leva alguns minutos.
3. Para gerar um `.exe` portátil, rode **`gerar-exe.bat`**. O arquivo sai na pasta `dist`.

## Como usar

1. **Importe** os vídeos (botão ou arrastando para a janela).
2. Clique num vídeo para abrir no **preview**.
3. Escolha o escopo: **Este**, **Seleção** (vídeos marcados) ou **Todos**.
4. Ajuste as abas e clique em **Aplicar**.
5. Clique em **PROCESSAR VÍDEOS**. Os arquivos saem como `nome_editado.mp4` na pasta de saída.

A **legenda** é individual por vídeo. Para preencher várias de uma vez, use *Texto → Legendas em lote* (uma por linha, `|` quebra linha).
O **perfil** guarda seus ajustes favoritos: vídeos novos já entram com ele.

## 🔥 Cortes Virais (novo)

Na aba **🔥 Cortes Virais** (no topo) você coloca um vídeo longo (podcast, live, palestra, pregação, vídeo motivacional — até 10 horas) e o app devolve os melhores momentos já cortados:

1. **Escolha o vídeo** (ou arraste para a tela).
2. Diga **quantos cortes** quer e a **duração** de cada um (ex.: 10 cortes de 30–60 s).
3. Escolha o **tipo de conteúdo**, o **formato** (9:16 tela cheia, vídeo no meio com fundo desfocado ou o seu perfil) e o **motor de IA**.
4. Clique em **🔥 GERAR CORTES**.

O que acontece por dentro:
- **Transcrição no seu PC** com o Whisper (usa a placa NVIDIA; cai para a CPU se não der). Na primeira vez baixa o Whisper e o modelo (~2,3 GB). A transcrição fica salva: gerar de novo no mesmo vídeo vai direto para a IA, e se cancelar ela continua de onde parou.
- **A IA lê a transcrição** e escolhe os trechos com gancho forte, ideia completa e final de impacto, dá uma nota de 0 a 100, escreve título, descrição com hashtags e sugere emojis.
  - **Ollama** (no seu PC, grátis, sem limite): instale em ollama.com, deixe aberto e baixe um modelo pelo botão do app (recomendado para RTX 3090: `qwen2.5:14b`).
  - **Gemini** (chave grátis em aistudio.google.com), **OpenAI/compatível** (Groq, OpenRouter, LM Studio…) ou **Claude**.
  - **Sem IA**: escolhe pelos ganchos na fala, ritmo e volume (mais simples).
- Cada corte é salvo em `Saída/Cortes/<nome do vídeo>/01 - <título>.mp4` (o 01 é o de nota maior) e entra na **mesa** com legenda animada, emojis e o título no topo, prontos para ajustar e processar.
- Em **Outros momentos encontrados** dá para marcar mais trechos e cortar sem refazer nada.
- Vídeo do YouTube: na extensão **Minerador Viral**, aba **🔗 Link**, cole o link (vídeo, música ou perfil; só de conteúdo que você tem autorização para cortar), marque a confirmação e clique em **Baixar no Editor**. O app baixa e o vídeo já aparece escolhido aqui em Cortes Virais.
- No Agendador, “vídeos prontos da mesa” já leva a descrição da IA como legenda do post e o título para o YouTube.

## 💬 Legenda animada

Aba **💬 Legendas** do editor: legenda palavra por palavra no tempo da fala, com 5 estilos (palavra colorida, karaokê, caixa, uma palavra por vez, simples), animação pop/subir, cores que trocam a cada frase, contorno, sombra e **emojis automáticos** nas palavras importantes (dá para tirar, trocar ou pôr emoji no momento atual).
Os cortes virais já chegam com a legenda. Para qualquer outro vídeo da mesa, clique em **🎙 Gerar legenda automática** (vale para o escopo Este / Seleção / Todos). Dá para corrigir o texto: os tempos das palavras são mantidos.

## 🧹 Limpar metadados de vídeos prontos

Para vídeos que já estão prontos (sem refazer nada), use o **`LIMPAR-METADADOS.bat`**:
- **Arraste a pasta** (ou os vídeos) em cima dele, ou abra e cole o caminho da pasta.
- Ele pergunta se inclui as subpastas e substitui cada vídeo pela versão limpa.
- Depois renomeia os vídeos de cada pasta para **vídeo 1, vídeo 2, vídeo 3...** (na ordem em que aparecem no Explorer). Dá para recusar na pergunta.
- O vídeo **não é refeito**: mesma qualidade, mesmo tamanho, nada cortado e a capa embutida continua. Saem título, data de criação, aparelho, localização, comentários, programa usado e os dados que o codificador grava dentro do vídeo.
- Antes de trocar, ele confere se o resultado tem a mesma duração e as mesmas faixas; se algo não bater, o original fica como estava.

Para os vídeos novos, a opção **Saída → Excluir todos os metadados** já faz isso no processamento.

## Abas

| Aba | O que faz |
|---|---|
| Recorte | Recorte manual arrastando um retângulo (livre, 9:16, 4:5, 1:1, 16:9), detecção de barras pretas, recorte em pixels, zoom e posição |
| Efeitos | Espelhar, cortar 0,5s das pontas, ajuste de cor, velocidade, anti duplicidade, melhorar áudio, corte de tempo com linha do tempo |
| Filtros | 10 filtros de cor (Vívido, Quente, Frio, P&B, Sépia, Vintage, Cinema, Desbotado, Noir, Dourado) com intensidade; o vídeo final sai igual ao preview |
| Template | Fundo (cor, imagem ou vídeo desfocado), logo com posição/tamanho/opacidade, moldura |
| Texto | Legenda, posição, fonte, tamanho, cores, contorno, fundo e CTA |
| Legendas | Legenda animada palavra por palavra (Whisper), estilos, cores, emojis automáticos |
| Capa | Capa de um momento do vídeo ou imagem própria, com título; sai embutida no vídeo (primeiro quadro + miniatura do MP4) e opcionalmente em JPG |
| Áudio | Original, mudo, substituir ou mixar com música |
| Saída | 720p/1080p, FPS, bitrate e encoder (GPU NVIDIA ou CPU) |

## Agendador (posta com o PC desligado)

Na aba **📅 Agendador** você agenda posts em massa no **Instagram** (Reels, Stories e fotos), no **YouTube** (Shorts) e no **TikTok**, em **quantas contas quiser** ao mesmo tempo. Quem publica é uma parte do app que roda na nuvem (Cloudflare), então o PC pode ficar desligado.

**Instalação (uma vez só):**
1. Rode **`instalar-nuvem.bat`**. Ele abre o navegador para você entrar na Cloudflare (conta grátis) e cria tudo sozinho.
   Se pedir, ative o **R2** no painel da Cloudflare (plano grátis até 10 GB; pede cartão, mas não cobra dentro do limite) e rode de novo.
   **Atualizou o app?** Rode o `instalar-nuvem.bat` de novo: ele atualiza a nuvem sem perder a agenda nem a conta já conectada.
2. No app, aba Agendador → **Contas** → **＋ Instagram / ＋ YouTube / ＋ TikTok** (o passo a passo de cada uma está no próprio app).
   - Instagram: conta profissional, adicionada como Testadora no app da Meta; cole o token.
   - YouTube e TikTok: na primeira vez, cole as chaves do seu app do Google / TikTok for Developers; depois é só entrar na conta pelo navegador.

**Uso:** adicione os vídeos prontos da mesa (ou arquivos do PC), marque em **Onde publicar** as contas que vão receber, escolha dia de início, horários e dias da semana, a legenda e as hashtags → **Montar agenda do lote** → **Enviar para a nuvem**. O arquivo sobe uma vez só e vira um post em cada conta marcada. Em cada item dá para tirar/colocar contas e escrever o título do YouTube.

**Limites das redes:**
- Instagram: até 100 posts por dia por conta; legenda até 2.200 caracteres e 30 hashtags; Story não aceita legenda pela API.
- YouTube: a cota grátis do Google dá uns 6 envios por dia (somando todos os canais). Enquanto o app do Google não for verificado, os vídeos podem ficar privados.
- TikTok: enquanto o app não for auditado pelo TikTok, os vídeos só saem como “Só eu”. Foto não vai para YouTube/TikTok, só vídeo.

## Minerador Viral (extensão do navegador)

Na pasta **`extensao`** está a extensão que minera perfis do Instagram, TikTok e YouTube Shorts, ordena pelo score viral e manda os vídeos escolhidos direto para a mesa deste app (com o app aberto). Instalação e uso: `extensao/LEIA-ME.md`.

## Estrutura do código

- `main.js`: janela, diálogos, ffprobe, miniaturas, detecção de bordas e a fila de processamento
- `ffmpeg-builder.js`: transforma os ajustes de um vídeo no comando FFmpeg
- `src/shared.js`: cálculos usados igualmente no preview e no FFmpeg (layout e tempos)
- `src/render.js`: desenha fundo, legenda, CTA e logo em canvas (vira PNG na exportação)
- `src/app.js`: interface (mesa, escopo, abas, preview, perfis)
- `src/agendador.js`: aba Agendador
- `cortes.js`: Cortes Virais no processo principal (Whisper, IA, cortes com FFmpeg)
- `src/cortes-ui.js`: tela Cortes Virais
- `src/legendas.js`: legenda animada e emojis (preview e PNGs da exportação)
- `nuvem/worker.js`: parte na nuvem (fila, publicação no Instagram, links dos arquivos)
- `nuvem/setup.js`: instalador da nuvem na Cloudflare
- `minerador-ponte.js`: recebe os vídeos da extensão (servidor local 127.0.0.1:47811) e baixa com yt-dlp
- `extensao/`: a extensão Minerador Viral

## Exportação em 2K, 4K e 8K

Na aba **Saída**, selecione 2K (2560×1440), 4K (3840×2160) ou 8K (7680×4320). Vídeos verticais usam as dimensões invertidas. Outras proporções são ajustadas dentro do limite da resolução, com dimensões pares, sem esticar o vídeo. Recorte, zoom e moldura continuam sendo aplicados. As opções antigas de 720p/1080p mantêm o quadro vertical do editor, inclusive em perfis antigos.

**Melhorar vídeo de baixa resolução** é independente da resolução: aplica redução de ruído hqdn3d antes da ampliação Lanczos e nitidez moderada depois. Não recupera detalhes inexistentes. A prévia mostra a composição; a redução de ruído/nitidez é aplicada somente no arquivo exportado. A super-resolução por IA é uma segunda opção, descrita abaixo. O modo convencional continua sem dependências adicionais.

O bitrate permanece manual (agora até 200 Mbps), preservando os perfis existentes. Sugestões iniciais: 2K 16, 4K 40 e 8K 100 Mbps, ajustáveis conforme conteúdo e fps. MP4/H.264/AAC permanecem os formatos de saída.

4K/8K rodam uma tarefa por vez, com limite de threads do FFmpeg. 8K usa CPU em Automático; GPU explícita em 8K exibe erro orientando a trocar o encoder. Em outras resoluções o fallback NVIDIA → CPU continua funcionando no modo Automático. O editor verifica a memória livre antes de gerar camadas grandes (estimativa conservadora, não garantia contra falta de memória). Prévia limitada a 1920 pixels no maior lado; camadas exportadas continuam na resolução completa. Legendas são preparadas em blocos menores, uma tarefa de desenho por vez. Vídeos longos com muitas legendas ainda podem exigir bastante memória e espaço temporário; 8K pode ser muito lento. Progresso, cancelamento, erros por vídeo e limpeza dos arquivos temporários usam o fluxo de lote existente.

Execute `npm test` para os testes de dimensões, proporções, perfis antigos e exportação real com o FFmpeg incluído. Os testes usam clipes curtos; não representam benchmark de vídeos longos nem validam GPU física. Reinicie o editor com `iniciar.bat` ou `npm start` para carregar as alterações. O executável já existente em `dist` não é atualizado automaticamente; `npm run dist` gera um novo pacote.

## Super-resolução por IA local (versão 0.3.0)

Na aba **Saída**, ative **Super-resolução por IA local (Real-ESRGAN)**, aplique os ajustes aos vídeos e processe o lote normalmente. A opção é independente da melhoria convencional e vem desligada nos perfis antigos.

O modelo `realesrgan-x4plus` amplia os quadros em 4× antes de recortes, efeitos, textos e logos. O áudio vem do arquivo original, com o mesmo trecho e velocidade. A composição final continua obedecendo à resolução selecionada: quando ela exige ampliação além dos 4× da IA, o restante usa Lanczos. A prévia e a imagem de capa continuam com o tratamento convencional; a IA atua na faixa principal do vídeo exportado. O modelo trabalha quadro a quadro: pode inventar texturas, causar suavização excessiva ou variações temporais. Confira um trecho curto antes de processar vídeos longos. Não há recuperação garantida de detalhes reais.

**Dependências incluídas:** executável Real-ESRGAN ncnn Vulkan, modelo `realesrgan-x4plus`, biblioteca vcomp140 e licenças em `vendor/realesrgan/runtime`. Não é necessário Python, PyTorch nem Ollama. Fonte oficial: https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0 (pacote Windows 20220424). A opção exige uma GPU com driver Vulkan; o encoder CPU/Automático seleciona a codificação final, não muda a execução da IA para CPU. Testado neste PC com NVIDIA RTX 3090, 24 GB.

**Limites e progresso:** fontes de até 2.073.600 pixels por quadro (1080p horizontal ou vertical). Uma tarefa com IA por vez; quadros extraídos em blocos de até 16, tiles de 128 pixels e uma thread de inferência. Em caso de falha, tenta tiles de 64; se a IA continuar falhando, o vídeo exibe erro, sem substituição silenciosa por ampliação comum. O progresso mostra preparação, IA (0–70%) e exportação (70–100%); essas faixas são etapas, não estimativa de tempo. Cancelar interrompe o processo ativo e remove seus intermediários. O espaço livre é verificado a cada bloco; os segmentos de vídeo temporários se acumulam até terminar, portanto vídeos longos exigem espaço considerável no disco temporário do Windows. O teste não representa um benchmark de conteúdo longo.

`npm test` inclui um teste real de inferência na GPU e exige os componentes locais/Vulkan. Verifica múltiplos blocos, dimensões, áudio, corte/velocidade, progresso, cancelamento e limpeza após erro. `npm run test:ui` verifica a opção de IA e a prévia 8K no Electron. `npm run dist` inclui o runtime e o modelo no executável novo.

Para abrir a versão pronta com IA, use `ABRIR-EDITOR-COM-IA.bat` ou `dist/Editor em Massa 0.3.0.exe`. O executável antigo `Editor-em-Massa-Limpeza.exe` e seu atalho continuam disponíveis. O pacote local é gerado sem assinatura/edição do executável para evitar a exigência de privilégios de links simbólicos do auxiliar de assinatura do electron-builder neste Windows.
